import { GAME_PHASES } from '@/db'
import type { GamePhase } from '@/db'

/**
 * Studio mode (ADR 0025): the screen surfaces (projector, remote screens, spectators and
 * scoreboard devices) keep the phase the GM last took, while the game master's window and
 * the phones follow the game. The GM previews the next layout and takes it with a cut or
 * one of the animated transitions.
 */

/**
 * How a take reaches the screens: `cut` at once; `fade` fades the layout in, `dip` comes up
 * from black, `slide` pushes in from the right, `zoom` grows into place and `wipe` is
 * revealed from the right edge.
 */
export const STUDIO_TRANSITIONS = ['cut', 'fade', 'dip', 'slide', 'zoom', 'wipe'] as const
export type StudioTransition = (typeof STUDIO_TRANSITIONS)[number]

/** The animated transitions, the ones the GM picks for a take. */
export type StudioMove = Exclude<StudioTransition, 'cut'>
export const STUDIO_MOVES: readonly StudioMove[] = ['fade', 'dip', 'slide', 'zoom', 'wipe']

/** What the GM sees each transition called. */
export const TRANSITION_LABELS: Record<StudioTransition, string> = {
  cut: 'Cut',
  fade: 'Fade',
  dip: 'Dip to black',
  slide: 'Slide',
  zoom: 'Zoom',
  wipe: 'Wipe',
}

/** How long an animated transition runs. */
export const STUDIO_SPEEDS = ['short', 'normal', 'slow'] as const
export type StudioSpeed = (typeof STUDIO_SPEEDS)[number]

/** What the GM sees each speed called. */
export const SPEED_LABELS: Record<StudioSpeed, string> = {
  short: 'Short',
  normal: 'Normal',
  slow: 'Slow',
}

/** The transition and speed the GM has picked for the next take. */
export interface StudioPick {
  transition: StudioMove
  speed: StudioSpeed
}

/** The pick before the GM chooses one: a normal fade, as before there was a choice. */
export const DEFAULT_PICK: StudioPick = { transition: 'fade', speed: 'normal' }

/** Studio mode for a game: the phase on the screens and how it got there. */
export interface StudioState {
  /** The phase the screens show (the program). */
  program: GamePhase
  /** How the latest take was made. */
  transition: StudioTransition
  /** How fast the latest take ran; absent is `normal`. */
  speed?: StudioSpeed
  /** What the panel's Take button plays next; absent is {@link DEFAULT_PICK}. */
  pick?: StudioPick
}

/** `value` when it is one of `options`, otherwise `undefined`. */
function oneOf<T extends string>(options: readonly T[], value: unknown): T | undefined {
  return options.find(o => o === value)
}

const studioKey = (gameId: string) => `viktorani:studio:${gameId}`

/** Parse a stored studio state, or `null` when off or unreadable. */
export function parseStudio(raw: string | null): StudioState | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    const program = oneOf(GAME_PHASES, value.program)
    if (!program) return null
    const state: StudioState = {
      program,
      transition: oneOf(STUDIO_TRANSITIONS, value.transition) ?? 'cut',
    }
    const speed = oneOf(STUDIO_SPEEDS, value.speed)
    if (speed) state.speed = speed
    const pick = value.pick as Record<string, unknown> | null | undefined
    const move = oneOf(STUDIO_MOVES, pick?.transition)
    if (move)
      state.pick = { transition: move, speed: oneOf(STUDIO_SPEEDS, pick?.speed) ?? 'normal' }
    return state
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

/** Whether `phase` is on the screens because of the latest take. */
const fromTake = (phase: GamePhase, studio: StudioState | null): studio is StudioState =>
  studio !== null && studio.program === phase

/**
 * The transition a screen applies when it shows `phase`: the take's own only when that
 * phase came from it, so a phase change outside a take still cuts.
 */
export function screenTransition(phase: GamePhase, studio: StudioState | null): StudioTransition {
  return fromTake(phase, studio) ? studio.transition : 'cut'
}

/** How fast a screen plays the transition to `phase` (see {@link screenTransition}). */
export function screenSpeed(phase: GamePhase, studio: StudioState | null): StudioSpeed {
  return fromTake(phase, studio) && studio.transition !== 'cut'
    ? (studio.speed ?? 'normal')
    : 'normal'
}

/** A take of the `live` phase with `transition`, keeping the GM's pick. */
export function take(
  live: GamePhase,
  studio: StudioState | null,
  transition: StudioTransition,
  speed: StudioSpeed = 'normal'
): StudioState {
  const state: StudioState = { program: live, transition }
  if (transition !== 'cut' && speed !== 'normal') state.speed = speed
  if (studio?.pick) state.pick = studio.pick
  return state
}
