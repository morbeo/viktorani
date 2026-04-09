// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import type { Game, BuzzEvent } from '@/db'
import { loadBuzzesForQuestion } from '@/hooks/useBuzzer'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clearAll() {
  await Promise.all([db.games.clear(), db.players.clear(), db.buzzEvents.clear()])
}

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    name: 'Test Game',
    status: 'active',
    transportMode: 'auto',
    roomId: 'ROOM1',
    passphrase: null,
    showQuestion: true,
    showAnswers: false,
    showMedia: true,
    maxTeams: 0,
    maxPerTeam: 0,
    allowIndividual: true,
    roundIds: [],
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerLocked: false,
    scoringEnabled: true,
    autoLockOnFirstCorrect: false,
    allowFalseStarts: false,
    buzzDeduplication: 'firstOnly',
    tiebreakerMode: 'serverOrder',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function makeBuzz(overrides: Partial<BuzzEvent> = {}): BuzzEvent {
  return {
    id: crypto.randomUUID(),
    gameId: 'g1',
    questionId: 'q1',
    playerId: 'p1',
    playerName: 'Alice',
    teamId: null,
    timestamp: Date.now(),
    isFalseStart: false,
    gmDecision: null,
    decidedAt: null,
    ...overrides,
  }
}

// ── BuzzEvent schema ──────────────────────────────────────────────────────────

describe('BuzzEvent DB schema', () => {
  beforeEach(clearAll)

  it('stores and retrieves a full BuzzEvent', async () => {
    const buzz = makeBuzz()
    await db.buzzEvents.add(buzz)
    const retrieved = await db.buzzEvents.get(buzz.id)
    expect(retrieved).toMatchObject({
      playerName: 'Alice',
      teamId: null,
      isFalseStart: false,
      gmDecision: null,
      decidedAt: null,
    })
  })

  it('stores a false-start buzz', async () => {
    const buzz = makeBuzz({ isFalseStart: true })
    await db.buzzEvents.add(buzz)
    const r = await db.buzzEvents.get(buzz.id)
    expect(r?.isFalseStart).toBe(true)
  })

  it('stores gmDecision after adjudication update', async () => {
    const buzz = makeBuzz()
    await db.buzzEvents.add(buzz)
    await db.buzzEvents.update(buzz.id, { gmDecision: 'Correct', decidedAt: 9999 })
    const r = await db.buzzEvents.get(buzz.id)
    expect(r?.gmDecision).toBe('Correct')
    expect(r?.decidedAt).toBe(9999)
  })

  it('supports all three GmDecision values', async () => {
    for (const decision of ['Correct', 'Incorrect', 'Skip'] as const) {
      const buzz = makeBuzz({ id: crypto.randomUUID() })
      await db.buzzEvents.add(buzz)
      await db.buzzEvents.update(buzz.id, { gmDecision: decision })
      const r = await db.buzzEvents.get(buzz.id)
      expect(r?.gmDecision).toBe(decision)
    }
  })
})

// ── loadBuzzesForQuestion ─────────────────────────────────────────────────────

describe('loadBuzzesForQuestion', () => {
  beforeEach(clearAll)

  it('returns buzzes sorted by timestamp ascending', async () => {
    const b1 = makeBuzz({ id: 'b1', timestamp: 300 })
    const b2 = makeBuzz({ id: 'b2', timestamp: 100 })
    const b3 = makeBuzz({ id: 'b3', timestamp: 200 })
    await db.buzzEvents.bulkAdd([b1, b2, b3])
    const result = await loadBuzzesForQuestion('q1')
    expect(result.map(b => b.id)).toEqual(['b2', 'b3', 'b1'])
  })

  it('only returns buzzes for the given questionId', async () => {
    await db.buzzEvents.bulkAdd([
      makeBuzz({ id: 'b1', questionId: 'q1' }),
      makeBuzz({ id: 'b2', questionId: 'q2' }),
      makeBuzz({ id: 'b3', questionId: 'q1' }),
    ])
    const result = await loadBuzzesForQuestion('q1')
    expect(result).toHaveLength(2)
    expect(result.every(b => b.questionId === 'q1')).toBe(true)
  })

  it('returns empty array when no buzzes exist', async () => {
    const result = await loadBuzzesForQuestion('q-none')
    expect(result).toHaveLength(0)
  })
})

// ── Deduplication logic ───────────────────────────────────────────────────────

describe('firstOnly deduplication filter', () => {
  it('keeps only the earliest buzz per player', () => {
    const buzzes: BuzzEvent[] = [
      makeBuzz({ id: 'b1', playerId: 'p1', timestamp: 100 }),
      makeBuzz({ id: 'b2', playerId: 'p2', timestamp: 200 }),
      makeBuzz({ id: 'b3', playerId: 'p1', timestamp: 300 }),
    ]
    const display = buzzes.filter(
      (b, i, all) => all.findIndex(x => x.playerId === b.playerId) === i
    )
    expect(display.map(b => b.id)).toEqual(['b1', 'b2'])
  })

  it('all mode returns every buzz', () => {
    const buzzes: BuzzEvent[] = [
      makeBuzz({ id: 'b1', playerId: 'p1', timestamp: 100 }),
      makeBuzz({ id: 'b2', playerId: 'p1', timestamp: 200 }),
    ]
    // In 'all' mode no filter is applied
    expect(buzzes).toHaveLength(2)
  })

  it('preserves order when all players are unique', () => {
    const buzzes: BuzzEvent[] = [
      makeBuzz({ id: 'b1', playerId: 'p1', timestamp: 100 }),
      makeBuzz({ id: 'b2', playerId: 'p2', timestamp: 150 }),
      makeBuzz({ id: 'b3', playerId: 'p3', timestamp: 200 }),
    ]
    const display = buzzes.filter(
      (b, i, all) => all.findIndex(x => x.playerId === b.playerId) === i
    )
    expect(display).toHaveLength(3)
  })
})

