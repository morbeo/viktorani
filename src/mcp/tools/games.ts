import { z } from 'zod'
import { db } from '@/db'
import type { Game } from '@/db'
import { buildGameQuestions, createGame, deleteGame } from '@/db/games'
import { GameSchema } from '@/db/snapshot-schema'
import {
  BUILT_IN_PRESETS,
  GAME_SETTINGS_KEYS,
  pickGameSettings,
} from '@/components/game-settings/game-settings'
import type { GameSettings } from '@/components/game-settings/game-settings'
import { AppSettingsSchema } from '@/lib/app-settings'
import { BUILT_IN_THEME_IDS } from '@/lib/theme'
import { generateRoomId } from '@/transport'
import { IdInput, PageInput, ToolError, defineTool, definedOnly, notFound, page } from '../tool'
import type { McpContext } from '../tool'

/** `schema` without its `.default()`, so an omitted setting stays `undefined`. */
function unwrapDefault(schema: z.ZodType): z.ZodType {
  return schema instanceof z.ZodDefault ? (schema.unwrap() as z.ZodType) : schema
}

const gameShape = GameSchema.in.shape

/** Every game setting, optional, with the same limits a backup has. */
const SettingsInput = z
  .object(
    Object.fromEntries(
      GAME_SETTINGS_KEYS.map(k => [k, unwrapDefault(gameShape[k] as z.ZodType).optional()])
    ) as { [K in keyof GameSettings]: z.ZodOptional<z.ZodType<GameSettings[K]>> }
  )
  .strict()
  .describe(
    'Game settings to change, e.g. inputType (none, buzzer, choice, text), revealTiming, ' +
      'answersClose, teamAnswering, maxTeams, scoringEnabled. Omitted ones keep their value.'
  )

/** The game defaults and presets in the loaded backup's settings, or the built-in ones. */
function appSettings(ctx: McpContext) {
  return ctx.session.settings ?? AppSettingsSchema.parse({})
}

/** Throw unless every round exists and the rounds hold at least one question. */
async function checkRounds(roundIds: string[]) {
  const rounds = await db.rounds.bulkGet(roundIds)
  const missing = roundIds.find((_, i) => !rounds[i])
  if (missing) notFound('round', missing)
  const found = rounds.filter(r => r !== undefined)
  if (!found.some(r => r.questionIds.length)) {
    throw new ToolError('A game needs at least one question: its rounds are empty')
  }
  return found
}

/** Throw unless `themeId` is a built-in or stored theme, or `null`. */
async function checkTheme(themeId: string | null | undefined) {
  if (!themeId || BUILT_IN_THEME_IDS.includes(themeId)) return
  if (!(await db.themes.get(themeId))) notFound('theme', themeId)
}

/** A stored game's settings with `patch` applied, validated like a backup's. */
function withSettings(game: Game, patch: Partial<GameSettings>): Game {
  const parsed = GameSchema.safeParse({ ...game, ...definedOnly(patch) })
  if (!parsed.success) throw new ToolError(`Invalid settings: ${parsed.error.issues[0].message}`)
  return parsed.data
}

const listGames = defineTool({
  name: 'list_games',
  title: 'List games',
  description: 'Every game, newest first, with its status and question count.',
  kind: 'read',
  input: z.object(PageInput),
  async run({ limit, offset }) {
    const [games, gqs] = await Promise.all([
      db.games.orderBy('createdAt').reverse().toArray(),
      db.gameQuestions.toArray(),
    ])
    return page(
      games.map(g => ({
        id: g.id,
        name: g.name,
        status: g.status,
        rounds: g.roundIds.length,
        questions: gqs.filter(gq => gq.gameId === g.id).length,
      })),
      limit,
      offset
    )
  },
})

const getGame = defineTool({
  name: 'get_game',
  title: 'Get game',
  description: 'One game: its settings, rounds, theme and layout choices.',
  kind: 'read',
  input: IdInput,
  async run({ id }) {
    const game = (await db.games.get(id)) ?? notFound('game', id)
    const rounds = await db.rounds.bulkGet(game.roundIds)
    return {
      id: game.id,
      name: game.name,
      status: game.status,
      rounds: game.roundIds.map((rid, i) => ({ id: rid, name: rounds[i]?.name ?? null })),
      questions: await db.gameQuestions.where('gameId').equals(id).count(),
      themeId: game.themeId ?? null,
      layoutAssignments: game.layoutAssignments ?? {},
      settings: pickGameSettings(game),
    }
  },
})

