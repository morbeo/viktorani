/**
 * Types for the Players & Teams epic (issue #108).
 *
 * These are the *management-layer* entities — distinct from the
 * session-scoped {@link Player} and {@link Team} records in {@link ViktoraniDB}
 * which are created per-game by the GameMaster epic.
 *
 * Naming convention:
 *   - `ManagedPlayer` / `ManagedTeam` — stored in IndexedDB, long-lived.
 *   - `GameLogEntry`  — written by the GameMaster epic; schema owned here.
 */

// ── Game log ─────────────────────────────────────────────────────────────────

/**
 * One entry in a player's or team's participation history.
 * Written by the GameMaster epic; the Players & Teams epic owns the schema.
 */
export interface GameLogEntry {
  /** ID of the {@link Game} this entry belongs to. */
  gameId: string
  date: Date
  /** Points scored in this game. */
  score: number
  /** Human-readable event name (e.g. "Quiz Night #12"), or null. */
  eventName: string | null
  /**
   * Which management-layer team the player played for in this game session.
   * Resolved at game-start when a player belongs to multiple teams.
   * Stored here so the log reflects the actual session context.
   */
  resolvedTeamId: string | null
}

// ── Label ────────────────────────────────────────────────────────────────────

/** A reusable colour label that can be attached to players or teams. */
export interface ManagedLabel {
  id: string
  name: string
  /** CSS hex colour (e.g. `'#6366f1'`). */
  color: string
}

// ── Player ───────────────────────────────────────────────────────────────────

/**
 * A long-lived player profile managed outside of any single game session.
 *
 * @remarks
 * A player may belong to multiple teams simultaneously (many-to-many).
 * The bidirectional relationship with {@link ManagedTeam.playerIds} must be
 * kept in sync atomically — use `syncPlayerTeams()` from `src/db/players-teams.ts`.
 *
 * `totalScore` and `gameLog` are read-only from this epic; written by GameMaster.
 */
export interface ManagedPlayer {
  id: string
  name: string
  /** IDs of all {@link ManagedTeam}s this player currently belongs to. */
  teamIds: string[]
  /** IDs of {@link ManagedLabel}s attached to this player. */
  labelIds: string[]
  /** ISO timestamp when this player was archived, or `null` if active. */
  archivedAt: Date | null
  /** Cumulative score across all game sessions. Updated by GameMaster epic. */
  totalScore: number
  /** Ordered participation history. Updated by GameMaster epic. */
  gameLog: GameLogEntry[]
}

// ── Team ─────────────────────────────────────────────────────────────────────

/**
 * A long-lived team profile managed outside of any single game session.
 *
 * @remarks
 * `playerIds` mirrors `ManagedPlayer.teamIds` — keep in sync atomically via
 * `syncPlayerTeams()`.
 */
export interface ManagedTeam {
  id: string
  name: string
  /** CSS hex colour for the team badge (e.g. `'#3a57b7'`). */
  color: string
  /** Lucide icon key (e.g. `'Zap'`, `'Shield'`). */
  icon: string
  /** IDs of {@link ManagedLabel}s attached to this team. */
  labelIds: string[]
  /** IDs of {@link ManagedPlayer}s on this team. */
  playerIds: string[]
  /** ISO timestamp when this team was archived, or `null` if active. */
  archivedAt: Date | null
  /** Cumulative score across all game sessions. Updated by GameMaster epic. */
  totalScore: number
  /** Ordered participation history. Updated by GameMaster epic. */
  gameLog: GameLogEntry[]
}

// ── QR payload schemas ────────────────────────────────────────────────────────

/**
 * QR payload for a single player profile.
 * Scanned by an admin to import or merge a player record.
 */
export interface PlayerQrPayload {
  type: 'viktorani/player/v1'
  id: string
  name: string
  /** Label *names* (not IDs) so the payload is self-contained across instances. */
  labels: string[]
}

/**
 * QR payload for a team including a snapshot of its current roster.
 * Scanned by an admin to import the whole team in one action.
 *
 * @remarks
 * The roster snapshot is generated fresh when the QR modal opens,
 * so it always reflects the current state of `ManagedTeam.playerIds`.
 */
export interface TeamQrPayload {
  type: 'viktorani/team/v1'
  id: string
  name: string
  color: string
  icon: string
  /** Label names (not IDs). */
  labels: string[]
  /** Minimal player stubs embedded so the team can be imported standalone. */
  players: Array<{ id: string; name: string }>
}

/** Union of all valid QR payload types. Use the `type` field as a discriminant. */
export type QrPayload = PlayerQrPayload | TeamQrPayload

// ── Type guards ───────────────────────────────────────────────────────────────

/** Narrows an unknown value to {@link PlayerQrPayload}. */
export function isPlayerQrPayload(v: unknown): v is PlayerQrPayload {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as Record<string, unknown>)['type'] === 'viktorani/player/v1'
  )
}

/** Narrows an unknown value to {@link TeamQrPayload}. */
export function isTeamQrPayload(v: unknown): v is TeamQrPayload {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as Record<string, unknown>)['type'] === 'viktorani/team/v1'
  )
}
