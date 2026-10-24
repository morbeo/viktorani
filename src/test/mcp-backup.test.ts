// @vitest-pool vmForks
// MCP backup tools (#519): load, save, validate and summary.
import { describe, it, expect } from 'vitest'
import { db } from '@/db'
import { parseSnapshot } from '@/db/snapshot'
import { AUTHORING_TOOLS, ToolError } from '@/mcp'
import { backup, setUp } from './mcp-harness'

const TAG = { id: 't1', name: 'Music', color: '#9b59b6' }

describe('load_backup', () => {
  it('loads a backup, replacing what was there', async () => {
    const { call, ctx } = await setUp({ 'a.json': backup({ tags: [TAG] }) })
    await db.questions.add({ id: 'stale' } as never)
    const result = await call('load_backup', { path: 'a.json' })
    expect(result).toMatchObject({ path: 'a.json', counts: { tags: 1, questions: 0 } })
    expect(await db.tags.toArray()).toEqual([TAG])
    expect(await db.questions.count()).toBe(0)
    expect(ctx.session).toMatchObject({ path: 'a.json', dirty: false })
  })

  it('keeps app settings aside instead of applying them', async () => {
    const settings = { version: 5, theme: 'dark' }
    const { call, ctx } = await setUp({ 'a.json': backup({}, { settings }) })
    await call('load_backup', { path: 'a.json' })
    expect(ctx.session.settings).toMatchObject({ theme: 'dark' })
  })

  it('refuses to drop unsaved changes unless asked', async () => {
    const { call } = await setUp({ 'a.json': backup({ tags: [TAG] }) })
    await call('create_tag', { name: 'Film' })
    await expect(call('load_backup', { path: 'a.json' })).rejects.toThrow(/unsaved changes/)
    await call('load_backup', { path: 'a.json', discard: true })
    expect(await db.tags.count()).toBe(1)
  })

  it('reports unreadable, malformed and invalid files', async () => {
    const { call } = await setUp({ 'bad.json': '{', 'v9.json': { version: 9 } })
    await expect(call('load_backup', { path: 'none.json' })).rejects.toThrow(/Cannot read/)
    await expect(call('load_backup', { path: 'bad.json' })).rejects.toThrow(/Invalid JSON/)
    await expect(call('load_backup', { path: 'v9.json' })).rejects.toThrow(ToolError)
  })
})

describe('save', () => {
  it('writes a backup the app can import, with the settings it was loaded with', async () => {
    const settings = { version: 5, theme: 'dark' }
    const { call, files, ctx } = await setUp({ 'a.json': backup({ tags: [TAG] }, { settings }) })
    await call('load_backup', { path: 'a.json' })
    await call('create_tag', { name: 'Film' })
    expect(ctx.session.dirty).toBe(true)
    await call('save', { path: 'b.json' })
    const saved = parseSnapshot(JSON.parse(files.get('b.json')!))
    expect(saved.tags.map(t => t.name).sort()).toEqual(['Film', 'Music'])
    expect(saved.settings).toMatchObject({ theme: 'dark' })
    expect(ctx.session).toMatchObject({ path: 'b.json', dirty: false })
  })

  it('overwrites the loaded file by default', async () => {
    const { call, files } = await setUp({ 'a.json': backup() })
    await call('load_backup', { path: 'a.json' })
    await call('create_tag', { name: 'Film' })
    await call('save')
    expect(JSON.parse(files.get('a.json')!).tags).toHaveLength(1)
  })

  it('needs a path when nothing was loaded', async () => {
    const { call } = await setUp()
    await expect(call('save')).rejects.toThrow(/pass a path/)
  })
})

describe('validate_backup and summary', () => {
  it('validates without loading', async () => {
    const { call } = await setUp({ 'a.json': backup({ tags: [TAG] }), 'b.json': { version: 9 } })
    expect(await call('validate_backup', { path: 'a.json' })).toMatchObject({
      valid: true,
      counts: { tags: 1 },
    })
    expect(await call('validate_backup', { path: 'b.json' })).toMatchObject({ valid: false })
    expect(await db.tags.count()).toBe(0)
  })

  it('summarises what is loaded', async () => {
    const { call } = await setUp()
    await call('create_tag', { name: 'Film' })
    expect(await call('summary')).toMatchObject({
      path: null,
      unsaved: true,
      counts: { tags: 1 },
    })
  })
})

describe('tool definitions', () => {
  it('have unique names and an object input schema', () => {
    const names = AUTHORING_TOOLS.map(t => t.name)
    expect(new Set(names).size).toBe(names.length)
    for (const tool of AUTHORING_TOOLS) {
      expect(tool.name).toMatch(/^[a-z_]+$/)
      expect(tool.description.length).toBeGreaterThan(10)
      expect(tool.input.def.type).toBe('object')
    }
  })

  it('rejects invalid input with the field that failed', async () => {
    const { call } = await setUp()
    await expect(call('create_tag', { name: '' })).rejects.toThrow(/Invalid input: name/)
  })
})
