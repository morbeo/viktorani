import type { ReactNode } from 'react'
import type { GamePhase } from '@/db'
import type { StudioTransition } from '@/lib/studio'

interface PhaseTransitionProps {
  phase: GamePhase | null
  /** How the phase reached the screen; `fade` fades the new layout in. */
  transition?: StudioTransition
  children: ReactNode
}

/**
 * Wraps a screen surface so a studio-mode fade take (ADR 0025) fades its new layout in.
 *
 * @remarks
 * Only a fade remounts the layout, keyed by the phase it fades to, which restarts the
 * animation; cuts keep one key, so widgets such as a playing video aren't remounted when
 * the phase changes without a take. Viewers who ask for reduced motion get a cut.
 */
export function PhaseTransition({ phase, transition = 'cut', children }: PhaseTransitionProps) {
  const fade = transition === 'fade'
  return (
    <div
      key={fade ? `fade:${phase ?? ''}` : 'cut'}
      data-transition={transition}
      className={fade ? 'motion-safe:animate-fade-in' : undefined}
    >
      {children}
    </div>
  )
}
