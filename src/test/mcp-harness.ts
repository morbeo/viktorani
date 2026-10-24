// Shared set-up for the MCP tool tests: an in-memory file system and a call-by-name helper.
import { db } from '@/db'
import { AUTHORING_TOOLS, callTool, newSession } from '@/mcp'
import type { FileAccess, McpContext } from '@/mcp'

/** Files keyed by path, standing in for the disk. */
export function memoryFiles(initial: Record<string, unknown> = {}) {
  const files = new Map(
    Object.entries(initial).map(([path, value]) => [
      path,
      typeof value === 'string' ? value : JSON.stringify(value),
    ])
  )
  const access: FileAccess = {
    async read(path) {
      const text = files.get(path)
      if (text === undefined) throw new Error('no such file')
      return text
    },
    async write(path, text) {
      files.set(path, text)
    },
  }
  return { files, access }
}

/** A fresh context over an empty database. */
export async function setUp(initial: Record<string, unknown> = {}) {
  await Promise.all(db.tables.map(t => t.clear()))
  const { files, access } = memoryFiles(initial)
  const ctx: McpContext = { session: newSession(), files: access }
  /** Call a tool by name, as the server does. */
  const call = <T = Record<string, unknown>>(name: string, args: unknown = {}) => {
    const tool = AUTHORING_TOOLS.find(t => t.name === name)
    if (!tool) throw new Error(`no tool ${name}`)
    return callTool(tool, args, ctx) as Promise<T>
  }
  return { ctx, files, call }
}

/** A minimal valid v2 backup with the given collections. */
export function backup(parts: Record<string, unknown[]> = {}, extra: Record<string, unknown> = {}) {
  return { version: 2, exportedAt: 1, ...parts, ...extra }
}
