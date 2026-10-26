import { useAiTools } from '@/hooks/useAiTools'
import { modelContext } from '@/lib/ai-tools'

const GUIDE =
  'https://github.com/morbeo/viktorani/blob/master/docs/user-guide/host.md#8-using-an-ai-assistant'

/** The per-device switch for the game master's live AI tools (ADR 0021, step 2). */
export default function AiToolsSettings() {
  const [enabled, setEnabled] = useAiTools()
  const supported = modelContext() !== null

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          Let an AI assistant help run games on this device
        </label>
        <p className="text-xs text-muted">
          While a game is open in the game master, an assistant in this browser can read the game,
          move between questions, rule on answers, change scores, run timers and message players.
          Ending the game or kicking a player waits for your click. Off by default, and set on each
          device: backups don&apos;t carry it.
        </p>
      </div>

      <p
        className={`text-xs px-3 py-2 rounded ${supported ? 'bg-positive/10 text-text' : 'bg-surface text-muted'}`}
      >
        {supported
          ? 'This browser supports WebMCP, the way assistants use a page’s tools.'
          : 'This browser doesn’t support WebMCP yet. In Chrome, turn on chrome://flags/#enable-webmcp-testing and restart.'}
      </p>

      <p className="text-xs text-muted">
        To write questions or build games with an assistant, use the viktorani-mcp server instead.
        See{' '}
        <a href={GUIDE} target="_blank" rel="noreferrer" className="underline">
          Using an AI assistant
        </a>{' '}
        in the host guide.
      </p>
    </section>
  )
}
