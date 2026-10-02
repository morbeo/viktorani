import type {
  Game,
  ManagedPlayer,
  ManagedTeam,
  Player,
  PlayerPresence,
  Question,
  TargetVisibility,
  Team,
} from '@/db'
import type { GameEvent, SerializedGameState, VisibilityTarget } from '@/transport/types'
import {
  MAX_LOBBY_TEAMS,
  MAX_MEDIA_LENGTH,
  MAX_NAME_LENGTH,
  MAX_OPTIONS,
  MAX_TEXT_LENGTH,
} from '@/transport/messages'

/**
 * Serialises a Game + score map into the wire format broadcast to players
 * on GAME_STATE events. Pass the scores from `readScores` so they match the
 * latest SCORE_UPDATE. Pure function — no DB access, easy to test.
 */
export function serialiseGameState(
  game: Game,
  scores: Record<string, number>
): SerializedGameState {
  return {
    gameId: game.id,
    status: game.status,
    currentRoundIdx: game.currentRoundIdx,
    currentQuestionIdx: game.currentQuestionIdx,
    buzzerLocked: game.buzzerLocked,
    visibility: game.visibility,
    scores,
  }
}

/**
 * Builds the LOBBY_INFO a connecting player sees on the join screen: the teams that
 * still have room (`maxPerTeam`), whether individual play is allowed, and whether
 * another team may be created (`allowPlayerTeams` within `maxTeams`). The host still
 * checks every JOIN, so this only shapes the choices. Pure function.
 */
export function buildLobbyInfo(
  game: Game,
  teams: Team[],
  players: Player[]
): Extract<GameEvent, { type: 'LOBBY_INFO' }> {
  const open = teams.filter(
    t => game.maxPerTeam === 0 || players.filter(p => p.teamId === t.id).length < game.maxPerTeam
  )
  const listed = open.slice(0, MAX_LOBBY_TEAMS)
  const roomForTeam = game.maxTeams === 0 || teams.length < game.maxTeams
  return {
    type: 'LOBBY_INFO',
    teams: listed.map(t => ({ id: t.id, name: t.name.slice(0, MAX_NAME_LENGTH) })),
    allowIndividual: game.allowIndividual,
    allowPlayerTeams: game.allowPlayerTeams && roomForTeam,
  }
}

/** True/false questions store no options of their own. */
const TRUE_FALSE_OPTIONS = ['True', 'False']

/**
 * Builds the QUESTION_CONTENT for one target, leaving out everything the GM has hidden
 * there: the title and description need `showQuestion`, the options `showAnswers` and the
 * media `showMedia`. The correct answer is never sent, because showing the options must
 * not reveal it. Text is clipped to the transport limits and oversized media is dropped,
 * so the message always passes validation. Pure function.
 */
export function buildQuestionContent(
  question: Question,
  target: VisibilityTarget,
  flags: TargetVisibility
): Extract<GameEvent, { type: 'QUESTION_CONTENT' }> {
  const clip = (s: string) => s.slice(0, MAX_TEXT_LENGTH)
  const options =
    question.type === 'true_false'
      ? TRUE_FALSE_OPTIONS
      : question.type === 'multiple_choice'
        ? question.options
        : []
  const fits = question.media && question.media.length <= MAX_MEDIA_LENGTH
  const media = flags.showMedia && question.mediaType && fits ? question.media : null
  return {
    type: 'QUESTION_CONTENT',
    target,
    questionId: question.id,
    title: flags.showQuestion ? clip(question.title) : null,
    description: flags.showQuestion && question.description ? clip(question.description) : null,
    options:
      flags.showAnswers && options.length > 0 ? options.slice(0, MAX_OPTIONS).map(clip) : null,
    answer: null,
    media,
    mediaType: media ? question.mediaType : null,
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
    presence: 'connected',
    joinedAt: existing?.joinedAt ?? Date.now(),
  }
  const without = players.filter(p => p.id !== incoming.id)
  return [...without, record].sort((a, b) => a.joinedAt - b.joinedAt)
}

/**
 * Sets a player's presence in a player list. Returns a new array.
 */
export function setPlayerPresence(
  players: Player[],
  playerId: string,
  presence: PlayerPresence
): Player[] {
  return players.map(p => (p.id === playerId ? { ...p, presence } : p))
}

