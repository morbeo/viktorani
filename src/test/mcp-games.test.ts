// @vitest-pool vmForks
// MCP game, layout and theme tools (#519).
import { describe, it, expect } from 'vitest'
import { db } from '@/db'
import type { Game, Layout, Question, Round, Theme, Widget } from '@/db'
import { GameSchema } from '@/db/snapshot-schema'
import { AppSettingsSchema } from '@/lib/app-settings'
import { backup, setUp } from './mcp-harness'

/** A context with one round of two questions. */
async function withRound(initial: Record<string, unknown> = {}) {
  const harness = await setUp(initial)
  const ids: string[] = []
  for (const title of ['A', 'B']) {
    ids.push(
      (await harness.call<Question>('create_question', { title, type: 'open_ended', answer: 'x' }))
        .id
    )
  }
  const round = await harness.call<Round>('create_round', { name: 'R1', questionIds: ids })
  return { ...harness, round }
}

describe('games', () => {
  it('creates a valid game from rounds with the built-in defaults', async () => {
    const { call, round } = await withRound()
    const created = await call<{ id: string; questions: number }>('create_game', {
      name: 'Friday',
      roundIds: [round.id],
    })
    expect(created.questions).toBe(2)
    const game = (await db.games.get(created.id))!
    expect(GameSchema.safeParse(game).success).toBe(true)
    expect(game).toMatchObject({ status: 'waiting', inputType: 'buzzer', themeId: null })
    expect(game.roomId).toMatch(/^[A-Z0-9]{6}$/)
    expect(await db.gameQuestions.where('gameId').equals(created.id).count()).toBe(2)
  })

  it('starts from the backup’s defaults, a preset, then the settings given', async () => {
    const settings = { version: 5, gameDefaults: { inputType: 'text', maxTeams: 4 } }
    const { call } = await setUp({ 'a.json': backup({}, { settings }) })
    await call('load_backup', { path: 'a.json' })
    const q = await call<Question>('create_question', {
      title: 'Q',
      type: 'open_ended',
      answer: 'x',
    })
    const r = await call<Round>('create_round', { name: 'R', questionIds: [q.id] })
    const a = await call<{ id: string }>('create_game', { name: 'A', roundIds: [r.id] })
    expect(await db.games.get(a.id)).toMatchObject({ inputType: 'text', maxTeams: 4 })
    const b = await call<{ id: string }>('create_game', {
      name: 'B',
      roundIds: [r.id],
      settings: { inputType: 'choice', revealTiming: 'endOfRound' },
    })
    expect(await db.games.get(b.id)).toMatchObject({
      inputType: 'choice',
      revealTiming: 'endOfRound',
      maxTeams: 4,
    })
    const presets = await call<{ id: string }[]>('list_game_presets')
    const c = await call<{ id: string }>('create_game', {
      name: 'C',
      roundIds: [r.id],
      preset: presets[0].id,
    })
    expect(await db.games.get(c.id)).toBeDefined()
    await expect(
      call('create_game', { name: 'D', roundIds: [r.id], preset: 'nope' })
    ).rejects.toThrow(/No preset/)
  })

  it('rejects unknown rounds, empty rounds, bad settings and unknown themes', async () => {
    const { call, round } = await withRound()
    const empty = await call<Round>('create_round', { name: 'Empty' })
    await expect(call('create_game', { name: 'X', roundIds: ['nope'] })).rejects.toThrow(/No round/)
    await expect(call('create_game', { name: 'X', roundIds: [empty.id] })).rejects.toThrow(
      /at least one question/
    )
    await expect(
      call('create_game', { name: 'X', roundIds: [round.id], settings: { inputType: 'shout' } })
    ).rejects.toThrow(/Invalid input/)
    await expect(
      call('create_game', { name: 'X', roundIds: [round.id], settings: { roomId: 'HACK' } })
    ).rejects.toThrow(/Invalid input/)
    await expect(
      call('create_game', { name: 'X', roundIds: [round.id], themeId: 'nope' })
    ).rejects.toThrow(/No theme/)
    expect(await db.games.count()).toBe(0)
  })

  it('updates settings, and rounds only before play', async () => {
    const { call, round } = await withRound()
    const { id } = await call<{ id: string }>('create_game', { name: 'A', roundIds: [round.id] })
    await call('update_game', { id, name: 'B', settings: { holdScores: true }, themeId: 'pub' })
    expect(await db.games.get(id)).toMatchObject({ name: 'B', holdScores: true, themeId: 'pub' })
    expect(await call('get_game', { id })).toMatchObject({
      name: 'B',
      rounds: [{ name: 'R1' }],
      questions: 2,
      settings: { holdScores: true },
    })

    const q = await call<Question>('create_question', {
      title: 'C',
      type: 'open_ended',
      answer: 'x',
    })
    const r2 = await call<Round>('create_round', { name: 'R2', questionIds: [q.id] })
    expect(await call('update_game', { id, roundIds: [r2.id, round.id] })).toMatchObject({
      questions: 3,
    })
    const gqs = await db.gameQuestions.where('gameId').equals(id).sortBy('order')
    expect(gqs.map(gq => gq.roundId)).toEqual([r2.id, round.id, round.id])

    await db.games.update(id, { status: 'ended' } as Partial<Game>)
    await expect(call('update_game', { id, roundIds: [round.id] })).rejects.toThrow(
      /before a game has been played/
    )
  })

  it('lists and deletes games', async () => {
    const { call, round } = await withRound()
    const { id } = await call<{ id: string }>('create_game', { name: 'A', roundIds: [round.id] })
    expect(await call('list_games')).toMatchObject({
      total: 1,
      items: [{ name: 'A', status: 'waiting', rounds: 1, questions: 2 }],
    })
    await call('delete_game', { id })
    expect(await db.games.count()).toBe(0)
    expect(await db.gameQuestions.count()).toBe(0)
  })
})

