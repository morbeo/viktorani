import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { Icon } from './Icon'

const OPEN_DELAY_MS = 300
// Matches the tooltip's w-64, and the gap kept from the trigger and the viewport edges
const TIP_WIDTH = 256
const GAP = 4
const EDGE = 8

interface HelpTipProps {
  /** What the control does and what changes when it is used, not its label. */
  text: string
  /** Accessible name of the ⓘ button, e.g. "About Allow rejoin". */
  label: string
}

/**
 * A small ⓘ button that explains the control next to it.
 *
 * @remarks
 * Opens on hover and keyboard focus after a short delay, and at once on tap or click.
 * Closes on Esc, blur and mouse leave. The text is linked to the button with
 * `aria-describedby`, so screen readers announce it even while it is hidden.
 * The text is rendered in `document.body` at a fixed position, so scrolling or clipping
 * containers such as modal bodies cannot cut it off. It opens below the button, or above
 * when there is no room, and closes when anything scrolls.
 */
export function HelpTip({ text, label }: HelpTipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)

  function show(delay: number) {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), delay)
  }
  function hide() {
    clearTimeout(timer.current)
    setOpen(false)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') hide()
    }
    window.addEventListener('keydown', onKeyDown)
    // The tooltip does not follow its trigger, so close it when anything scrolls
    window.addEventListener('scroll', hide, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', hide, true)
    }
  }, [open])

  // Place the open tooltip next to its trigger, inside the viewport, before it is painted
  useLayoutEffect(() => {
    const tip = tipRef.current
    if (!open || !buttonRef.current || !tip) return
    const r = buttonRef.current.getBoundingClientRect()
    const maxLeft = window.innerWidth - TIP_WIDTH - EDGE
    const left = Math.max(EDGE, Math.min(r.left + r.width / 2 - TIP_WIDTH / 2, maxLeft))
    const below = r.bottom + GAP
    const fitsBelow = below + tip.offsetHeight <= window.innerHeight - EDGE
    const top = fitsBelow ? below : Math.max(EDGE, r.top - GAP - tip.offsetHeight)
    tip.style.left = `${left}px`
    tip.style.top = `${top}px`
  }, [open])

  return (
    <span
      className="inline-flex align-middle"
      onMouseEnter={() => show(OPEN_DELAY_MS)}
      onMouseLeave={hide}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-describedby={id}
        onFocus={() => show(OPEN_DELAY_MS)}
        onBlur={hide}
        onClick={e => {
          // Inside a <label>, don't let the click reach the labelled control
          e.preventDefault()
          e.stopPropagation()
          clearTimeout(timer.current)
          setOpen(true)
        }}
        className="inline-flex items-center justify-center rounded-full opacity-60 hover:opacity-100 focus-visible:opacity-100"
        style={{ color: 'inherit' }}
      >
        <Icon icon={Info} size="sm" />
      </button>
      {createPortal(
        <span
          ref={tipRef}
          id={id}
          role="tooltip"
          hidden={!open}
          className="fixed z-[70] w-64 rounded-md px-3 py-2 text-xs font-normal normal-case tracking-normal text-left shadow-lg"
          style={{ background: 'var(--color-ink)', color: 'var(--color-cream)' }}
        >
          {text}
        </span>,
        document.body
      )}
    </span>
  )
}
