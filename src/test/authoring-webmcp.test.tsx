// @vitest-pool vmForks
// Authoring tools in the app (#532): the step 1 tools on the app's own data through WebMCP.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '@/db'
import {
  answerConfirmation,
  denyAllConfirmations,
  readConfirmations,
  writeAiToolsEnabled,
} from '@/lib/ai-tools'
import type { ModelContext, WebMcpTool } from '@/lib/ai-tools'
import { getSettings, setSettings } from '@/lib/app-settings'
import { RateLimiter } from '@/lib/rate-limit'
import { AUTHORING_TOOLS } from '@/mcp'
import { APP_AUTHORING_TOOLS, buildAuthoringTools } from '@/mcp/webmcp'
import { AuthoringTools } from '@/components/AuthoringTools'

const tools = () => buildAuthoringTools(new RateLimiter(100, 10_000))

async function call(name: string, args: Record<string, unknown> = {}, list = tools()) {
  const tool = list.find(t => t.name === name)
  if (!tool) throw new Error(`no tool ${name}`)
  return tool.execute(args)
}

/** Answer the next confirmation once it shows, and return its text. */
async function answerNext(ok: boolean) {
  await vi.waitFor(() => expect(readConfirmations()).toHaveLength(1))
  const [pending] = readConfirmations()
  answerConfirmation(pending.id, ok)
  return pending
}

beforeEach(async () => {
  localStorage.clear()
  denyAllConfirmations()
  await Promise.all(db.tables.map(t => t.clear()))
})

describe('authoring tools in the app', () => {
  it('offer every authoring tool but the file ones', () => {
    const names = APP_AUTHORING_TOOLS.map(t => t.name)
    expect(names).toHaveLength(AUTHORING_TOOLS.length - 4)
    for (const name of ['load_backup', 'save', 'validate_backup', 'summary']) {
      expect(names).not.toContain(name)
    }
    const list = tools()
    expect(list.find(t => t.name === 'list_tags')!.annotations?.readOnlyHint).toBe(true)
    expect(list.find(t => t.name === 'create_tag')!.inputSchema).toMatchObject({
      required: ['name'],
    })
  })

  it('write straight to the app’s data', async () => {
    expect(JSON.parse(await call('create_tag', { name: 'Music' }))).toMatchObject({
      name: 'Music',
    })
    expect(await db.tags.toArray()).toMatchObject([{ name: 'Music' }])
    expect(await call('create_tag', {})).toMatch(/Invalid input/)
  })

  it('delete only after the host allows it, naming what goes', async () => {
    const { id } = JSON.parse(await call('create_tag', { name: 'Music' }))
    const denied = call('delete_tag', { id })
    expect(await answerNext(false)).toMatchObject({ title: 'Delete tag', detail: '“Music”' })
    expect(await denied).toBe('The host denied this.')
    expect(await db.tags.count()).toBe(1)

    const allowed = call('delete_tag', { id })
    await answerNext(true)
    expect(JSON.parse(await allowed)).toBeTruthy()
    expect(await db.tags.count()).toBe(0)
  })

  it('use this device’s settings and save changes to them', async () => {
    const theme = JSON.parse(await call('create_theme', { name: 'Bar' }))
    setSettings({ themeId: theme.id })
    const deleting = call('delete_theme', { id: theme.id })
    await answerNext(true)
    await deleting
    expect(getSettings().themeId).toBe('classic')
  })

  it('limit how fast an assistant changes things, but not reads', async () => {
    const list = buildAuthoringTools(new RateLimiter(1, 10_000))
    await call('create_tag', { name: 'A' }, list)
    expect(await call('create_tag', { name: 'B' }, list)).toMatch(/Too many/)
    expect(await call('list_tags', {}, list)).toMatch(/"A"/)
  })
})

describe('AuthoringTools', () => {
  const registered = new Map<string, WebMcpTool>()
  const mc: ModelContext = {
    registerTool(tool, options) {
      registered.set(tool.name, tool)
      options?.signal?.addEventListener('abort', () => registered.delete(tool.name))
    },
  }

  beforeEach(() => {
    registered.clear()
    Object.defineProperty(document, 'modelContext', { value: mc, configurable: true })
  })
  afterEach(() => {
    Object.defineProperty(document, 'modelContext', { value: undefined, configurable: true })
  })

  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AuthoringTools />
      </MemoryRouter>
    )
  }

  it('registers the tools on admin pages once AI tools are on', async () => {
    renderAt('/admin/questions')
    expect(registered.size).toBe(0)
    act(() => writeAiToolsEnabled(true))
    await vi.waitFor(() => expect(registered.size).toBe(APP_AUTHORING_TOOLS.length))
    act(() => writeAiToolsEnabled(false))
    expect(registered.size).toBe(0)
  })

  it('leaves the game master to its own tools', async () => {
    writeAiToolsEnabled(true)
    const { container } = renderAt('/admin/game/g1')
    await new Promise(r => setTimeout(r, 20))
    expect(registered.size).toBe(0)
    expect(container).toBeEmptyDOMElement()
  })
})
