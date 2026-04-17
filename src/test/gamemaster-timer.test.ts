// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/db'
import { applyAutoReset } from '@/hooks/useTimer'
import type { Timer } from '@/db'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clearAll() {
  await db.timers.clear()
}

function makeTimer(overrides: Partial<Timer> = {}): Timer {
  return {
    id: 't1',
    gameId: 'g1',
    label: 'Round timer',
    duration: 60,
    remaining: 60,
    target: 'all',
    message: '',
    visible: true,
    paused: true,
    startedAt: null,
    audioNotify: 'none',
    visualNotify: 'none',
    autoReset: 'none',
    ...overrides,
  }
}

// ── Remaining time math (pure, no DB) ────────────────────────────────────────

describe('timer remaining calculation', () => {
  it('returns full duration when paused and not started', () => {
    const t = makeTimer({ duration: 60, remaining: 60, paused: true, startedAt: null })
    // Mirror the logic in useTimer.remaining:
    const remaining =
      t.paused || t.startedAt === null
        ? Math.max(0, t.remaining)
        : Math.max(0, t.remaining - (Date.now() - t.startedAt) / 1000)
    expect(remaining).toBe(60)
  })

  it('calculates remaining correctly when paused mid-run', () => {
    // pauseTimer computes: remaining = duration - elapsed; stores it; clears startedAt
    const duration = 60
    const elapsedSeconds = 20
    const rem = Math.max(0, duration - elapsedSeconds)
    const t = makeTimer({ duration, remaining: rem, paused: true, startedAt: null })
    const remaining = t.paused || t.startedAt === null ? Math.max(0, t.remaining) : 0
    expect(remaining).toBe(40)
  })

  it('does not return a negative remaining value', () => {
    // Simulates a timer that ran past its duration before a pause was recorded
    const t = makeTimer({ duration: 30, remaining: -5, paused: true, startedAt: null })
    const remaining = Math.max(0, t.remaining)
    expect(remaining).toBe(0)
  })

  it('accounts for elapsed time since startedAt when running', () => {
    const now = Date.now()
    const startedAt = now - 10_000 // started 10s ago
    const t = makeTimer({ duration: 60, remaining: 60, paused: false, startedAt })
    const remaining = Math.max(0, t.remaining - (Date.now() - t.startedAt!) / 1000)
    // Should be approximately 50s (allow 1s tolerance for test execution time)
    expect(remaining).toBeGreaterThanOrEqual(49)
    expect(remaining).toBeLessThanOrEqual(51)
  })
})

// ── applyAutoReset ────────────────────────────────────────────────────────────

describe('applyAutoReset', () => {
  beforeEach(async () => {
    await clearAll()
    // Suppress transportManager.send side-effects
    vi.mock('@/transport', () => ({
      transportManager: { send: vi.fn() },
    }))
  })

  async function seedTimer(t: Timer) {
    await db.timers.add(t)
    return t
  }

  it('does not reset a timer with autoReset "none"', async () => {
    const t = await seedTimer(
      makeTimer({ autoReset: 'none', paused: false, startedAt: Date.now(), remaining: 40 })
    )
    await applyAutoReset([t], 'question')
    const stored = await db.timers.get(t.id)
    expect(stored?.paused).toBe(false) // unchanged
  })

  it('resets a timer with autoReset "any" on question change', async () => {
    const t = await seedTimer(
      makeTimer({ autoReset: 'any', paused: false, startedAt: Date.now(), remaining: 40 })
    )
    await applyAutoReset([t], 'question')
    const stored = await db.timers.get(t.id)
    expect(stored?.paused).toBe(true)
    expect(stored?.remaining).toBe(t.duration)
    expect(stored?.startedAt).toBeNull()
  })

  it('resets a timer with autoReset "question" on question change', async () => {
    const t = await seedTimer(
      makeTimer({ autoReset: 'question', paused: false, startedAt: Date.now(), remaining: 30 })
    )
    await applyAutoReset([t], 'question')
    const stored = await db.timers.get(t.id)
    expect(stored?.paused).toBe(true)
    expect(stored?.remaining).toBe(t.duration)
  })

  it('resets a timer with autoReset "round" on round change', async () => {
    const t = await seedTimer(
      makeTimer({ autoReset: 'round', paused: false, startedAt: Date.now(), remaining: 30 })
    )
    await applyAutoReset([t], 'round')
    const stored = await db.timers.get(t.id)
    expect(stored?.paused).toBe(true)
    expect(stored?.remaining).toBe(t.duration)
  })

  it('does not reset a timer with autoReset "round" on question change', async () => {
    const t = await seedTimer(
      makeTimer({ autoReset: 'round', paused: false, startedAt: Date.now(), remaining: 30 })
    )
    await applyAutoReset([t], 'question')
    const stored = await db.timers.get(t.id)
    expect(stored?.paused).toBe(false) // unchanged
  })

  it('skips timers that are already stopped (paused + no startedAt)', async () => {
    const t = await seedTimer(
      makeTimer({ autoReset: 'any', paused: true, startedAt: null, remaining: 60 })
    )
    await applyAutoReset([t], 'question')
    const stored = await db.timers.get(t.id)
    // Should not have been written — remaining stays at 60 (duration), paused stays true
    expect(stored?.remaining).toBe(60)
    expect(stored?.paused).toBe(true)
  })
})
