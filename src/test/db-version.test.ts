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
  players: Record<string, unknown>[] = []
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
  const tx = raw.transaction(['games', 'players'], 'readwrite')
  players.forEach(p => tx.objectStore('players').put(p))
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

    expect(db.verno).toBe(10)
    expect(db.backendDB().version).toBe(100)
    expect(db.backendDB().objectStoreNames.contains('managedPlayers')).toBe(true)
    expect(await db.games.get('g-old')).toMatchObject({ name: 'Old game' })
    expect(await db.managedLabels.count()).toBe(0)
    expect(db.backendDB().objectStoreNames.contains('scoreEvents')).toBe(true)
    expect(db.backendDB().objectStoreNames.contains('gameLog')).toBe(true)
  })

  it('upgrades a collapsed v1 database (native version 10) in place', async () => {
    await seedRawDb(10, V1_STORES)

    await expect(db.open()).resolves.toBe(db)

    expect(db.verno).toBe(10)
    expect(db.backendDB().version).toBe(100)
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
})
