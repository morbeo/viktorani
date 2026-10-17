/** Every component and module source, read as text. */
const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const TOKENS = [
  'bg',
  'surface',
  'text',
  'muted',
  'border',
  'accent',
  'accent-subtle',
  'on-accent',
  'positive',
  'negative',
]

describe('semantic colour tokens (ADR 0022)', () => {
  it('no source uses the deprecated palette names', () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => /--color-(cream|ink|gold|gold-light|red|green)\b/.test(text))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('sources only use known colour tokens', () => {
    const used = new Set<string>()
    for (const text of Object.values(sources)) {
      for (const m of text.matchAll(/--color-([a-z-]+)/g)) used.add(m[1])
    }
    // amber is a Toast fallback that resolves to its hex default
    const unknown = [...used].filter(name => !TOKENS.includes(name) && name !== 'amber')
    expect(unknown).toEqual([])
  })
})
