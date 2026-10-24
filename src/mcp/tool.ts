import { z } from 'zod'
import type { AppSettings } from '@/lib/app-settings'

/**
 * The MCP tool layer (ADR 0021). A tool is a plain object: a name, a description, a Zod
 * input schema and a handler over the `db/` helpers. Nothing here imports React or an MCP
 * SDK, so the same tools run in the stdio server and in tests.
 */

/** File access the tools need; the server passes the real file system, tests a fake. */
export interface FileAccess {
  read(path: string): Promise<string>
  write(path: string, text: string): Promise<void>
}

/** State of the backup file being edited. */
export interface McpSession {
  /** The file loaded or last saved, or `null` before either. */
  path: string | null
  /** App settings from the loaded file, written back unchanged on save. */
  settings: AppSettings | undefined
  /** Whether anything changed since the last load or save. */
  dirty: boolean
}

/** What every tool handler receives. */
export interface McpContext {
  session: McpSession
  files: FileAccess
}

/**
 * How a tool affects the backup: `read` changes nothing, `write` adds or edits, `delete`
 * removes, and `session` loads or saves the file itself.
 */
export type ToolKind = 'read' | 'write' | 'delete' | 'session'

/** One tool. `run` receives input already validated by `input`. */
export interface McpTool<S extends z.ZodObject = z.ZodObject> {
  name: string
  title: string
  description: string
  kind: ToolKind
  input: S
  run(args: z.output<S>, ctx: McpContext): Promise<unknown>
}

/** Declare a tool, keeping its input type for `run`. */
export function defineTool<S extends z.ZodObject>(tool: McpTool<S>): McpTool<S> {
  return tool
}

/** A mistake in the request (unknown id, invalid value) the assistant can correct. */
export class ToolError extends Error {
  override name = 'ToolError'
}

/** A fresh session with nothing loaded. */
export function newSession(): McpSession {
  return { path: null, settings: undefined, dirty: false }
}

/** Human-readable summary of the first few Zod issues, e.g. `title: Required`. */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map(i => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ')
}

/**
 * Validate `args` and run `tool`. A `write` or `delete` marks the session unsaved.
 *
 * @throws {@link ToolError} for invalid input or a request the tool refuses.
 */
export async function callTool(tool: McpTool, args: unknown, ctx: McpContext): Promise<unknown> {
  const parsed = tool.input.safeParse(args ?? {})
  if (!parsed.success) throw new ToolError(`Invalid input: ${formatIssues(parsed.error)}`)
  const result = await tool.run(parsed.data, ctx)
  if (tool.kind === 'write' || tool.kind === 'delete') ctx.session.dirty = true
  return result
}

/** Throw a {@link ToolError} saying `what` with `id` doesn't exist. */
export function notFound(what: string, id: string): never {
  throw new ToolError(`No ${what} with id "${id}"`)
}

/** Shared input fields. */
export const IdInput = z.object({ id: z.string().min(1).describe('The id') })
export const PageInput = {
  limit: z.number().int().min(1).max(200).default(50).describe('Most results to return'),
  offset: z.number().int().min(0).default(0).describe('Results to skip, for paging'),
}

/** `items[offset, offset + limit)` with the total, for list tools. */
export function page<T>(items: T[], limit: number, offset: number) {
  return { total: items.length, items: items.slice(offset, offset + limit) }
}

/** `patch` without its `undefined` fields, so a spread keeps the stored values. */
export function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>
}