describe('layouts', () => {
  it('describes every widget type with its settings schema', async () => {
    const { call } = await setUp()
    const types =
      await call<{ type: string; targets: string[]; settings: object }[]>('list_widget_types')
    expect(types.find(t => t.type === 'text')).toMatchObject({
      targets: ['gamemaster', 'player', 'screen', 'scoreboard'],
      settings: { type: 'object' },
    })
  })

  it('creates a layout, places widgets and assigns it to a game', async () => {
    const { call, round } = await withRound()
    const { id: gameId } = await call<{ id: string }>('create_game', {
      name: 'A',
      roundIds: [round.id],
    })
    const layout = await call<Layout>('create_layout', {
      name: 'Big screen',
      gameId,
      target: 'screen',
    })
    const q = await call<Widget>('add_widget', { layoutId: layout.id, type: 'question' })
    const t = await call<Widget>('add_widget', {
      layoutId: layout.id,
      type: 'text',
      config: { text: 'Welcome' },
    })
    expect(q.grid).toEqual({ x: 0, y: 0, w: 12, h: 1 })
    expect(t).toMatchObject({ grid: { x: 0, y: 1, w: 6, h: 1 }, config: { text: 'Welcome' } })
    await expect(call('add_widget', { layoutId: layout.id, type: 'buzzer' })).rejects.toThrow(
      /can't go on a screen layout/
    )
    await expect(
      call('add_widget', { layoutId: layout.id, type: 'text', config: { text: 1 } })
    ).rejects.toThrow(/Invalid text settings/)

    await call('update_widget', {
      id: t.id,
      grid: { x: 6, y: 0, w: 6, h: 2 },
      phone: { x: 0, y: 2, w: 12, h: 1 },
    })
    expect(await db.widgets.get(t.id)).toMatchObject({
      grid: { x: 6, y: 0, w: 6, h: 2 },
      breakpoints: { phone: { x: 0, y: 2, w: 12, h: 1 } },
    })
    await call('update_widget', { id: t.id, phone: null })
    expect((await db.widgets.get(t.id))!.breakpoints).toEqual({})

    await call('assign_layout', { gameId, target: 'screen', slot: 'all', layoutId: layout.id })
    expect((await db.games.get(gameId))!.layoutAssignments).toEqual({ screen: { all: layout.id } })
    await expect(
      call('assign_layout', { gameId, target: 'player', slot: 'all', layoutId: layout.id })
    ).rejects.toThrow(/is for screen/)

    expect(await call('get_layout', { id: layout.id })).toMatchObject({
      name: 'Big screen',
      widgets: [{ type: 'question' }, { type: 'text' }],
    })
    await call('remove_widget', { id: q.id })
    await call('delete_layout', { id: layout.id })
    expect(await db.widgets.count()).toBe(0)
  })

  it('copies a built-in layout, which itself stays read-only', async () => {
    const { call } = await setUp()
    const layouts = await call<{ id: string; builtin: boolean; target: string }[]>('list_layouts')
    const builtin = layouts.find(l => l.builtin && l.target === 'player')!
    const copy = await call<Layout>('create_layout', { name: 'Phones', from: builtin.id })
    expect(copy).toMatchObject({ gameId: null, target: 'player' })
    expect(await db.widgets.where('layoutId').equals(copy.id).count()).toBeGreaterThan(0)
    await expect(call('delete_layout', { id: builtin.id })).rejects.toThrow(/read-only/)
    await expect(
      call('create_layout', { name: 'X', from: builtin.id, target: 'screen' })
    ).rejects.toThrow(/keeps the source's target/)
    await expect(call('create_layout', { name: 'X' })).rejects.toThrow(/Give a target/)
  })

  it('updates a layout’s look', async () => {
    const { call } = await setUp()
    const layout = await call<Layout>('create_layout', { name: 'L', target: 'screen' })
    await call('update_layout', { id: layout.id, theme: { accent: '#ff0000' }, isActive: false })
    expect(await db.layouts.get(layout.id)).toMatchObject({
      isActive: false,
      theme: { accent: '#ff0000', fontScale: 1 },
    })
    await expect(
      call('update_layout', { id: layout.id, theme: { logo: 'javascript:alert(1)' } })
    ).rejects.toThrow(/Invalid input/)
  })
})

describe('themes', () => {
  it('copies Classic with changes, then edits and deletes the copy', async () => {
    const { call, ctx, round } = await withRound()
    const theme = await call<Theme>('create_theme', {
      name: 'Bar',
      light: { accent: '#112233' },
      fonts: { display: 'oswald' },
    })
    expect(theme).toMatchObject({ name: 'Bar', light: { accent: '#112233' } })
    expect(theme.fonts.display).toBe('oswald')
    await call('update_theme', { id: theme.id, dark: null, iconStroke: 2 })
    expect(await db.themes.get(theme.id)).toMatchObject({ dark: null, iconStroke: 2 })

    const { id: gameId } = await call<{ id: string }>('create_game', {
      name: 'A',
      roundIds: [round.id],
      themeId: theme.id,
    })
    expect(await call('list_themes')).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: theme.id, games: ['A'] })])
    )
    ctx.session.settings = { ...AppSettingsSchema.parse({}), themeId: theme.id }
    await call('delete_theme', { id: theme.id })
    expect((await db.games.get(gameId))!.themeId).toBeNull()
    expect(ctx.session.settings!.themeId).toBe('classic')
  })

  it('keeps built-in themes read-only and validates colours', async () => {
    const { call } = await setUp()
    await expect(call('update_theme', { id: 'classic', name: 'Mine' })).rejects.toThrow(/read-only/)
    await expect(call('create_theme', { name: 'Bad', light: { bg: 'red' } })).rejects.toThrow(
      /Invalid input/
    )
    await expect(call('create_theme', { name: 'X', from: 'nope' })).rejects.toThrow(/No theme/)
    expect(await call('get_theme', { id: 'pub' })).toMatchObject({ name: 'Pub' })
  })
})
