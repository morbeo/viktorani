import { db } from '@/db'
import { aiToolLimiter, requestConfirmation } from '@/lib/ai-tools'
import type { WebMcpTool } from '@/lib/ai-tools'
import { getSettings, setSettings } from '@/lib/app-settings'
import type { RateLimiter } from '@/lib/rate-limit'
import { AUTHORING_TOOLS } from './index'
import { ToolError, callTool, formatIssues, newSession } from './tool'
import type { FileAccess, McpContext, McpTool } from './tool'

/**
 * The authoring tools offered in the app itself through WebMCP (ADR 0021, #532). They run on
 * the app's own data instead of a backup file: game defaults, presets and the theme in use
 * come from this device's app settings, and a delete waits for the host's click. Loaded only
 * once AI tools are on, so the tool layer stays out of the main bundle.
 */

/** Tools that work on a backup file, which the app doesn't have. */
const FILE_TOOLS = new Set(['load_backup', 'save', 'validate_backup', 'summary'])

/** The authoring tools the app offers: every one but the file tools. */
export const APP_AUTHORING_TOOLS: readonly McpTool[] = AUTHORING_TOOLS.filter(
  t => !FILE_TOOLS.has(t.name)
)

const noFiles: FileAccess = {
  read: () => Promise.reject(new ToolError('The app has no files')),
  write: () => Promise.reject(new ToolError('The app has no files')),
}

/** What a delete tool removes, by name where there is one, for the host's confirmation. */
async function describeDeletion(tool: McpTool, args: Record<string, unknown>): Promise<string> {
  const ids = (Array.isArray(args.ids) ? args.ids : [args.id]).filter(
    (id): id is string => typeof id === 'string'
  )
  const names = await (async (): Promise<(string | undefined)[]> => {
    switch (tool.name) {
      case 'delete_tag':
        return (await db.tags.bulkGet(ids)).map(r => r?.name)
      case 'delete_difficulty':
        return (await db.difficulties.bulkGet(ids)).map(r => r?.name)
      case 'delete_game':
        return (await db.games.bulkGet(ids)).map(r => r?.name)
      case 'delete_layout':
        return (await db.layouts.bulkGet(ids)).map(r => r?.name)
      case 'remove_widget':
        return (await db.widgets.bulkGet(ids)).map(r => r && `${r.type} widget`)
      case 'delete_questions':
        return (await db.questions.bulkGet(ids)).map(r => r?.title)
      case 'delete_round':
        return (await db.rounds.bulkGet(ids)).map(r => r?.name)
      case 'delete_theme':
        return (await db.themes.bulkGet(ids)).map(r => r?.name)
      default:
        return []
    }
  })()
  const shown = names.filter(Boolean).slice(0, 5) as string[]
  const more = ids.length - shown.length
  return [shown.map(n => `“${n}”`).join(', '), more > 0 ? `${more} more` : '']
    .filter(Boolean)
    .join(' and ')
}

/** Run `tool` against the app's data and this device's settings. */
async function runInApp(tool: McpTool, args: unknown): Promise<unknown> {
  const before = getSettings()
  const ctx: McpContext = { session: { ...newSession(), settings: before }, files: noFiles }
  const result = await callTool(tool, args, ctx)
  // A tool that changes the settings (deleting the theme in use) changes this device's
  if (ctx.session.settings && ctx.session.settings !== before) setSettings(ctx.session.settings)
  return result
}

/** One authoring tool as WebMCP registers it. */
function toWebMcp(tool: McpTool, limiter: RateLimiter): WebMcpTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.input.toJSONSchema({ io: 'input' }) as Record<string, unknown>,
    annotations: { readOnlyHint: tool.kind === 'read' },
    async execute(raw) {
      if (tool.kind !== 'read' && !limiter.allow('assistant')) {
        return 'Too many changes in a short time. Wait a few seconds and try again.'
      }
      const parsed = tool.input.safeParse(raw ?? {})
      if (!parsed.success) return `Invalid input: ${formatIssues(parsed.error)}`
      try {
        if (tool.kind === 'delete') {
          const detail = await describeDeletion(tool, parsed.data)
          if (!(await requestConfirmation(tool.title, detail))) return 'The host denied this.'
        }
        return JSON.stringify(await runInApp(tool, parsed.data), null, 2)
      } catch (e) {
        if (e instanceof ToolError) return e.message
        return `Unexpected error: ${(e as Error).message}`
      }
    },
  }
}

/** The authoring tools for WebMCP, sharing `limiter` with the live tools by default. */
export function buildAuthoringTools(limiter = aiToolLimiter): WebMcpTool[] {
  return APP_AUTHORING_TOOLS.map(t => toWebMcp(t, limiter))
}
