import type { BuzzEvent, GameLogEntry, GameLogKind, GmDecision, ScoreEvent } from '@/db'
import { MAX_LOG_TEXT_LENGTH } from '@/transport/messages'
import { PUBLIC_LOG_KINDS } from '@/transport/types'
import type { LogEntry, PublicLogKind } from '@/transport/types'

/** A row of the game log view: a log entry, a buzz, a ruling or a score change. */
export type LogRowKind = GameLogKind | 'buzz' | 'false_start' | 'ruling' | 'score_changed'

export interface LogRow {
  id: string
  at: number
  kind: LogRowKind
  /** The player or team involved; empty for host-only actions. */
  who: string
  details: string
  /** The round name, when the row can be tied to one; empty otherwise. */
  round?: string
}

export const LOG_KIND_LABELS: Record<LogRowKind, string> = {
  game_started: 'Game started',
  game_paused: 'Game paused',
  game_resumed: 'Game resumed',
  game_ended: 'Game ended',
  question_shown: 'Question shown',
  round_changed: 'Round changed',
  player_joined: 'Joined',
  player_rejoined: 'Rejoined',
  join_approved: 'Join approved',
  join_rejected: 'Join rejected',
  player_hidden: 'Left the tab',
  player_back: 'Back on the tab',
  player_disconnected: 'Disconnected',
  player_left: 'Left',
  player_kicked: 'Kicked',
  team_created: 'Team created',
  buzzer_locked: 'Buzzer locked',
  buzzer_unlocked: 'Buzzer unlocked',
  buzzes_cleared: 'Buzzes cleared',
  timer_started: 'Timer started',
  timer_paused: 'Timer paused',
  timer_resumed: 'Timer resumed',
  timer_reset: 'Timer reset',
  timer_expired: 'Timer expired',
  visibility_changed: 'Visibility changed',
  screen_approved: 'Screen approved',
  screen_rejected: 'Screen rejected',
  screen_disconnected: 'Screen disconnected',
  buzz: 'Buzz',
  false_start: 'False start',
  ruling: 'Ruling',
  score_changed: 'Score changed',
}

const VISIBILITY_ITEMS: Record<string, string> = {
  showQuestion: 'Question text',
  showAnswers: 'Answers',
  showMedia: 'Media',
}

const RULINGS: Record<GmDecision, string> = {
  Correct: 'Correct',
  Incorrect: 'Wrong',
  Skip: 'Skipped',
}

const SCORE_REASONS: Record<ScoreEvent['reason'], string> = {
  step: 'adjusted',
  set: 'set',
  correct: 'correct answer',
}

function logDetails(e: GameLogEntry): string {
  const d = e.data
  switch (e.kind) {
    case 'question_shown':
      return `${d.round} · Q${d.question}`
    case 'round_changed':
      return String(d.round ?? '')
    case 'join_rejected':
      return d.reason ? String(d.reason) : 'By the host'
    case 'buzzes_cleared':
      return `${d.count} removed`
    case 'visibility_changed': {
      const item = VISIBILITY_ITEMS[String(d.item)] ?? String(d.item)
      const where = d.target === 'screen' ? 'the screen' : 'player devices'
      return `${item} ${d.shown ? 'shown' : 'hidden'} on ${where}`
    }
    default:
      return typeof d.label === 'string' ? d.label : ''
  }
}

function logRound(e: GameLogEntry, roundByQuestion: Map<string, string>): string {
  if (e.kind === 'round_changed') return typeof e.data.round === 'string' ? e.data.round : ''
  return (e.subjectId && roundByQuestion.get(e.subjectId)) || ''
}

/**
 * Combine a game's log with its buzzes, rulings and score changes, newest first.
 * `names` maps player and team ids to their current names, for entries that store none.
 * `roundByQuestion` maps question ids to the name of the round they belong to, so rows
 * tied to a question (or the round-change event itself) can be filtered by round.
 */
