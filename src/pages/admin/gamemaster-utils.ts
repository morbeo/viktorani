import type { Game, Player, Team } from '@/db'
import type { SerializedGameState } from '@/transport/types'

/**
 * Serialises a Game + player list into the wire format broadcast to players
 * on GAME_STATE events. Pure function — no DB access, easy to test.
 */
export function serialiseGameState(game: Game, players: Player[]): SerializedGameState {
  const scores: Record<string, number> = {}
  for (const p of players) {
    scores[p.id] = p.score
  }

  return {
    gameId: game.id,
    status: game.status,
    currentRoundIdx: game.currentRoundIdx,
    currentQuestionIdx: game.currentQuestionIdx,
    buzzerLocked: game.buzzerLocked,
    showQuestion: game.showQuestion,
    showAnswers: game.showAnswers,
    showMedia: game.showMedia,
    scores,
  }
}

/**
 * Returns true when the lobby "Start game" button should be enabled.
 * Transport must be connected OR soloBypass is on; at least one active
 * player must be present OR soloBypass is on.
 */
export function canStartGame(params: {
  transportStatus: string
  activePlayers: number
  soloBypass: boolean
}): boolean {
  const { transportStatus, activePlayers, soloBypass } = params
  if (soloBypass) return true
  return transportStatus === 'connected' && activePlayers > 0
}

/**
 * Upserts a joining player into a player list, preserving existing score
 * and joinedAt. Returns a new sorted array.
 */
export function upsertPlayer(
  players: Player[],
  incoming: {
    id: string
    gameId: string
    name: string
    teamId: string | null
    deviceId: string
  }
): Player[] {
  const existing = players.find(p => p.id === incoming.id)
  const record: Player = {
    id: incoming.id,
    gameId: incoming.gameId,
    name: incoming.name,
    teamId: incoming.teamId,
    deviceId: incoming.deviceId,
    score: existing?.score ?? 0,
    isAway: false,
    joinedAt: existing?.joinedAt ?? Date.now(),
  }
  const without = players.filter(p => p.id !== incoming.id)
  return [...without, record].sort((a, b) => a.joinedAt - b.joinedAt)
}

/**
 * Marks a player as away in a player list. Returns a new array.
 */
export function markPlayerAway(players: Player[], playerId: string): Player[] {
  return players.map(p => (p.id === playerId ? { ...p, isAway: true } : p))
}

/**
 * Sets a player's isAway flag (on or off) in a player list. Returns a new array.
 */
export function setPlayerAway(players: Player[], playerId: string, away: boolean): Player[] {
  return players.map(p => (p.id === playerId ? { ...p, isAway: away } : p))
}

/**
 * Assigns a player to a team (or clears the team when teamId is null).
 * Returns a new array with the player's teamId updated.
 */
export function assignPlayerTeam(
  players: Player[],
  playerId: string,
  teamId: string | null
): Player[] {
  return players.map(p => (p.id === playerId ? { ...p, teamId } : p))
}

// ── Cap enforcement ───────────────────────────────────────────────────────────

/**
 * Returns true when a new team may be created given the current game config
 * and the number of existing teams.
 *
 * `maxTeams === 0` means unlimited.
 */
export function canCreateTeam(game: Pick<Game, 'maxTeams'>, currentTeamCount: number): boolean {
  if (game.maxTeams === 0) return true
  return currentTeamCount < game.maxTeams
}

/**
 * Returns true when `playerId` may be assigned to `team`.
 *
 * Checks:
 * - `maxPerTeam === 0` means unlimited.
 * - Does not double-count the player if they are already on this team.
 */
export function canAssignToTeam(
  game: Pick<Game, 'maxPerTeam'>,
  team: Team,
  players: Player[],
  playerId: string
): boolean {
  if (game.maxPerTeam === 0) return true
  const members = players.filter(p => p.teamId === team.id && p.id !== playerId)
  return members.length < game.maxPerTeam
}

// ── Navigation types ──────────────────────────────────────────────────────────

/**
 * One entry in the flat navigation sequence — a single question slot with
 * its resolved round context pre-computed.
 */
export interface NavEntry {
  flatIndex: number // position across all questions in the game (0-based)
  roundIdx: number // which round this question belongs to (0-based)
  roundId: string
  roundName: string
  questionId: string
  gameQuestionId: string
  questionStatus: import('@/db').GameQuestion['status']
}

// ── buildNavSequence ──────────────────────────────────────────────────────────

/**
 * Builds a flat ordered navigation sequence from gameQuestions and rounds.
 * GameQuestions are sorted by their `order` field. Each entry carries the
 * resolved round name and index so nav components never need to re-query.
 *
 * Pure function — no DB access.
 */
export function buildNavSequence(
  gameQuestions: import('@/db').GameQuestion[],
  rounds: import('@/db').Round[]
): NavEntry[] {
  const roundIndex = new Map(rounds.map((r, i) => [r.id, { name: r.name, idx: i }]))
  const sorted = [...gameQuestions].sort((a, b) => a.order - b.order)

  return sorted.map((gq, flatIndex) => {
    const round = roundIndex.get(gq.roundId)
    return {
      flatIndex,
      roundIdx: round?.idx ?? 0,
      roundId: gq.roundId,
      roundName: round?.name ?? 'Round',
      questionId: gq.questionId,
      gameQuestionId: gq.id,
      questionStatus: gq.status,
    }
  })
}

// ── Navigation position ───────────────────────────────────────────────────────

export interface NavPosition {
  flatIndex: number
  roundIdx: number
  questionIdx: number // position within the current round (0-based)
  roundQuestions: number // total questions in current round
  isFirst: boolean
  isLast: boolean
  isRoundBoundary: boolean // true when this move crossed a round boundary
}

/**
 * Computes the NavPosition for a given flat index within a sequence.
 * `prevRoundIdx` is needed to detect boundary crossings — pass the
 * round index of the *previous* position, or -1 on the first call.
 *
 * Pure function — no DB access.
 */
export function getNavPosition(
  seq: NavEntry[],
  flatIndex: number,
  prevRoundIdx: number
): NavPosition {
  const entry = seq[flatIndex]
  const roundIdx = entry?.roundIdx ?? 0
  const roundId = entry?.roundId ?? ''
  const inRound = seq.filter(e => e.roundId === roundId)
  const questionIdx = inRound.findIndex(e => e.flatIndex === flatIndex)

  return {
    flatIndex,
    roundIdx,
    questionIdx: questionIdx === -1 ? 0 : questionIdx,
    roundQuestions: inRound.length,
    isFirst: flatIndex === 0,
    isLast: flatIndex === seq.length - 1,
    isRoundBoundary: prevRoundIdx !== -1 && roundIdx !== prevRoundIdx,
  }
}

/**
 * Returns the next flat index when moving forward (+1) or backward (-1),
 * clamped to [0, seq.length - 1].
 */
export function step(seq: NavEntry[], flatIndex: number, dir: 1 | -1): number {
  return Math.max(0, Math.min(seq.length - 1, flatIndex + dir))
}