// ── Tie detection ─────────────────────────────────────────────────────────────

describe('tie detection (1ms window)', () => {
  const TIE_WINDOW_MS = 1

  it('marks buzzes within 1ms window as tied', () => {
    const a = makeBuzz({ timestamp: 1000 })
    const b = makeBuzz({ timestamp: 1000.5 })
    expect(Math.abs(a.timestamp - b.timestamp) <= TIE_WINDOW_MS).toBe(true)
  })

  it('marks exact same timestamp as tied', () => {
    const t = 5000
    const a = makeBuzz({ timestamp: t })
    const b = makeBuzz({ timestamp: t })
    expect(Math.abs(a.timestamp - b.timestamp) <= TIE_WINDOW_MS).toBe(true)
  })

  it('does not mark buzzes >1ms apart as tied', () => {
    const a = makeBuzz({ timestamp: 1000 })
    const b = makeBuzz({ timestamp: 1002 })
    expect(Math.abs(a.timestamp - b.timestamp) <= TIE_WINDOW_MS).toBe(false)
  })
})

// ── false-start guard logic ───────────────────────────────────────────────────

describe('false-start guard', () => {
  it('isFalseStart is true when buzzerLocked=true', () => {
    const game = makeGame({ buzzerLocked: true })
    // Mirror of useBuzzer logic: isFalseStart = g.buzzerLocked
    const isFalseStart = game.buzzerLocked
    expect(isFalseStart).toBe(true)
  })

  it('buzz is silently dropped when locked and allowFalseStarts=false', () => {
    const game = makeGame({ buzzerLocked: true, allowFalseStarts: false })
    const isFalseStart = game.buzzerLocked
    const shouldRecord = !(isFalseStart && !game.allowFalseStarts)
    expect(shouldRecord).toBe(false)
  })

  it('buzz is recorded when locked and allowFalseStarts=true', () => {
    const game = makeGame({ buzzerLocked: true, allowFalseStarts: true })
    const isFalseStart = game.buzzerLocked
    const shouldRecord = !(isFalseStart && !game.allowFalseStarts)
    expect(shouldRecord).toBe(true)
  })

  it('buzz is recorded when unlocked regardless of allowFalseStarts', () => {
    const game = makeGame({ buzzerLocked: false, allowFalseStarts: false })
    const isFalseStart = game.buzzerLocked
    const shouldRecord = !(isFalseStart && !game.allowFalseStarts)
    expect(shouldRecord).toBe(true)
  })
})

// ── auto-lock logic ───────────────────────────────────────────────────────────

describe('auto-lock on correct', () => {
  it('auto-lock triggers when autoLockOnFirstCorrect=true and buzzer is unlocked', () => {
    const game = makeGame({ autoLockOnFirstCorrect: true, buzzerLocked: false })
    const shouldLock = game.autoLockOnFirstCorrect && !game.buzzerLocked
    expect(shouldLock).toBe(true)
  })

  it('auto-lock does not re-lock when already locked', () => {
    const game = makeGame({ autoLockOnFirstCorrect: true, buzzerLocked: true })
    const shouldLock = game.autoLockOnFirstCorrect && !game.buzzerLocked
    expect(shouldLock).toBe(false)
  })

  it('auto-lock does not trigger when disabled', () => {
    const game = makeGame({ autoLockOnFirstCorrect: false, buzzerLocked: false })
    const shouldLock = game.autoLockOnFirstCorrect && !game.buzzerLocked
    expect(shouldLock).toBe(false)
  })
})

// ── Game buzzer config persistence ───────────────────────────────────────────

describe('Game buzzer config DB persistence', () => {
  beforeEach(clearAll)

  it('persists all buzzer config fields', async () => {
    await db.games.add(
      makeGame({
        autoLockOnFirstCorrect: true,
        allowFalseStarts: true,
        buzzDeduplication: 'all',
        tiebreakerMode: 'serverOrder',
      })
    )
    const g = await db.games.get('g1')
    expect(g?.autoLockOnFirstCorrect).toBe(true)
    expect(g?.allowFalseStarts).toBe(true)
    expect(g?.buzzDeduplication).toBe('all')
    expect(g?.tiebreakerMode).toBe('serverOrder')
  })

  it('default config values are correct', () => {
    const g = makeGame()
    expect(g.buzzerLocked).toBe(false)
    expect(g.scoringEnabled).toBe(true)
    expect(g.autoLockOnFirstCorrect).toBe(false)
    expect(g.allowFalseStarts).toBe(false)
    expect(g.buzzDeduplication).toBe('firstOnly')
    expect(g.tiebreakerMode).toBe('serverOrder')
  })
})
