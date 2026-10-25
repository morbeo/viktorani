import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { db } from '@/db'
import { BUILT_IN_THEMES } from '@/lib/theme'
import { AUTHORING_TOOLS } from './index'
import { ToolError, callTool } from './tool'
import type { McpContext, McpTool } from './tool'

/** What the server tells clients about itself and how to use it. */
const INSTRUCTIONS = `Viktorani is a bar trivia app. These tools edit one of its backup files: the question
bank (tags, difficulties, questions), rounds, games, screen layouts and themes. Changes stay
in memory until you call save. The host then imports the file in Viktorani under
Settings → Data: Import JSON adds and updates, Replace from JSON also applies deletions after
the host confirms. Call summary first to see what is loaded. Ids are returned by the list and
create tools; tags and difficulties may also be given by name.`

/** A tool's MCP annotations, from its kind. */
function annotations(tool: McpTool) {
  return {
    title: tool.title,
    readOnlyHint: tool.kind === 'read',
    destructiveHint: tool.kind === 'delete',
    openWorldHint: false,
  }
}

/** Run `tool` and wrap its result, or its error, as MCP tool content. */
async function run(tool: McpTool, args: unknown, ctx: McpContext): Promise<CallToolResult> {
  try {
    const result = await callTool(tool, args, ctx)
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  } catch (e) {
    const message = e instanceof ToolError ? e.message : `Unexpected error: ${(e as Error).message}`
    return { content: [{ type: 'text', text: message }], isError: true }
  }
}

/** A read-only JSON resource over one part of the loaded backup. */
function resource(
  server: McpServer,
  name: string,
  description: string,
  read: () => Promise<unknown>
) {
  const uri = `viktorani://${name}`
  server.registerResource(name, uri, { description, mimeType: 'application/json' }, async () => ({
    contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(await read(), null, 2) }],
  }))
}

/**
 * The MCP server for the authoring tools (ADR 0021, step 1), not yet connected to a
 * transport. Each tool runs against `ctx`; the stdio entry (`cli.ts`) gives it the file
 * system, tests give it memory.
 */
export function createServer(ctx: McpContext, version: string): McpServer {
  const server = new McpServer(
    { name: 'viktorani', title: 'Viktorani', version },
    { instructions: INSTRUCTIONS }
  )
  for (const tool of AUTHORING_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: annotations(tool),
      },
      args => run(tool, args, ctx)
    )
  }
  resource(
    server,
    'questions',
    'The question bank: every question, tag and difficulty',
    async () => ({
      questions: await db.questions.toArray(),
      tags: await db.tags.toArray(),
      difficulties: await db.difficulties.orderBy('order').toArray(),
    })
  )
  resource(server, 'games', 'Every round and game', async () => ({
    rounds: await db.rounds.toArray(),
    games: await db.games.toArray(),
  }))
  resource(server, 'layouts', 'Every stored layout with its widgets', async () => ({
    layouts: await db.layouts.toArray(),
    widgets: await db.widgets.toArray(),
  }))
  resource(server, 'themes', 'The built-in themes and the host’s own', async () => ({
    builtIn: BUILT_IN_THEMES,
    own: await db.themes.toArray(),
  }))
  return server
}
