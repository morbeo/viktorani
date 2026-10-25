/** Room codes, kept apart from the transport so Node code (the MCP server) can make them. */

/**
 * Returns a cryptographically secure random integer in [0, max).
 *
 * @remarks
 * Uses `crypto.getRandomValues()` — available in all modern browsers and Node >= 15.
 * Unlike `Math.random()`, the output is suitable for security-sensitive operations
 * such as room ID generation.
 *
 * @param max - Upper bound (exclusive).
 * @returns A random integer in the range `[0, max)`.
 */
function secureRandomInt(max: number): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0] % max
}

// ── Room ID generator ─────────────────────────────────────────────────────────

/**
 * Generate a random 6-character room ID using an unambiguous character set.
 *
 * @remarks
 * Characters `I`, `O`, `0`, and `1` are omitted to avoid visual confusion
 * when reading codes aloud or from a small screen.
 *
 * @returns An uppercase alphanumeric string such as `'XK7RQZ'`.
 *
 * @example
 * ```ts
 * const roomId = generateRoomId() // 'XK7RQZ'
 * ```
 */
export function generateRoomId(): string {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => CHARS[secureRandomInt(CHARS.length)]).join('')
}
