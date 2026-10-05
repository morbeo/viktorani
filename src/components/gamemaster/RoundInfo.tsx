import type { NavEntry, NavPosition } from '@/pages/admin/gamemaster-utils'

/** The current round name and question position, e.g. "Round 1 · Q 2 of 5 (2 / 8 total)". */
export function RoundInfo({ pos, seq }: { pos: NavPosition; seq: NavEntry[] }) {
  return (
    <div style={{ color: 'var(--color-muted)' }} className="text-sm">
      {seq[pos.flatIndex]?.roundName} · Q {pos.questionIdx + 1} of {pos.roundQuestions}
      <span className="ml-3 text-xs">
        ({pos.flatIndex + 1} / {seq.length} total)
      </span>
    </div>
  )
}