/** True while the player has a connection to the host, whether or not their tab is in view. */
export function isConnected(player: Player): boolean {
  return player.presence === 'connected' || player.presence === 'hidden'
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

/**
 * Returns the game's rounds in `roundIds` order. A round that no longer exists
 * gets a placeholder so the remaining rounds keep their positions.
 *
 * Pure function — no DB access.
 */
export function orderRounds(
  roundIds: string[],
  rounds: import('@/db').Round[]
): import('@/db').Round[] {
  const byId = new Map(rounds.map(r => [r.id, r]))
  return roundIds.map(
    id =>
      byId.get(id) ?? { id, name: 'Deleted round', description: '', questionIds: [], createdAt: 0 }
  )
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Applies a manual score delta, clamping the result to a minimum of `0`.
 *
 * Pure function — no DB access.
 */
export function applyScoreDelta(score: number, delta: number): number {
  return Math.max(0, score + delta)
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

// ── GameQuestion status transitions ──────────────────────────────────────────

export type QuestionStatus = import('@/db').GameQuestion['status']

/**
 * Valid transitions from a given status.
 * `pending` is the only allowed source state for GM rulings.
 * Once a question is ruled, the status is final (no re-ruling).
 */
const VALID_TRANSITIONS: Record<QuestionStatus, QuestionStatus[]> = {
  pending: ['correct', 'incorrect', 'skipped'],
  correct: [],
  incorrect: [],
  skipped: [],
}

/**
 * Returns the new status after a transition, or throws if the transition
 * is not permitted.
 *
 * Rules:
 * - Only `pending` questions may be transitioned.
 * - `correct`, `incorrect`, and `skipped` are terminal states.
 *
 * Pure function — no DB access.
 *
 * @throws {Error} when the transition is not in VALID_TRANSITIONS.
 */
export function transitionQuestionStatus(
  current: QuestionStatus,
  next: QuestionStatus
): QuestionStatus {
  const allowed = VALID_TRANSITIONS[current]
  if (!allowed.includes(next)) {
    throw new Error(`invalid transition: ${current} -> ${next}`)
  }
  return next
}

/**
 * Builds the game-scoped teams and players to add when importing the managed
 * (global) roster into a game session.
 *
 * Each imported record gets a **fresh** game-scoped id (via `newId`) so the same
 * managed record can be imported into more than one game without a primary-key
 * collision. Team membership is carried across by team *name*: a player is placed
 * on the session team matching the name of its first managed team. Records whose
 * name already exists in the session (teams or players) are skipped, so a repeat
 * import into the same game does not duplicate them.
 *
 * Pure function — no DB access. The caller persists the result inside a transaction.
 */
export function buildManagedImport(params: {
  managedTeams: ManagedTeam[]
  managedPlayers: ManagedPlayer[]
  existingTeams: Pick<Team, 'id' | 'name'>[]
  existingPlayerNames: Iterable<string>
  gameId: string
  now: number
  newId: () => string
}): { newTeams: Team[]; newPlayers: Player[] } {
  const { managedTeams, managedPlayers, existingTeams, gameId, now, newId } = params
  const managedTeamById = new Map(managedTeams.map(mt => [mt.id, mt]))
  const teamIdByName = new Map(existingTeams.map(t => [t.name, t.id]))

  const newTeams: Team[] = []
  for (const mt of managedTeams) {
    if (teamIdByName.has(mt.name)) continue
    const teamId = newId()
    teamIdByName.set(mt.name, teamId)
    newTeams.push({ id: teamId, gameId, name: mt.name, color: mt.color, icon: mt.icon, score: 0 })
  }

  const existingPlayerNames = new Set(params.existingPlayerNames)
  const newPlayers: Player[] = managedPlayers
    .filter(mp => !existingPlayerNames.has(mp.name))
    .map((mp, i) => {
      // Place the player on the session team named after its first managed team
      const sourceTeamId = mp.teamIds.find(tid => managedTeamById.has(tid))
      const teamName = sourceTeamId ? managedTeamById.get(sourceTeamId)!.name : null
      return {
        id: newId(),
        gameId,
        name: mp.name,
        teamId: (teamName && teamIdByName.get(teamName)) || null,
        score: 0,
        // Added by the host, not joined from a device
        presence: 'disconnected',
        deviceId: '',
        joinedAt: now + i,
      }
    })

  return { newTeams, newPlayers }
}
