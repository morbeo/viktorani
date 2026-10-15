import type { GamePhase, LayoutTarget } from '@/db'

/** Readable names for the game phases, for the phase pickers. */
export const PHASE_LABELS: Record<GamePhase, string> = {
  lobby: 'Lobby',
  question: 'Question',
  buzzed: 'Buzzed',
  reveal: 'Reveal',
  scoreboard: 'Scoreboard',
  ended: 'Game over',
}

/** Readable names for the surfaces a layout can be for. */
export const TARGET_LABELS: Record<LayoutTarget, string> = {
  gamemaster: 'Game master',
  player: 'Player phones',
  screen: 'Projector screen',
  scoreboard: 'Scoreboard',
}
