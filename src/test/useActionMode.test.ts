import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useActionMode } from '@/hooks/useActionMode'

beforeEach(() => {
  localStorage.clear()
})

describe('useActionMode', () => {
  it('defaults to icons', () => {
    const { result } = renderHook(() => useActionMode())
    expect(result.current[0]).toBe('icons')
  })

  it('persists to localStorage on change', () => {
    const { result } = renderHook(() => useActionMode())
    act(() => {
      result.current[1]('text')
    })
    expect(result.current[0]).toBe('text')
    expect(localStorage.getItem('action-mode')).toBe('"text"')
  })

  it('reads back persisted value on re-mount', () => {
    localStorage.setItem('action-mode', '"both"')
    const { result } = renderHook(() => useActionMode())
    expect(result.current[0]).toBe('both')
  })

  it('accepts all three valid modes', () => {
    const { result } = renderHook(() => useActionMode())
    for (const mode of ['icons', 'text', 'both'] as const) {
      act(() => {
        result.current[1](mode)
      })
      expect(result.current[0]).toBe(mode)
    }
  })
})
