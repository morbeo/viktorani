/**
 * WCAG 2.1 contrast ratio utilities.
 * Used by TeamForm to warn when white text on the chosen team colour
 * falls below the AA threshold (4.5:1 for normal text).
 */

/** Parse a CSS hex colour string to [r, g, b] in 0-255 range. */
function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return null
  const n = parseInt(clean, 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/** Relative luminance per WCAG 2.1 §1.4.3. */
function luminance(r: number, g: number, b: number): number {
  const c = [r, g, b].map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/**
 * Contrast ratio between two hex colours.
 * Returns null if either colour is unparseable.
 */
export function contrastRatio(hex1: string, hex2: string): number | null {
  const rgb1 = hexToRgb(hex1)
  const rgb2 = hexToRgb(hex2)
  if (!rgb1 || !rgb2) return null
  const l1 = luminance(...rgb1)
  const l2 = luminance(...rgb2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** True when white text (#ffffff) on `bgHex` meets WCAG AA (4.5:1). */
export function whiteTextPassesAA(bgHex: string): boolean {
  const ratio = contrastRatio('#ffffff', bgHex)
  return ratio !== null && ratio >= 4.5
}
