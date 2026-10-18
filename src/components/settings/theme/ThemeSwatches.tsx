import type { ResolvedPalette } from '@/lib/theme'

/** A row of colour chips that sums up a palette. */
export function ThemeSwatches({ palette }: { palette: ResolvedPalette }) {
  return (
    <span className="flex overflow-hidden rounded border border-border" aria-hidden="true">
      {[palette.bg, palette.surface, palette.text, palette.accent].map((colour, i) => (
        <span key={i} className="h-5 w-5" style={{ background: colour }} />
      ))}
    </span>
  )
}
