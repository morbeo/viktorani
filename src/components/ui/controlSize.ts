import { createContext, useContext } from 'react'

/** User-chosen size for game master controls: small, medium or large. */
export type ControlSize = 'sm' | 'md' | 'lg'

export interface ControlSizeContextValue {
  size: ControlSize
  setSize: (size: ControlSize) => void
}

/** Provided by the GameMaster page; `null` elsewhere, where controls keep their own size. */
export const ControlSizeContext = createContext<ControlSizeContextValue | null>(null)

const STEPS: Record<ControlSize, number> = { sm: -1, md: 0, lg: 1 }

/**
 * How many steps to shift a control's size: -1, 0 or +1 inside the GameMaster page
 * (small, medium, large), 0 everywhere else. The size comes from localStorage, so any
 * other stored value counts as medium.
 */
export function useControlSizeStep(): number {
  const ctx = useContext(ControlSizeContext)
  return ctx && Object.hasOwn(STEPS, ctx.size) ? STEPS[ctx.size] : 0
}

/** Pick one of three values (small, medium, large) by the current control size step. */
export function pickBySize<T>(step: number, values: readonly [T, T, T], base = 1): T {
  return values[Math.min(2, Math.max(0, base + step))]
}
