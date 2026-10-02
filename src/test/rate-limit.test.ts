import { describe, it, expect } from 'vitest'
import { RateLimiter } from '@/lib/rate-limit'

describe('RateLimiter', () => {
  it('allows up to the limit per key within the window, then again once it passes', () => {
    const limiter = new RateLimiter(2, 1000)
    expect(limiter.allow('a', 0)).toBe(true)
    expect(limiter.allow('a', 100)).toBe(true)
    expect(limiter.allow('a', 200)).toBe(false)
    expect(limiter.allow('b', 200)).toBe(true)
    expect(limiter.allow('a', 1000)).toBe(true)
    expect(limiter.allow('a', 1050)).toBe(false)
  })
})
