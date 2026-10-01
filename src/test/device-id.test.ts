// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { getDeviceId } from '@/pages/player/device-id'

beforeEach(() => localStorage.clear())

describe('getDeviceId', () => {
  it('creates an id once and reuses it', () => {
    const first = getDeviceId()
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(getDeviceId()).toBe(first)
    expect(localStorage.getItem('viktorani-device-id')).toBe(first)
  })
})
