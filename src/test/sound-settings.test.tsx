import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { playBeep } from '@/hooks/useTimer'
import { setSettings } from '@/lib/app-settings'
import { CreateTimerModal } from '@/components/timer/CreateTimerModal'

const setValueAtTime = vi.fn()
// A regular function, so `new AudioContext()` can construct it
const MockAudioContext = vi.fn().mockImplementation(function () {
  return {
    currentTime: 0,
    destination: {},
    createOscillator: () => ({
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { value: 0 },
      type: '',
      onended: null,
    }),
    createGain: () => ({
      connect: vi.fn(),
      gain: { setValueAtTime, exponentialRampToValueAtTime: vi.fn() },
    }),
    close: vi.fn().mockResolvedValue(undefined),
  }
})

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('AudioContext', MockAudioContext)
  MockAudioContext.mockClear()
  setValueAtTime.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('playBeep', () => {
  it('scales the beep by the volume setting', () => {
    setSettings({ soundVolume: 50 })
    playBeep()
    expect(setValueAtTime).toHaveBeenCalledWith(0.2, 0)
  })

  it('stays silent when muted or at zero volume', () => {
    setSettings({ soundMuted: true })
    playBeep()
    setSettings({ soundMuted: false, soundVolume: 0 })
    playBeep()
    expect(MockAudioContext).not.toHaveBeenCalled()
  })
})

describe('CreateTimerModal', () => {
  it('starts from the default timer duration', () => {
    setSettings({ timerDuration: 150 })
    render(<CreateTimerModal onConfirm={() => {}} onCancel={() => {}} />)
    const [min, sec] = screen.getAllByRole('spinbutton')
    expect(min).toHaveValue(2)
    expect(sec).toHaveValue(30)
  })
})
