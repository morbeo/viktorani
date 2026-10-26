// AI tools (#522): the per-device switch, WebMCP registration, confirmations and their UI.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, renderHook, screen, fireEvent } from '@testing-library/react'
import {
  answerConfirmation,
  denyAllConfirmations,
  modelContext,
  readAiToolsEnabled,
  readConfirmations,
  registerWebMcpTools,
  requestConfirmation,
  subscribeAiTools,
  writeAiToolsEnabled,
} from '@/lib/ai-tools'
import type { ModelContext, WebMcpTool } from '@/lib/ai-tools'
import { useWebMcpTools } from '@/hooks/useAiTools'
import AiToolsSettings from '@/components/settings/AiToolsSettings'
import { AiToolsStatus } from '@/components/gamemaster/AiToolsStatus'

function fakeTool(name: string, reply = name): WebMcpTool {
  return {
    name,
    description: name,
    inputSchema: { type: 'object' },
    execute: async () => reply,
  }
}

/** A WebMCP entry point that records what is registered, as the current draft does. */
function fakeModelContext() {
  const tools = new Map<string, WebMcpTool>()
  const mc: ModelContext = {
    registerTool: vi.fn((tool: WebMcpTool, options?: { signal?: AbortSignal }) => {
      if (tools.has(tool.name)) throw new Error('duplicate')
      tools.set(tool.name, tool)
      options?.signal?.addEventListener('abort', () => tools.delete(tool.name))
    }),
  }
  return { mc, tools }
}

function setModelContext(mc: ModelContext | undefined) {
  Object.defineProperty(document, 'modelContext', { value: mc, configurable: true })
}

beforeEach(() => {
  localStorage.clear()
  denyAllConfirmations()
})

afterEach(() => {
  setModelContext(undefined)
})

describe('AI tools switch', () => {
  it('is off by default and stays per device', () => {
    expect(readAiToolsEnabled()).toBe(false)
    const listener = vi.fn()
    const off = subscribeAiTools(listener)
    writeAiToolsEnabled(true)
    expect(readAiToolsEnabled()).toBe(true)
    expect(localStorage.getItem('viktorani:ai-tools')).toBe('on')
    writeAiToolsEnabled(false)
    expect(localStorage.getItem('viktorani:ai-tools')).toBeNull()
    expect(listener).toHaveBeenCalledTimes(2)
    off()
  })

  it('follows a change made in another tab', () => {
    const listener = vi.fn()
    const off = subscribeAiTools(listener)
    window.dispatchEvent(new StorageEvent('storage', { key: 'viktorani:ai-tools' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'something-else' }))
    expect(listener).toHaveBeenCalledTimes(1)
    off()
  })
})

describe('WebMCP', () => {
  it('finds the entry point on document, then navigator, and only with registerTool', () => {
    expect(modelContext()).toBeNull()
    setModelContext({} as ModelContext)
    expect(modelContext()).toBeNull()
    const { mc } = fakeModelContext()
    setModelContext(mc)
    expect(modelContext()).toBe(mc)
  })

  it('registers tools and takes them off by aborting', () => {
    const { mc, tools } = fakeModelContext()
    const off = registerWebMcpTools(mc, [fakeTool('a'), fakeTool('a'), fakeTool('b')])
    expect([...tools.keys()]).toEqual(['a', 'b'])
    off()
    expect(tools.size).toBe(0)
  })

  it('also calls unregisterTool where an older draft has it', () => {
    const { mc } = fakeModelContext()
    const unregisterTool = vi.fn()
    const off = registerWebMcpTools({ ...mc, unregisterTool }, [fakeTool('a')])
    off()
    expect(unregisterTool).toHaveBeenCalledWith('a')
  })
})

describe('confirmations', () => {
  it('resolve only through the host’s answer', async () => {
    const allowed = requestConfirmation('End the game', 'Final')
    const denied = requestConfirmation('Kick Ana')
    expect(readConfirmations().map(c => c.title)).toEqual(['End the game', 'Kick Ana'])
    answerConfirmation(readConfirmations()[0].id, true)
    answerConfirmation(9999, true)
    denyAllConfirmations()
    await expect(allowed).resolves.toBe(true)
    await expect(denied).resolves.toBe(false)
    expect(readConfirmations()).toEqual([])
  })

  it('show in the game master, where Allow and Deny answer them', async () => {
    render(<AiToolsStatus active />)
    expect(screen.getByRole('status')).toHaveTextContent('AI tools active')
    let first!: Promise<boolean>
    let second!: Promise<boolean>
    act(() => {
      first = requestConfirmation('End the game', 'It can’t be restarted.')
      second = requestConfirmation('Kick Ana')
    })
    expect(screen.getByText('End the game')).toBeInTheDocument()
    expect(screen.getByText('1 more waiting after this.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Allow' }))
    await expect(first).resolves.toBe(true)
    expect(screen.getByText('Kick Ana')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await expect(second).resolves.toBe(false)
    expect(screen.queryByText('Kick Ana')).toBeNull()
  })

  it('show no badge while the tools are off', () => {
    render(<AiToolsStatus active={false} />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('useWebMcpTools', () => {
  it('registers only while open, switched on and supported, and runs the latest tools', async () => {
    const { mc, tools } = fakeModelContext()
    setModelContext(mc)
    const { result, rerender } = renderHook(
      ({ reply, open }) => useWebMcpTools(() => [fakeTool('t', reply)], open),
      { initialProps: { reply: 'first', open: true } }
    )
    expect(result.current).toBe(false)
    expect(tools.size).toBe(0)

    act(() => writeAiToolsEnabled(true))
    expect(result.current).toBe(true)
    expect(mc.registerTool).toHaveBeenCalledTimes(1)
    rerender({ reply: 'second', open: true })
    expect(mc.registerTool).toHaveBeenCalledTimes(1)
    await expect(tools.get('t')!.execute({})).resolves.toBe('second')

    let waiting!: Promise<boolean>
    act(() => {
      waiting = requestConfirmation('End the game')
    })
    rerender({ reply: 'second', open: false })
    expect(tools.size).toBe(0)
    await expect(waiting).resolves.toBe(false)
  })
})

describe('Settings → AI tools', () => {
  it('turns the switch on and says when the browser lacks WebMCP', () => {
    render(<AiToolsSettings />)
    expect(screen.getByText(/doesn’t support WebMCP/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(readAiToolsEnabled()).toBe(true)
  })
})
