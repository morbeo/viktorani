/**
 * Allows at most `limit` hits per key within any `windowMs` window. Used to cap how
 * often one player's actions can be written to the game log.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>()
  private readonly limit: number
  private readonly windowMs: number

  constructor(limit: number, windowMs: number) {
    this.limit = limit
    this.windowMs = windowMs
  }

  /** Record a hit for `key` and say whether it is within the limit. */
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter(t => now - t < this.windowMs)
    const allowed = recent.length < this.limit
    if (allowed) recent.push(now)
    this.hits.set(key, recent)
    return allowed
  }
}
