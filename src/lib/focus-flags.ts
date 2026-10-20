import type { GameLogEntry, Player, Team } from '@/db'

/** One time a player left the game while it was running. */
export interface FocusLapse {
  playerId: string
  /** When they left. */
  at: number
  /** How long they were gone, or `null` while they still are. */
  awayMs: number | null
  /** The round and question number shown when they left, or `null` before the first one. */
  round: string | null
  question: number | null
}

/** The lapses of one team, or of one player without a team. */
export interface FocusFlag {
  /** The team's id, or the player's when they have no team. */
  id: string
  name: string
  color: string | null
  lapses: FocusLapse[]
  /** Time away over the finished lapses. */
  awayMs: number
}

// Leaving the connection also ends a lapse: phones often drop a page left in the background
const ENDS_LAPSE = new Set(['player_back', 'player_disconnected', 'player_left', 'player_kicked'])

/**
 * Times players left the game screen, read from the game log. Only lapses while the game
 * runs count: not in the lobby, while paused or after the end. Each lapse carries the
 * question shown when it started.
 */
export function buildFocusLapses(entries: readonly GameLogEntry[]): FocusLapse[] {
  const sorted = [...entries].sort((a, b) => a.at - b.at)
  const lapses: FocusLapse[] = []
  const open = new Map<string, FocusLapse>()
  let running = false
  let round: string | null = null
  let question: number | null = null

  for (const e of sorted) {
    switch (e.kind) {
      case 'game_started':
      case 'game_resumed':
        running = true
        break
      case 'game_paused':
      case 'game_ended':
        running = false
        break
      case 'question_shown':
        round = typeof e.data.round === 'string' ? e.data.round : null
        question = typeof e.data.question === 'number' ? e.data.question : null
        break
    }
    const playerId = e.subjectId
    if (!playerId) continue
    if (e.kind === 'player_hidden' && running && !open.has(playerId)) {
      const lapse: FocusLapse = { playerId, at: e.at, awayMs: null, round, question }
      lapses.push(lapse)
      open.set(playerId, lapse)
    } else if (ENDS_LAPSE.has(e.kind)) {
      const lapse = open.get(playerId)
      if (lapse) lapse.awayMs = e.at - lapse.at
      open.delete(playerId)
    }
  }
  return lapses
}

/**
 * Groups lapses by team (players without a team stand alone), most lapses first. Teams
 * and players with no lapses are left out.
 */
export function buildFocusFlags(
  lapses: readonly FocusLapse[],
  players: readonly Pick<Player, 'id' | 'name' | 'teamId'>[],
  teams: readonly Pick<Team, 'id' | 'name' | 'color'>[]
): FocusFlag[] {
  const flags = new Map<string, FocusFlag>()
  for (const lapse of lapses) {
    const player = players.find(p => p.id === lapse.playerId)
    const team = player?.teamId ? teams.find(t => t.id === player.teamId) : undefined
    const id = team?.id ?? lapse.playerId
    let flag = flags.get(id)
    if (!flag) {
      flag = {
        id,
        name: team?.name ?? player?.name ?? 'Unknown player',
        color: team?.color ?? null,
        lapses: [],
        awayMs: 0,
      }
      flags.set(id, flag)
    }
    flag.lapses.push(lapse)
    flag.awayMs += lapse.awayMs ?? 0
  }
  return [...flags.values()].sort(
    (a, b) => b.lapses.length - a.lapses.length || b.awayMs - a.awayMs
  )
}

/** A short duration: `45s`, `2m 05s`. */
export function formatAway(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}
