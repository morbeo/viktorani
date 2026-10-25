import { z } from 'zod'
import { db } from '@/db'
import { applySnapshot, parseSnapshot, snapshotDatabase } from '@/db/snapshot'
import type { ParsedSnapshot } from '@/db/snapshot'
import { ToolError, defineTool } from '../tool'
import type { McpContext } from '../tool'

/** Row counts per collection, as a summary of a backup. */
function counts(
  s: Pick<
    ParsedSnapshot,
    | 'difficulties'
    | 'tags'
    | 'questions'
    | 'rounds'
    | 'games'
    | 'layouts'
    | 'widgets'
    | 'themes'
    | 'notes'
  >
) {
  return {
    difficulties: s.difficulties.length,
    tags: s.tags.length,
    questions: s.questions.length,
    rounds: s.rounds.length,
    games: s.games.length,
    layouts: s.layouts.length,
    widgets: s.widgets.length,
    themes: s.themes.length,
    notes: s.notes.length,
  }
}

/** Read and validate the backup at `path`. */
async function readBackup(ctx: McpContext, path: string): Promise<ParsedSnapshot> {
  let text: string
  try {
    text = await ctx.files.read(path)
  } catch (e) {
    throw new ToolError(`Cannot read ${path}: ${(e as Error).message}`)
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    throw new ToolError(`Invalid JSON in ${path}: ${(e as Error).message}`)
  }
  try {
    return parseSnapshot(raw)
  } catch (e) {
    throw new ToolError((e as Error).message)
  }
}

/**
 * Replace everything in memory with the backup at `path`. App settings are kept aside and
 * written back unchanged on save.
 */
export async function loadBackup(ctx: McpContext, path: string): Promise<ParsedSnapshot> {
  const snapshot = await readBackup(ctx, path)
  await db.transaction('rw', db.tables, () => Promise.all(db.tables.map(t => t.clear())))
  await applySnapshot({ ...snapshot, settings: undefined })
  ctx.session.path = path
  ctx.session.settings = snapshot.settings
  ctx.session.dirty = false
  return snapshot
}

export const loadBackupTool = defineTool({
  name: 'load_backup',
  title: 'Load backup',
  description:
    'Load a Viktorani backup file (the JSON from Settings → Data → Export JSON) to edit. ' +
    'Replaces whatever is loaded now. Refuses while there are unsaved changes unless discard is true.',
  kind: 'session',
  input: z.object({
    path: z.string().min(1).describe('Path of the backup .json file'),
    discard: z.boolean().default(false).describe('Drop unsaved changes to the current backup'),
  }),
  async run({ path, discard }, ctx) {
    if (ctx.session.dirty && !discard) {
      throw new ToolError('There are unsaved changes. Call save first, or pass discard: true.')
    }
    const snapshot = await loadBackup(ctx, path)
    return { path, counts: counts(snapshot) }
  },
})

export const saveTool = defineTool({
  name: 'save',
  title: 'Save backup',
  description:
    'Write every change to a backup file the host can import in Settings → Data. ' +
    'Without a path, overwrites the file that was loaded or last saved. ' +
    'Use Replace from JSON in the app for deletions to take effect.',
  kind: 'session',
  input: z.object({
    path: z
      .string()
      .min(1)
      .optional()
      .describe('Where to write; defaults to the loaded or last saved file'),
  }),
  async run({ path }, ctx) {
    const target = path ?? ctx.session.path
    if (!target) throw new ToolError('Nothing loaded yet: pass a path to save to.')
    const snapshot = await snapshotDatabase(ctx.session.settings)
    try {
      await ctx.files.write(target, `${JSON.stringify(snapshot, null, 2)}\n`)
    } catch (e) {
      throw new ToolError(`Cannot write ${target}: ${(e as Error).message}`)
    }
    ctx.session.path = target
    ctx.session.dirty = false
    return { path: target, counts: counts(snapshot) }
  },
})

export const validateBackupTool = defineTool({
  name: 'validate_backup',
  title: 'Validate backup',
  description:
    'Check that a backup file is one the app can import, without loading it. ' +
    'Returns its row counts, or the first problems found.',
  kind: 'read',
  input: z.object({ path: z.string().min(1).describe('Path of the backup .json file') }),
  async run({ path }, ctx) {
    try {
      return { valid: true, counts: counts(await readBackup(ctx, path)) }
    } catch (e) {
      return { valid: false, error: (e as Error).message }
    }
  },
})

export const summaryTool = defineTool({
  name: 'summary',
  title: 'Summary',
  description:
    'What is loaded: the file, whether there are unsaved changes, and row counts per collection.',
  kind: 'read',
  input: z.object({}),
  async run(_args, ctx) {
    const snapshot = await snapshotDatabase()
    return { path: ctx.session.path, unsaved: ctx.session.dirty, counts: counts(snapshot) }
  },
})

export const BACKUP_TOOLS = [loadBackupTool, saveTool, validateBackupTool, summaryTool]