export function buildLogRows(
  log: GameLogEntry[],
  buzzes: BuzzEvent[],
  scores: ScoreEvent[],
  names: Map<string, string>,
  roundByQuestion: Map<string, string> = new Map()
): LogRow[] {
  const rows: LogRow[] = log.map(e => ({
    id: e.id,
    at: e.at,
    kind: e.kind,
    who:
      typeof e.data.name === 'string'
        ? e.data.name
        : (names.get(e.subjectId ?? e.actorId ?? '') ?? ''),
    details: logDetails(e),
    round: logRound(e, roundByQuestion),
  }))
  for (const b of buzzes) {
    rows.push({
      id: b.id,
      at: b.receivedAt,
      kind: b.isFalseStart ? 'false_start' : 'buzz',
      who: b.playerName,
      details: '',
      round: roundByQuestion.get(b.questionId) ?? '',
    })
    if (b.gmDecision && b.decidedAt !== null) {
      rows.push({
        id: `${b.id}:ruling`,
        at: b.decidedAt,
        kind: 'ruling',
        who: b.playerName,
        details: RULINGS[b.gmDecision],
        round: roundByQuestion.get(b.questionId) ?? '',
      })
    }
  }
  for (const s of scores) {
    rows.push({
      id: s.id,
      at: s.timestamp,
      kind: 'score_changed',
      who: s.name,
      details: `${s.from} → ${s.to} (${SCORE_REASONS[s.reason]})`,
      round: (s.questionId && roundByQuestion.get(s.questionId)) || '',
    })
  }
  return rows.sort((a, b) => b.at - a.at)
}

// A spreadsheet runs a cell starting with one of these as a formula
const FORMULA_START = /^[=+\-@\t\r]/

function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

/** The rows as CSV, oldest first, with a header line. */
export function logRowsToCsv(rows: LogRow[]): string {
  const lines = [['Time', 'Event', 'Who', 'Details'].map(csvCell).join(',')]
  for (const r of [...rows].reverse()) {
    lines.push(
      [new Date(r.at).toISOString(), LOG_KIND_LABELS[r.kind], r.who, r.details]
        .map(csvCell)
        .join(',')
    )
  }
  return lines.join('\r\n') + '\r\n'
}

/** The rows as JSON, oldest first. */
export function logRowsToJson(rows: LogRow[]): string {
  const entries = [...rows].reverse().map(r => ({
    time: new Date(r.at).toISOString(),
    kind: r.kind,
    event: LOG_KIND_LABELS[r.kind],
    who: r.who,
    details: r.details,
  }))
  return JSON.stringify(entries, null, 2)
}

/** Download a game's log as a CSV or JSON file. */
export function downloadGameLog(rows: LogRow[], gameName: string, format: 'csv' | 'json'): void {
  const blob =
    format === 'csv'
      ? new Blob([logRowsToCsv(rows)], { type: 'text/csv' })
      : new Blob([logRowsToJson(rows)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeName = gameName.replace(/[^a-z0-9\-_. ]/gi, '_').trim() || 'game'
  a.download = `${safeName}-log-${new Date().toISOString().slice(0, 10)}.${format}`
  a.click()
  URL.revokeObjectURL(url)
}

const PUBLIC_LOG_KIND_SET = new Set<string>(PUBLIC_LOG_KINDS)

function isPublicLogKind(kind: LogRowKind): kind is PublicLogKind {
  return PUBLIC_LOG_KIND_SET.has(kind)
}

/**
 * The most recent rows safe to broadcast to screens (see {@link PUBLIC_LOG_KINDS}), in the
 * `LOG` transport shape, capped to `limit` entries. `rows` must be newest first.
 */
export function toPublicLogEntries(rows: LogRow[], limit: number): LogEntry[] {
  const out: LogEntry[] = []
  for (const r of rows) {
    if (out.length >= limit) break
    if (!isPublicLogKind(r.kind)) continue
    out.push({
      id: r.id,
      at: r.at,
      kind: r.kind,
      who: r.who.slice(0, MAX_LOG_TEXT_LENGTH),
      details: r.details.slice(0, MAX_LOG_TEXT_LENGTH),
    })
  }
  return out
}
