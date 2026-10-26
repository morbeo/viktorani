import { Button, Modal } from '@/components/ui'
import { useAiConfirmations } from '@/hooks/useAiTools'
import { answerConfirmation } from '@/lib/ai-tools'

interface AiToolsStatusProps {
  /** Whether the live tools are registered with the browser right now. */
  active: boolean
}

/**
 * The game master's view of the live AI tools: a badge while they are registered, and the
 * dialog where the host allows or denies an action an assistant asked for. Closing the dialog
 * denies.
 */
export function AiToolsStatus({ active }: AiToolsStatusProps) {
  const pending = useAiConfirmations()
  const current = pending[0]

  return (
    <>
      {active && (
        <span
          role="status"
          className="fixed bottom-3 left-3 z-40 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border text-xs font-medium text-text bg-surface shadow"
          title="An assistant in this browser can use the game master's tools. Turn this off in Settings → AI tools."
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />
          AI tools active
        </span>
      )}
      <Modal
        open={current !== undefined}
        onClose={() => current && answerConfirmation(current.id, false)}
        title="An assistant asks to…"
      >
        {current && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold text-text">{current.title}</p>
              {current.detail && <p className="text-sm text-muted">{current.detail}</p>}
            </div>
            {pending.length > 1 && (
              <p className="text-xs text-muted">{pending.length - 1} more waiting after this.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => answerConfirmation(current.id, false)}>
                Deny
              </Button>
              <Button variant="danger" onClick={() => answerConfirmation(current.id, true)}>
                Allow
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
