import { useEffect, useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { Icon } from './Icon'

const OPEN_DELAY_MS = 300

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
 */
export function HelpTip({ text, label }: HelpTipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <span
      className="relative inline-flex align-middle"
      onMouseEnter={() => show(OPEN_DELAY_MS)}
      onMouseLeave={hide}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        onFocus={() => show(OPEN_DELAY_MS)}
        onBlur={hide}
        onClick={e => {
          // Inside a <label>, don't let the click reach the labelled control
          e.preventDefault()
          e.stopPropagation()
          show(0)
        }}
        className="inline-flex items-center justify-center rounded-full opacity-60 hover:opacity-100 focus-visible:opacity-100"
        style={{ color: 'inherit' }}
      >
        <Icon icon={Info} size="sm" />
      </button>
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className="absolute z-50 left-1/2 top-full mt-1 -translate-x-1/2 w-64 rounded-md px-3 py-2 text-xs font-normal normal-case tracking-normal text-left shadow-lg"
        style={{ background: 'var(--color-ink)', color: 'var(--color-cream)' }}
      >
        {text}
      </span>
    </span>
  )
}
