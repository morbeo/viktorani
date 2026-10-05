import type { Game } from '@/db'

/** The game settings the host picks in the wizard and can change in the game master. */
export type GameSettings = Pick<
  Game,
  | 'scoringEnabled'
  | 'visibility'
  | 'maxTeams'
  | 'maxPerTeam'
  | 'maxPlayers'
  | 'allowIndividual'
  | 'allowPlayerTeams'
  | 'allowLateJoin'
  | 'allowRejoin'
  | 'rejoinWindowSeconds'
  | 'requireApproval'
  | 'buzzerEnabled'
  | 'autoLockOnFirstCorrect'
  | 'allowFalseStarts'
  | 'buzzDeduplication'
  | 'confirmUnruledNavigation'
  | 'autoStartTimerOnQuestionShow'
  | 'defaultTimerDuration'
  | 'soundEffectsMuted'
>

/** A saved set of game settings the host can apply in one click. */
export interface GamePreset {
  id: string
  label: string
  description: string
  settings: GameSettings
}

/** Every game setting, in form order. */
export const GAME_SETTINGS_KEYS = [
  'scoringEnabled',
  'visibility',
  'maxTeams',
  'maxPerTeam',
  'maxPlayers',
  'allowIndividual',
  'allowPlayerTeams',
  'allowLateJoin',
  'allowRejoin',
  'rejoinWindowSeconds',
  'requireApproval',
  'buzzerEnabled',
  'autoLockOnFirstCorrect',
  'allowFalseStarts',
  'buzzDeduplication',
  'confirmUnruledNavigation',
  'autoStartTimerOnQuestionShow',
  'defaultTimerDuration',
  'soundEffectsMuted',
] as const satisfies ReadonlyArray<keyof GameSettings>

/**
 * The joining and buzzer settings: all a preset changes during a game, where scoring is
 * locked and visibility is set on the question panel.
 */
export const LIVE_PRESET_KEYS = GAME_SETTINGS_KEYS.filter(
  k => k !== 'scoringEnabled' && k !== 'visibility'
)

/** Just the game settings of `value`, which may be a whole game. */
export function pickGameSettings(value: GameSettings): GameSettings {
  return Object.fromEntries(GAME_SETTINGS_KEYS.map(k => [k, value[k]])) as GameSettings
}

/** Just the given settings of a preset, as a patch. */
export function presetPatch(
  preset: GamePreset,
  keys: ReadonlyArray<keyof GameSettings> = GAME_SETTINGS_KEYS
): Partial<GameSettings> {
  return Object.fromEntries(keys.map(k => [k, preset.settings[k]]))
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** The first preset whose given settings all match, or `null` when they have been customised. */
export function matchPreset(
  settings: GameSettings,
  presets: GamePreset[],
  keys: ReadonlyArray<keyof GameSettings> = GAME_SETTINGS_KEYS
): GamePreset | null {
  return presets.find(p => keys.every(k => sameValue(settings[k], p.settings[k]))) ?? null
}

/** Highest value the team limit steppers go up to. */
export const MAX_LIMIT = 99

/** Settings for a new game: an open lobby, scoring on, answers hidden. */
export function defaultSettings(): GameSettings {
  return {
    scoringEnabled: true,
    visibility: {
      players: { showQuestion: true, showAnswers: false, showMedia: true },
      screen: { showQuestion: true, showAnswers: false, showMedia: true },
    },
    allowIndividual: true,
    allowPlayerTeams: true,
    allowLateJoin: true,
    allowRejoin: true,
    rejoinWindowSeconds: 0,
    requireApproval: false,
    maxTeams: 0,
    maxPerTeam: 0,
    maxPlayers: 0,
    buzzerEnabled: true,
    autoLockOnFirstCorrect: false,
    allowFalseStarts: false,
    buzzDeduplication: 'firstOnly',
    confirmUnruledNavigation: false,
    autoStartTimerOnQuestionShow: false,
    defaultTimerDuration: 60,
    soundEffectsMuted: false,
  }
}

/** The presets a new install starts with; Settings → Game defaults can restore them. */
export const BUILT_IN_PRESETS: GamePreset[] = [
  {
    id: 'open',
    label: 'Open lobby',
    description: 'Anyone can join at any time, alone or in a team.',
    settings: defaultSettings(),
  },
  {
    id: 'pub',
    label: 'Pub quiz',
    description: 'Teams only, up to 6 per team. The buzzer locks after a correct answer.',
    settings: {
      ...defaultSettings(),
      allowIndividual: false,
      maxPerTeam: 6,
      autoLockOnFirstCorrect: true,
    },
  },
  {
    id: 'classroom',
    label: 'Classroom',
    description:
      'You approve each player and make the teams. False starts are recorded and the buzzer locks after a correct answer.',
    settings: {
      ...defaultSettings(),
      allowPlayerTeams: false,
      requireApproval: true,
      autoLockOnFirstCorrect: true,
      allowFalseStarts: true,
    },
  },
]
