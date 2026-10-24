// Must come first: Dexie picks up IndexedDB when `@/db` is first imported
import 'fake-indexeddb/auto'
import { access, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadBackup, newSession } from './index'
import type { FileAccess, McpContext } from './index'
import { createServer } from './server'

declare const __VIKTORANI_VERSION__: string

const VERSION = typeof __VIKTORANI_VERSION__ === 'string' ? __VIKTORANI_VERSION__ : 'dev'

const USAGE = `Usage: viktorani-mcp [backup.json]

An MCP server (stdio) that lets an AI assistant edit a Viktorani backup: questions, rounds,
games, layouts and themes. Nothing is written until the assistant calls save; then import the
file in Viktorani under Settings → Data.

  backup.json    Backup to load (from Settings → Data → Export JSON). If it doesn't exist
                 yet, the server starts empty and save creates it. Without it, start empty
                 and pass a path to save.

Options:
  -h, --help     Show this help
  -V, --version  Show the version

Example client config:
  { "mcpServers": { "viktorani": { "command": "node",
      "args": ["/path/to/viktorani-mcp.js", "/path/to/backup.json"] } } }`

/** Real files, written atomically so a failed save never leaves half a backup. */
const files: FileAccess = {
  read: path => readFile(path, 'utf8'),
  async write(path, text) {
    const tmp = `${path}.tmp`
    await writeFile(tmp, text, 'utf8')
    await rename(tmp, path)
  },
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function main(args: string[]): Promise<number> {
  if (args.includes('-h') || args.includes('--help')) {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }
  if (args.includes('-V') || args.includes('--version')) {
    process.stdout.write(`${VERSION}\n`)
    return 0
  }
  const unknown = args.find(a => a.startsWith('-'))
  if (unknown || args.length > 1) {
    process.stderr.write(
      `viktorani-mcp: ${unknown ? `unknown option ${unknown}` : 'one backup file at most'}\n\n${USAGE}\n`
    )
    return 2
  }

  const ctx: McpContext = { session: newSession(), files }
  const path = args[0] && resolve(args[0])
  if (path && (await exists(path))) {
    try {
      await loadBackup(ctx, path)
    } catch (e) {
      process.stderr.write(`viktorani-mcp: ${(e as Error).message}\n`)
      return 1
    }
    process.stderr.write(`viktorani-mcp ${VERSION}: editing ${path}\n`)
  } else {
    ctx.session.path = path || null
    process.stderr.write(
      `viktorani-mcp ${VERSION}: starting empty${path ? `; save writes ${path}` : ''}\n`
    )
  }

  await createServer(ctx, VERSION).connect(new StdioServerTransport())
  return -1
}

main(process.argv.slice(2)).then(
  code => {
    if (code >= 0) process.exit(code)
  },
  e => {
    process.stderr.write(`viktorani-mcp: ${(e as Error).stack ?? e}\n`)
    process.exit(1)
  }
)
