import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  applyScoreDelta,
  buildNavSequence,
  getNavPosition,
  step,
  teamScore,
} from '@/pages/admin/gamemaster-utils'
import type { NavEntry } from '@/pages/admin/gamemaster-utils'
import type { GameQuestion, Round } from '@/db'

// ── Arbitraries ───────────────────────────────────────────────────────────────

const score = fc.nat({ max: 10_000 })
const delta = fc.integer({ min: -1_000, max: 1_000 })
const magnitude = fc.nat({ max: 1_000 })

const member = (teamId: fc.Arbitrary<string | null>) =>
  fc.record({ teamId, score: fc.nat({ max: 1_000 }) })

/**
 * A nav sequence built the way Games.tsx materialises it: one GameQuestion per
 * round question, `order` numbered globally across rounds. Rounds may be empty
 * (at least one question overall), and input order is shuffled because
 * buildNavSequence must not rely on DB return order.
 */
const navSeq: fc.Arbitrary<{ sizes: number[]; seq: NavEntry[] }> = fc
  .array(fc.nat({ max: 6 }), { minLength: 1, maxLength: 6 })
  .filter(sizes => sizes.some(n => n > 0))
  .chain(sizes => {
    const rounds: Round[] = sizes.map((_, r) => ({
      id: `r${r}`,
      name: `Round ${r}`,
      description: '',
      questionIds: [],
      createdAt: 0,
    }))
    let order = 0
    const gqs: GameQuestion[] = sizes.flatMap((n, r) =>
      Array.from({ length: n }, (_, q) => ({
        id: `gq${r}-${q}`,
        gameId: 'g1',
        questionId: `q${r}-${q}`,
        roundId: `r${r}`,
        order: order++,
        status: 'pending' as const,
      }))
    )
    return fc
      .shuffledSubarray(gqs, { minLength: gqs.length, maxLength: gqs.length })
      .map(shuffled => ({ sizes, seq: buildNavSequence(shuffled, rounds) }))
  })

/** A nav sequence plus a valid starting flat index. */
const navSeqWithStart = navSeq.chain(({ sizes, seq }) =>
  fc.nat({ max: seq.length - 1 }).map(start => ({ sizes, seq, start }))
)

const dir = fc.constantFrom<1 | -1>(1, -1)

// ── Scoring ───────────────────────────────────────────────────────────────────

describe('scoring properties', () => {
  it('score never drops below 0 for any sequence of adjustments', () => {
    fc.assert(
      fc.property(score, fc.array(delta), (start, deltas) => {
        let s = start
        for (const d of deltas) {
          s = applyScoreDelta(s, d)
          expect(s).toBeGreaterThanOrEqual(0)
        }
      })
    )
  })

  it('+X then −X returns to the original score', () => {
    fc.assert(
      fc.property(score, magnitude, (s, x) => {
        expect(applyScoreDelta(applyScoreDelta(s, x), -x)).toBe(s)
      })
    )
  })

  it('−X then +X yields max(original, X) because of the 0 floor', () => {
    fc.assert(
      fc.property(score, magnitude, (s, x) => {
        expect(applyScoreDelta(applyScoreDelta(s, -x), x)).toBe(Math.max(s, x))
      })
    )
  })

  it('adjustments are additive while the running score stays non-negative', () => {
    fc.assert(
      fc.property(score, fc.array(delta), (start, deltas) => {
        let running = start
        const neverClamped = deltas.every(d => (running += d) >= 0)
        fc.pre(neverClamped)
        const folded = deltas.reduce(applyScoreDelta, start)
        expect(folded).toBe(start + deltas.reduce((a, b) => a + b, 0))
      })
    )
  })

  it('team score is the sum of its members, regardless of order or other players', () => {
    const roster = fc
      .tuple(fc.array(member(fc.constant('t1'))), fc.array(member(fc.constantFrom('t2', null))))
      .chain(([team, others]) => {
        const all = [...team, ...others]
        return fc
          .shuffledSubarray(all, { minLength: all.length, maxLength: all.length })
          .map(mixed => ({ team, others, mixed }))
      })
    fc.assert(
      fc.property(roster, ({ team, others, mixed }) => {
        const expected = team.reduce((sum, p) => sum + p.score, 0)
        expect(teamScore(mixed, 't1')).toBe(expected)
        expect(teamScore(others, 't1')).toBe(0)
      })
    )
  })
})

// ── Navigation ────────────────────────────────────────────────────────────────

describe('navigation properties', () => {
  it('builds one entry per question, indexed in order, with rounds contiguous', () => {
    fc.assert(
      fc.property(navSeq, ({ sizes, seq }) => {
        expect(seq).toHaveLength(sizes.reduce((a, b) => a + b, 0))
        seq.forEach((e, i) => expect(e.flatIndex).toBe(i))
        const roundOrder = seq.map(e => e.roundIdx).filter((r, i, a) => i === 0 || r !== a[i - 1])
        expect(new Set(roundOrder).size).toBe(roundOrder.length)
      })
    )
  })

  it('always terminates at the first/last question from any start', () => {
    fc.assert(
      fc.property(navSeqWithStart, dir, ({ seq, start }, d) => {
        const end = d === 1 ? seq.length - 1 : 0
        let i = start
        for (let n = 0; n < seq.length && i !== end; n++) i = step(seq, i, d)
        expect(i).toBe(end)
        expect(step(seq, i, d)).toBe(end)
      })
    )
  })

  it('position stays within bounds for any sequence of moves', () => {
    fc.assert(
      fc.property(navSeqWithStart, fc.array(dir), ({ seq, start }, moves) => {
        let pos = getNavPosition(seq, start, -1)
        for (const d of moves) {
          pos = getNavPosition(seq, step(seq, pos.flatIndex, d), pos.roundIdx)
          expect(pos.flatIndex).toBeGreaterThanOrEqual(0)
          expect(pos.flatIndex).toBeLessThan(seq.length)
          expect(pos.questionIdx).toBeGreaterThanOrEqual(0)
          expect(pos.questionIdx).toBeLessThan(pos.roundQuestions)
          expect(pos.roundIdx).toBe(seq[pos.flatIndex].roundIdx)
        }
      })
    )
  })

  it('walking forward crosses into each subsequent round exactly once, at its first question', () => {
    fc.assert(
      fc.property(navSeq, ({ sizes, seq }) => {
        const nonEmptyRounds = sizes.filter(n => n > 0).length
        let pos = getNavPosition(seq, 0, -1)
        expect(pos.isRoundBoundary).toBe(false)
        let crossings = 0
        while (!pos.isLast) {
          pos = getNavPosition(seq, step(seq, pos.flatIndex, 1), pos.roundIdx)
          if (pos.isRoundBoundary) {
            crossings++
            expect(pos.questionIdx).toBe(0)
          }
        }
        expect(crossings).toBe(nonEmptyRounds - 1)
      })
    )
  })

  it('going back N then forward N lands on min(last, max(start, N))', () => {
    fc.assert(
      fc.property(navSeqWithStart, fc.nat({ max: 50 }), ({ seq, start }, n) => {
        let i = start
        for (let k = 0; k < n; k++) i = step(seq, i, -1)
        for (let k = 0; k < n; k++) i = step(seq, i, 1)
        expect(i).toBe(Math.min(seq.length - 1, Math.max(start, n)))
        if (n <= start) expect(i).toBe(start)
      })
    )
  })
})