const listPresets = defineTool({
  name: 'list_game_presets',
  title: 'List game presets',
  description: 'The game setting presets a new game can start from.',
  kind: 'read',
  input: z.object({}),
  async run(_args, ctx) {
    return appSettings(ctx).gamePresets.map(p => ({
      id: p.id,
      label: p.label,
      description: p.description,
    }))
  },
})

const createGameTool = defineTool({
  name: 'create_game',
  title: 'Create game',
  description:
    'Create a game from rounds, in order. It starts from the backup’s game defaults, or a ' +
    'preset, then applies settings.',
  kind: 'write',
  input: z.object({
    name: z.string().trim().min(1).max(100),
    roundIds: z.array(z.string().min(1)).min(1).max(50),
    preset: z.string().optional().describe('Preset id from list_game_presets'),
    settings: SettingsInput.optional(),
    themeId: z.string().min(1).max(64).nullable().default(null).describe('Theme id, or null'),
  }),
  async run({ name, roundIds, preset, settings, themeId }, ctx) {
    const rounds = await checkRounds(roundIds)
    await checkTheme(themeId)
    const app = appSettings(ctx)
    let base: GameSettings = pickGameSettings(app.gameDefaults)
    if (preset) {
      const found = [...app.gamePresets, ...BUILT_IN_PRESETS].find(p => p.id === preset)
      if (!found) throw new ToolError(`No preset "${preset}"; see list_game_presets`)
      base = found.settings
    }
    const now = Date.now()
    const draft = {
      ...base,
      id: crypto.randomUUID(),
      name,
      status: 'waiting',
      roomId: generateRoomId(),
      roundIds,
      currentRoundIdx: 0,
      currentQuestionIdx: 0,
      buzzerLocked: true,
      tiebreakerMode: app.gameDefaults.tiebreakerMode,
      scoresAnnouncedAt: null,
      themeId,
      createdAt: now,
      updatedAt: now,
    } as Game
    const game = withSettings(draft, settings ?? {})
    await createGame(game, rounds)
    return {
      id: game.id,
      name: game.name,
      questions: buildGameQuestions(game.id, roundIds, rounds).length,
    }
  },
})

const updateGame = defineTool({
  name: 'update_game',
  title: 'Update game',
  description:
    'Rename a game, change its settings or theme, or (before it has been played) its rounds, ' +
    'which rebuilds its question list.',
  kind: 'write',
  input: IdInput.extend({
    name: z.string().trim().min(1).max(100).optional(),
    roundIds: z.array(z.string().min(1)).min(1).max(50).optional(),
    settings: SettingsInput.optional(),
    themeId: z.string().min(1).max(64).nullable().optional(),
  }),
  async run({ id, name, roundIds, settings, themeId }) {
    const stored = (await db.games.get(id)) ?? notFound('game', id)
    await checkTheme(themeId)
    const game = withSettings(
      { ...stored, ...definedOnly({ name, themeId }), updatedAt: Date.now() },
      settings ?? {}
    )
    if (!roundIds) {
      await db.games.put(game)
      return { id, updated: true }
    }
    const played =
      stored.status !== 'waiting' || (await db.players.where('gameId').equals(id).count())
    if (played) throw new ToolError('Rounds can only change before a game has been played')
    const rounds = await checkRounds(roundIds)
    const gqs = buildGameQuestions(id, roundIds, rounds)
    await db.transaction('rw', db.games, db.gameQuestions, async () => {
      await db.gameQuestions.where('gameId').equals(id).delete()
      await db.gameQuestions.bulkAdd(gqs)
      await db.games.put({ ...game, roundIds, currentRoundIdx: 0, currentQuestionIdx: 0 })
    })
    return { id, updated: true, questions: gqs.length }
  },
})

const deleteGameTool = defineTool({
  name: 'delete_game',
  title: 'Delete game',
  description:
    'Delete a game with its questions list, layouts and any play data, as the app does. ' +
    'Reaches the app only through Replace from JSON.',
  kind: 'delete',
  input: IdInput,
  async run({ id }) {
    if (!(await db.games.get(id))) notFound('game', id)
    await deleteGame(id)
    return { deleted: id }
  },
})

export const GAME_TOOLS = [
  listGames,
  getGame,
  listPresets,
  createGameTool,
  updateGame,
  deleteGameTool,
]
