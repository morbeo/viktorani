// @vitest-pool vmForks
// Browsers that loaded an earlier deploy hold the app database at Dexie v4 (native
// IndexedDB version 40 — Dexie multiplies by 10) or at the collapsed v1 (native 10).
// The current schema must open on top of both without a VersionError.
// v5 databases (native 50) get the v6 join policy back-fill; v6 ones the v7 visibility move;
// v7 ones the v8 move from Player.isAway to Player.presence.
import { describe, it, expect, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '@/db'

// Stores as deployed at v4 (before the managed* tables existed)
const V4_STORES: Record<string, string> = {
  difficulties: 'id, name, order',
  tags: 'id, name',
  questions: 'id, difficulty, type, createdAt',
  rounds: 'id, createdAt',
  games: 'id, status, createdAt',
  teams: 'id, gameId',
  players: 'id, gameId, teamId, deviceId',
  buzzEvents: 'id, gameId, playerId, questionId, timestamp',
  layouts: 'id, gameId, target',
  widgets: 'id, layoutId, order',
  notes: 'id, name, createdAt, updatedAt',
  timers: 'id, gameId',
  gameQuestions: 'id, gameId, roundId, order',
}

const V1_STORES: Record<string, string> = {
  ...V4_STORES,
  managedPlayers: 'id, name, archivedAt',
  managedTeams: 'id, name, archivedAt',
  managedLabels: 'id, name',
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Create a raw IndexedDB database the way Dexie would have, with one game record in it. */
async function seedRawDb(
  nativeVersion: number,
  stores: Record<string, string>,
  game: Record<string, unknown> = {},
  players: Record<string, unknown>[] = [],
  teams: Record<string, unknown>[] = [],
  rows: Record<string, Record<string, unknown>[]> = {}
) {
  const req = indexedDB.open(db.name, nativeVersion)
  req.onupgradeneeded = () => {
    for (const [name, schema] of Object.entries(stores)) {
      const [, ...indexes] = schema.split(',').map(s => s.trim())
      const store = req.result.createObjectStore(name, { keyPath: 'id' })
      for (const index of indexes) store.createIndex(index, index)
    }
  }
  const raw = await request(req)
  const tx = raw.transaction(['games', 'players', 'teams', ...Object.keys(rows)], 'readwrite')
  players.forEach(p => tx.objectStore('players').put(p))
  teams.forEach(t => tx.objectStore('teams').put(t))
  for (const [store, records] of Object.entries(rows)) {
    records.forEach(r => tx.objectStore(store).put(r))
  }
  tx.objectStore('games').put({
    id: 'g-old',
    name: 'Old game',
    status: 'waiting',
    createdAt: 1,
    ...game,
  })
  await new Promise<void>(resolve => {
    tx.oncomplete = () => resolve()
  })
  raw.close()
}

afterEach(async () => {
  db.close()
  await request(indexedDB.deleteDatabase(db.name))
})

describe('Dexie schema version', () => {
  it('upgrades a v4 database (native version 40) in place', async () => {
    await seedRawDb(40, V4_STORES)

    await expect(db.open()).resolves.toBe(db)

    expect(db.verno).toBe(22)
    expect(db.backendDB().version).toBe(220)
    expect(db.backendDB().objectStoreNames.contains('managedPlayers')).toBe(true)
    expect(await db.games.get('g-old')).toMatchObject({ name: 'Old game' })
    expect(await db.managedLabels.count()).toBe(0)
    expect(db.backendDB().objectStoreNames.contains('scoreEvents')).toBe(true)
    expect(db.backendDB().objectStoreNames.contains('gameLog')).toBe(true)
    expect(db.backendDB().objectStoreNames.contains('themes')).toBe(true)
  })

  it('upgrades a collapsed v1 database (native version 10) in place', async () => {
    await seedRawDb(10, V1_STORES)

    await expect(db.open()).resolves.toBe(db)

    expect(db.verno).toBe(22)
    expect(db.backendDB().version).toBe(220)
    expect(await db.games.get('g-old')).toMatchObject({ name: 'Old game' })
  })

  it('back-fills join policy defaults on existing games (v6)', async () => {
    await seedRawDb(50, V1_STORES)

    await db.open()

    expect(await db.games.get('g-old')).toMatchObject({
      allowLateJoin: true,
      allowRejoin: true,
      requireApproval: false,
      allowPlayerTeams: true,
    })
  })

  it('moves the old visibility flags into both targets (v7)', async () => {
    await seedRawDb(60, V1_STORES, { showQuestion: false, showAnswers: true, showMedia: false })

    await db.open()

    const game = await db.games.get('g-old')
    const flags = { showQuestion: false, showAnswers: true, showMedia: false }
    expect(game?.visibility).toEqual({ players: flags, screen: flags })
    expect(game).not.toHaveProperty('showQuestion')
  })

  it('uses the wizard defaults when a game has no visibility flags (v7)', async () => {
    await seedRawDb(60, V1_STORES)

    await db.open()

    const flags = { showQuestion: true, showAnswers: false, showMedia: true }
    expect((await db.games.get('g-old'))?.visibility).toEqual({ players: flags, screen: flags })
  })

  it('turns isAway into presence on existing players (v8)', async () => {
    const base = { gameId: 'g-old', name: 'P', teamId: null, score: 0, deviceId: 'd', joinedAt: 1 }
    await seedRawDb(70, V1_STORES, {}, [
      { ...base, id: 'p-here', isAway: false },
      { ...base, id: 'p-away', isAway: true },
    ])

    await db.open()

    expect(await db.players.get('p-here')).toMatchObject({ presence: 'connected' })
    const away = await db.players.get('p-away')
    expect(away).toMatchObject({ presence: 'disconnected' })
    expect(away).not.toHaveProperty('isAway')
  })

  it('gives existing games the buzzer (v11, v21)', async () => {
    await seedRawDb(90, V1_STORES)

    await db.open()

    expect(await db.games.get('g-old')).toMatchObject({ inputType: 'buzzer' })
  })

  it('back-fills an empty notes on existing teams (v12)', async () => {
    await seedRawDb(
      100,
      V1_STORES,
      {},
      [],
      [{ id: 't-old', gameId: 'g-old', name: 'Old team', color: '#000', icon: 'Shield', score: 0 }]
    )

    await db.open()

    expect(await db.teams.get('t-old')).toMatchObject({ notes: '' })
  })

  it('back-fills an empty notes on existing players (v13)', async () => {
    const base = { gameId: 'g-old', teamId: null, score: 0, deviceId: 'd', joinedAt: 1 }
    await seedRawDb(110, V1_STORES, {}, [{ ...base, id: 'p-old', name: 'Old player' }])

    await db.open()

    expect(await db.players.get('p-old')).toMatchObject({ notes: '' })
  })

  it('back-fills maxPlayers 0 (unlimited) on existing games (v14)', async () => {
    await seedRawDb(120, V1_STORES)

    await db.open()

    expect(await db.games.get('g-old')).toMatchObject({ maxPlayers: 0 })
  })

  it('back-fills sound, confirm-navigation, timer and rejoin defaults (v15)', async () => {
    const base = { gameId: 'g-old', teamId: null, score: 0, deviceId: 'd', joinedAt: 1 }
    await seedRawDb(130, V1_STORES, {}, [{ ...base, id: 'p-old', name: 'Old player' }])

    await db.open()

    expect(await db.games.get('g-old')).toMatchObject({
      soundEffectsMuted: false,
      confirmUnruledNavigation: false,
      autoStartTimerOnQuestionShow: false,
      defaultTimerDuration: 60,
      rejoinWindowSeconds: 0,
    })
    expect(await db.players.get('p-old')).toMatchObject({ disconnectedAt: null })
  })

  it('moves layouts and widgets to the v2 model (v16)', async () => {
    const layout = { gameId: 'g-old', name: 'L', isActive: true, order: 0 }
    const widget = { type: 'text', config: {}, layoutId: 'l-admin' }
    await seedRawDb(150, V1_STORES, {}, [], [], {
      layouts: [
        { ...layout, id: 'l-admin', target: 'admin' },
        { ...layout, id: 'l-player', target: 'player' },
      ],
      widgets: [
        { ...widget, id: 'w-full', order: 2, width: 'full' },
        { ...widget, id: 'w-half-a', order: 0, width: 'half' },
        { ...widget, id: 'w-half-b', order: 1, width: 'half' },
      ],
    })

    await db.open()

    const theme = { background: null, accent: null, fontScale: 1, logo: null }
    expect(await db.layouts.get('l-admin')).toMatchObject({
      target: 'gamemaster',
      phase: null,
      theme,
    })
    expect(await db.layouts.get('l-player')).toMatchObject({ target: 'player', phase: null })
    const widgets = await db.widgets.toArray()
    expect(Object.fromEntries(widgets.map(w => [w.id, w.grid]))).toEqual({
      'w-half-a': { x: 0, y: 0, w: 6, h: 1 },
      'w-half-b': { x: 6, y: 0, w: 6, h: 1 },
      'w-full': { x: 0, y: 1, w: 12, h: 1 },
    })
    for (const w of widgets) {
      expect(w).not.toHaveProperty('width')
      expect(w.breakpoints).toEqual({})
    }
  })

  it('back-fills the auto-advance defaults on existing games (v18)', async () => {
    await seedRawDb(160, V1_STORES)

    await db.open()

    expect(await db.games.get('g-old')).toMatchObject({
      autoAdvanceOnCorrect: false,
      autoAdvanceOnTimerExpiry: false,
      autoAdvanceDelaySeconds: 5,
    })
  })

  it('back-fills autoRemoveAfterMinutes 0 (never) on existing games (v19)', async () => {
    await seedRawDb(160, V1_STORES)

    await db.open()

    expect(await db.games.get('g-old')).toMatchObject({ autoRemoveAfterMinutes: 0 })
  })

  it('back-fills revealTiming and GameQuestion.revealed (v20)', async () => {
    await seedRawDb(190, V1_STORES, {}, [], [], {
      gameQuestions: [{ id: 'gq-old', gameId: 'g-old', status: 'correct' }],
    })

    await db.open()

    expect(await db.games.get('g-old')).toMatchObject({ revealTiming: 'manual' })
    expect(await db.gameQuestions.get('gq-old')).toMatchObject({ revealed: false })
  })

  it('replaces buzzerEnabled with inputType and adds answers (v21)', async () => {
    await seedRawDb(200, V1_STORES, { buzzerEnabled: false })

    await db.open()

    const game = await db.games.get('g-old')
    expect(game).toMatchObject({ inputType: 'none' })
    expect(game).not.toHaveProperty('buzzerEnabled')
    expect(await db.answers.count()).toBe(0)
  })

  it('gives existing answers no typed text (v22)', async () => {
    const stores = { ...V1_STORES, answers: 'id, gameId, gameQuestionId' }
    await seedRawDb(210, stores, { inputType: 'choice' }, [], [], {
      answers: [{ id: 'a-old', gameId: 'g-old', gameQuestionId: 'gq', choice: 1 }],
    })

    await db.open()

    expect(await db.answers.get('a-old')).toMatchObject({ choice: 1, text: null })
  })
})
