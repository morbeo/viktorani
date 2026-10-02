import type { Game } from '@/db'

/** The game settings the host picks in the wizard and can change in the game master. */
export type GameSettings = Pick<
  Game,
  | 'scoringEnabled'
  | 'visibility'
  | 'maxTeams'
  | 'maxPerTeam'
  | 'allowIndividual'
  | 'allowPlayerTeams'
  | 'allowLateJoin'
  | 'allowRejoin'
  | 'requireApproval'
  | 'autoLockOnFirstCorrect'
  | 'allowFalseStarts'
  | 'buzzDeduplication'
>

/** The settings a preset sets: joining and the buzzer. Scoring and visibility are left alone. */
export type PresetSettings = Omit<GameSettings, 'scoringEnabled' | 'visibility'>

export type PresetId = 'open' | 'pub' | 'classroom'

export interface Preset {
  id: PresetId
  label: string
  description: string
  settings: PresetSettings
}

export const PRESETS: Preset[] = [
  {
    id: 'open',
    label: 'Open lobby',
    description: 'Anyone can join at any time, alone or in a team.',
    settings: {
      allowIndividual: true,
      allowPlayerTeams: true,
      allowLateJoin: true,
      allowRejoin: true,
      requireApproval: false,
      maxTeams: 0,
      maxPerTeam: 0,
      autoLockOnFirstCorrect: false,
      allowFalseStarts: false,
      buzzDeduplication: 'firstOnly',
    },
  },
  {
    id: 'pub',
    label: 'Pub quiz',
    description: 'Teams only, up to 6 per team. The buzzer locks after a correct answer.',
    settings: {
      allowIndividual: false,
      allowPlayerTeams: true,
      allowLateJoin: true,
      allowRejoin: true,
      requireApproval: false,
      maxTeams: 0,
      maxPerTeam: 6,
      autoLockOnFirstCorrect: true,
      allowFalseStarts: false,
      buzzDeduplication: 'firstOnly',
    },
  },
  {
    id: 'classroom',
    label: 'Classroom',
    description:
      'You approve each player and make the teams. False starts are recorded and the buzzer locks after a correct answer.',
    settings: {
      allowIndividual: true,
      allowPlayerTeams: false,
      allowLateJoin: true,
      allowRejoin: true,
      requireApproval: true,
      maxTeams: 0,
      maxPerTeam: 0,
      autoLockOnFirstCorrect: true,
      allowFalseStarts: true,
      buzzDeduplication: 'firstOnly',
    },
  },
]

/** The preset the settings match exactly, or `null` when they have been customised. */
export function matchPreset(settings: GameSettings): PresetId | null {
  const match = PRESETS.find(p =>
    (Object.keys(p.settings) as Array<keyof PresetSettings>).every(
      k => settings[k] === p.settings[k]
    )
  )
  return match?.id ?? null
}

/** Highest value the team limit steppers go up to. */
export const MAX_LIMIT = 99

/** Settings for a new game: the open lobby preset, scoring on, answers hidden. */
export function defaultSettings(): GameSettings {
  return {
    scoringEnabled: true,
    visibility: {
      players: { showQuestion: true, showAnswers: false, showMedia: true },
      screen: { showQuestion: true, showAnswers: false, showMedia: true },
    },
    ...PRESETS[0].settings,
  }
}
