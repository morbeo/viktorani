import type { ReactNode } from 'react'
import type { GamePhase } from '@/db'
import type { StudioSpeed, StudioTransition } from '@/lib/studio'

interface PhaseTransitionProps {
  phase: GamePhase | null
  /** How the phase reached the screen: a cut, or a studio take's animated transition. */
  transition?: StudioTransition
  /** How fast an animated transition plays. */
  speed?: StudioSpeed
  children: ReactNode
}

/** The animation each transition plays on the incoming layout. */
const ANIMATION: Record<Exclude<StudioTransition, 'cut' | 'dip'>, string> = {
  fade: 'motion-safe:animate-fade-in',
  slide: 'motion-safe:animate-slide-in',
  zoom: 'motion-safe:animate-zoom-in',
  wipe: 'motion-safe:animate-wipe-in',
}

/** Sets `--studio-duration`, which every transition's animation runs for. */
const DURATION: Record<StudioSpeed, string> = {
  short: '[--studio-duration:0.3s]',
  normal: '',
  slow: '[--studio-duration:1.2s]',
}

/**
 * Wraps a screen surface so a studio-mode take (ADR 0025) brings its new layout in with
 * the take's transition.
 *
 * @remarks
 * Only an animated take remounts the layout, keyed by the phase it moves to, which restarts
 * the animation; cuts keep one key, so widgets such as a playing video aren't remounted when
 * the phase changes without a take. A dip lays a black cover over the new layout that
 * clears; a slide clips to the screen so the layout doesn't scroll the page while it moves
 * in. Viewers who ask for reduced motion get a cut.
 */
export function PhaseTransition({
  phase,
  transition = 'cut',
  speed = 'normal',
  children,
}: PhaseTransitionProps) {
  if (transition === 'cut') {
    return (
      <div key="cut" data-transition="cut">
        {children}
      </div>
    )
  }
  const clip = transition === 'slide' || transition === 'dip'
  const classes = [
    DURATION[speed],
    clip && 'relative overflow-hidden',
    transition !== 'dip' && ANIMATION[transition],
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      key={`${transition}:${phase ?? ''}`}
      data-transition={transition}
      data-speed={speed}
      className={classes}
    >
      {children}
      {transition === 'dip' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-black opacity-0 motion-safe:animate-dip-clear"
        />
      )}
    </div>
  )
}
