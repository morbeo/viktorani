import { LayoutTemplate } from 'lucide-react'
import { GAME_PHASES } from '@/db'
import type { Game, GamePhase } from '@/db'
import { setLayoutAssignment } from '@/db/games'
import type { Command } from '@/components/command-palette/commands'
import { PHASE_LABELS } from '@/components/layout-designer/labels'
import { choiceLabel, layoutChoices } from '@/lib/layout-assignments'
import type { LayoutBundle } from '@/widgets/layouts'

/** Phases the GM can hold by hand while the game runs. */
export const OVERRIDE_PHASES = GAME_PHASES.filter(p => p !== 'lobby' && p !== 'ended')

/** Surfaces the GM can switch layouts on from the command palette. */
const LIVE_SURFACES = [
  { target: 'screen', name: 'screen' },
  { target: 'player', name: 'phones' },
] as const

/** Palette commands that hold a layout phase by hand, or go back to automatic (#414). */
export function phaseCommands(onOverride: (phase: GamePhase | null) => void): Command[] {
  return [
    {
      id: 'gm:phase:auto',
      label: 'Layouts: automatic',
      group: 'Layout',
      icon: LayoutTemplate,
      keywords: 'phase layout auto',
      run: () => onOverride(null),
    },
    ...OVERRIDE_PHASES.map(p => ({
      id: `gm:phase:${p}`,
      label: `Layouts: ${PHASE_LABELS[p]}`,
      group: 'Layout',
      icon: LayoutTemplate,
      keywords: 'phase layout show',
      run: () => onOverride(p),
    })),
  ]
}

/**
 * Palette commands that show a layout on the screen or the players' phones for the phase
 * the game is in, saved as the game's choice for that phase (#415).
 */
export function layoutCommands({
  game,
  phase,
  layouts,
  onGameChange,
}: {
  game: Pick<Game, 'id' | 'layoutAssignments'>
  phase: GamePhase
  layouts: readonly LayoutBundle[]
  onGameChange: (patch: Partial<Game>) => void
}): Command[] {
  return LIVE_SURFACES.flatMap(({ target, name }) => {
    const show = (layoutId: string | null) =>
      void setLayoutAssignment(game, target, phase, layoutId).then(onGameChange)
    return [
      {
        id: `gm:layout:${target}:auto`,
        label: `Show layout on ${name}: automatic`,
        group: 'Layout',
        icon: LayoutTemplate,
        keywords: 'show layout',
        run: () => show(null),
      },
      ...layoutChoices(layouts, target, game.id).map(choice => ({
        id: `gm:layout:${target}:${choice.bundle.layout.id}`,
        label: `Show layout on ${name}: ${choiceLabel(choice)}`,
        group: 'Layout',
        icon: LayoutTemplate,
        keywords: 'show layout',
        run: () => show(choice.bundle.layout.id),
      })),
    ]
  })
}
