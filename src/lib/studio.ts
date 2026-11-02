import { GAME_PHASES } from '@/db'
import type { GamePhase } from '@/db'

/**
 * Studio mode (ADR 0025): the screen surfaces (projector, remote screens, spectators and
 * scoreboard devices) keep the phase the GM last took, while the game master's window and
 * the phones follow the game. The GM previews the next layout and takes it with a cut or a
 * fade.
 */

/** How a take reaches the screens: at once, or fading in. */
export type StudioTransition = 'cut' | 'fade'

/** Studio mode for a game: the phase on the screens and how it got there. */
export interface StudioState {
  /** The phase the screens show (the program). */
  program: GamePhase
  /** How the latest take was made. */
  transition: StudioTransition
}

const studioKey = (gameId: string) => `viktorani:studio:${gameId}`

/** Parse a stored studio state, or `null` when off or unreadable. */
export function parseStudio(raw: string | null): StudioState | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<StudioState>
    const program = GAME_PHASES.find(p => p === value.program)
    if (!program) return null
    return { program, transition: value.transition === 'fade' ? 'fade' : 'cut' }
  } catch {
    return null
  }
}

/** The raw stored studio state for `gameId`, `null` when studio mode is off. */
export function readStudioRaw(gameId: string): string | null {
  try {
    return localStorage.getItem(studioKey(gameId))
  } catch {
    return null
  }
}

/** Studio mode for `gameId`, or `null` when it's off. */
export function readStudio(gameId: string): StudioState | null {
  return parseStudio(readStudioRaw(gameId))
}

const listeners = new Set<() => void>()

/** Turn studio mode on with `state`, or off with `null`. */
export function writeStudio(gameId: string, state: StudioState | null): void {
  try {
    if (state) localStorage.setItem(studioKey(gameId), JSON.stringify(state))
    else localStorage.removeItem(studioKey(gameId))
  } catch {
    // Storage unavailable: studio mode can't be kept
  }
  for (const listener of listeners) listener()
}

/** Call `listener` when studio mode changes, in this window or another on this machine. */
export function subscribeStudio(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

/**
 * The phase the screen surfaces show, given the phase the game is in (`live`, after the
 * GM's override) and studio mode.
 *
 * @remarks
 * Without studio mode the screens follow the game. The lobby and the end always show their
 * own phase, as with the override (ADR 0019), so starting or ending the game is a take of
 * its own; a program left at one of them falls back to the live phase.
 */
export function programPhase(live: GamePhase, studio: StudioState | null): GamePhase {
  if (!studio || live === 'lobby' || live === 'ended') return live
  if (studio.program === 'lobby' || studio.program === 'ended') return live
  return studio.program
}

/**
 * The transition a screen applies when it shows `phase`: `fade` only when that phase came
 * from a fade take, so a phase change outside a take still cuts.
 */
export function screenTransition(phase: GamePhase, studio: StudioState | null): StudioTransition {
  return studio && studio.program === phase && studio.transition === 'fade' ? 'fade' : 'cut'
}
