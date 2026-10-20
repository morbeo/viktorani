import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { isAway, useFocusReport } from '@/pages/player/focus-report'

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
}

afterEach(() => {
  setHidden(false)
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('isAway', () => {
  it('is false while the page is visible and focused', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    expect(isAway()).toBe(false)
  })

  it('is true when the page is hidden', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    setHidden(true)
    expect(isAway()).toBe(true)
  })

  it('is true when the window lost focus', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    expect(isAway()).toBe(true)
  })

  it('is false when an embedded frame has focus', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    const frame = document.createElement('iframe')
    document.body.append(frame)
    vi.spyOn(document, 'activeElement', 'get').mockReturnValue(frame)
    expect(isAway()).toBe(false)
  })
})

describe('useFocusReport', () => {
  it('reports leaving and coming back once each', () => {
    const focus = vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    const onChange = vi.fn()
    renderHook(() => useFocusReport(true, onChange))

    setHidden(true)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    setHidden(false)
    focus.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(onChange.mock.calls).toEqual([[true], [false]])
  })

  it('reports a window blur after the event settles', () => {
    vi.useFakeTimers()
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    const onChange = vi.fn()
    renderHook(() => useFocusReport(true, onChange))
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(onChange).not.toHaveBeenCalled()
    act(() => vi.runAllTimers())
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('reports nothing while disabled or after unmount', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    const onChange = vi.fn()
    const { rerender, unmount } = renderHook(({ on }) => useFocusReport(on, onChange), {
      initialProps: { on: false },
    })
    setHidden(true)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    rerender({ on: true })
    unmount()
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(onChange).not.toHaveBeenCalled()
  })
})
