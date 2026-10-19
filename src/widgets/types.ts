import type { ComponentType, ReactNode } from 'react'
import type { QuestionRuling, RulingAward } from '@/db/rulings'
import type { z } from 'zod'
import type {
  BuzzEvent,
  Game,
  GameQuestion,
  GmDecision,
  LayoutTarget,
  Player,
  Question,
  Team,
  WidgetType,
} from '@/db'
import type { GameEvent, LogEntry, ScoreboardRow } from '@/transport/types'
import type { GridSize } from '@/lib/layout-grid'
import type { NavEntry, NavPosition } from '@/pages/admin/gamemaster-utils'
import type { UseTimerListResult } from '@/hooks/useTimer'

/** Surfaces a widget can be placed on: the same set as `Layout.target`. */
export type WidgetTarget = LayoutTarget

/**
 * Everything the registry knows about one {@link WidgetType}.
 *
 * @remarks
 * `components` has one entry per target the widget is allowed on. Real ones are adapters
 * that take {@link WidgetProps} (the surface's {@link SurfaceData} plus the widget's config)
 * and render an existing component; the rest are still `WidgetPlaceholder`s until the
 * designer (#412) needs them. Props are untyped here (`ComponentType<any>`) because each
 * target's adapters take a different data contract; `LayoutRenderer` supplies the right one.
 */
export interface WidgetDefinition<TConfig = Record<string, unknown>> {
  type: WidgetType
  label: string
  allowedTargets: readonly WidgetTarget[]
  /** Size a newly placed widget gets on the 12-column grid. */
  preferredSize: GridSize
  configSchema: z.ZodType<TConfig>
  defaultConfig: TConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components: Partial<Record<WidgetTarget, ComponentType<any>>>
}

/** What a projector screen knows about the game, as handed to its widgets. */
export interface ScreenData {
  /** Shown above the question, e.g. the round and question number, "Paused" or "Game over". */
  heading: string | null
  /** The current question, as far as the `screen` visibility allows. */
  content: Extract<GameEvent, { type: 'QUESTION_CONTENT' }> | null
  /** The host's message to the screens. */
  message: string | null
  /** Ranked names and scores; empty when scoring is off. */
  rows: ScoreboardRow[]
  /** Recent public game events, newest first. */
  logEntries: LogEntry[]
  /**
   * The surface's timers, already rendered: the host's projector window reads them from the
   * database and a remote screen from the transport, so each surface supplies its own.
   */
  timers: ReactNode
}

/** What the game master's play column knows about the game, as handed to its widgets. */
export interface GamemasterData {
  game: Game
  /** Receives each saved game patch, e.g. a visibility toggle; the page merges it in. */
  onGameChange: (patch: Partial<Game>) => void
  /** Where navigation is, for the round and question position. */
  pos: NavPosition
  seq: NavEntry[]
  /** Moves to the previous or next question, as the header's arrows do. */
  nav: { onPrev: () => void; onNext: () => void }
  /** The id of the question navigation is on, even while it loads. */
  questionId: string | null
  /** The current question and its per-game record, once both have loaded. */
  question: Question | null
  gameQuestion: GameQuestion | null
  buzzer: {
    buzzes: BuzzEvent[]
    displayBuzzes: BuzzEvent[]
    onToggleLock: () => void
    onAdjudicate: (buzzId: string, decision: GmDecision) => void
    onClear: () => void
  }
  /** The game's timers and their controls. */
  timers: UseTimerListResult
  /** Everyone who has joined the game, and its teams. */
  players: Player[]
  teams: Team[]
  /** Rules on the question shown without a buzz, awarding its points to `award` if correct. */
  onRule: (ruling: QuestionRuling, award: RulingAward | null) => void
  /** Shows the correct answer of the question shown to players and screens. */
  onReveal: () => void
  /** Marks players' choices to the question shown, in a game that takes them. */
  onMarkAnswers: () => void
  /** Opens the review of the current round's answers (ADR 0023). */
  onReviewRound: () => void
}

/** What a player's phone knows about the game, as handed to its widgets. */
export interface PlayerData {
  /** The host's latest message; a new object per message, so a repeat is shown again. */
  message: { text: string } | null
  /** The current question, as far as the `players` visibility allows. */
  question: Extract<GameEvent, { type: 'QUESTION_CONTENT' }> | null
  ended: boolean
  /** The buzz button, or `null` when this game has no buzzer. */
  buzzer: { enabled: boolean; label: string; onBuzz: () => void } | null
  /**
   * The options to pick from, in a game where players pick one (ADR 0023), or `null`.
   * `count` is `null` once the host no longer takes answers to the question.
   */
  choice: {
    count: number | null
    options: string[] | null
    selected: number | null
    enabled: boolean
    onChoose: (choice: number) => void
  } | null
}

/** Live data per surface. The scoreboard surface isn't rendered from a layout yet. */
export interface SurfaceData {
  gamemaster: GamemasterData
  player: PlayerData
  screen: ScreenData
  scoreboard: never
}

/** Props the `LayoutRenderer` gives every widget component. */
export interface WidgetProps<TData = unknown, TConfig = unknown> {
  data: TData
  config: TConfig
}
