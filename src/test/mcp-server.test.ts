// @vitest-pool vmForks
// The MCP server (#520): tools and resources over the protocol, with a client in memory.
import { describe, it, expect } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { AUTHORING_TOOLS } from '@/mcp'
import { createServer } from '@/mcp/server'
import { backup, setUp } from './mcp-harness'

/** A client connected to a server over `backup.json`. */
async function connect(initial: Record<string, unknown> = { 'backup.json': backup() }) {
  const harness = await setUp(initial)
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await createServer(harness.ctx, '1.2.3').connect(serverSide)
  const client = new Client({ name: 'test', version: '1' })
  await client.connect(clientSide)
  return { ...harness, client }
}

const text = (result: Awaited<ReturnType<Client['callTool']>>) =>
  (result.content as { text: string }[])[0].text

describe('MCP server', () => {
  it('introduces itself and lists every tool with its annotations', async () => {
    const { client } = await connect()
    expect(client.getServerVersion()).toMatchObject({ name: 'viktorani', version: '1.2.3' })
    expect(client.getInstructions()).toMatch(/Replace from JSON/)
    const { tools } = await client.listTools()
    expect(tools.map(t => t.name)).toEqual(AUTHORING_TOOLS.map(t => t.name))
    expect(tools.find(t => t.name === 'list_questions')!.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    })
    expect(tools.find(t => t.name === 'delete_game')!.annotations).toMatchObject({
      destructiveHint: true,
    })
    expect(tools.find(t => t.name === 'create_tag')!.inputSchema).toMatchObject({
      type: 'object',
      required: ['name'],
    })
  })

  it('loads, edits and saves a backup through tool calls', async () => {
    const { client, files } = await connect()
    expect(
      (await client.callTool({ name: 'load_backup', arguments: { path: 'backup.json' } })).isError
    ).toBeFalsy()
    await client.callTool({ name: 'create_tag', arguments: { name: 'Music' } })
    const summary = JSON.parse(text(await client.callTool({ name: 'summary', arguments: {} })))
    expect(summary).toMatchObject({ unsaved: true, counts: { tags: 1 } })
    await client.callTool({ name: 'save', arguments: {} })
    expect(JSON.parse(files.get('backup.json')!).tags).toMatchObject([{ name: 'Music' }])
  })

  it('reports a refused request as a tool error, not a protocol failure', async () => {
    const { client } = await connect()
    const result = await client.callTool({ name: 'get_question', arguments: { id: 'nope' } })
    expect(result.isError).toBe(true)
    expect(text(result)).toBe('No question with id "nope"')
  })

  it('serves the loaded data as read-only resources', async () => {
    const { client } = await connect()
    await client.callTool({ name: 'create_tag', arguments: { name: 'Music' } })
    const { resources } = await client.listResources()
    expect(resources.map(r => r.uri)).toEqual([
      'viktorani://questions',
      'viktorani://games',
      'viktorani://layouts',
      'viktorani://themes',
    ])
    const read = await client.readResource({ uri: 'viktorani://questions' })
    expect(JSON.parse((read.contents[0] as { text: string }).text).tags).toMatchObject([
      { name: 'Music' },
    ])
  })
})
