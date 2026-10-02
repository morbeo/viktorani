import AdminLayout from '@/components/AdminLayout'
import ManageTags from '@/components/settings/ManageTags'
import ManageDifficulties from '@/components/settings/ManageDifficulties'
import ManageLabels from '@/components/players-teams/ManageLabels'
import { exportDatabase, importDatabase } from '@/db/snapshot'
import { purgeDatabase, seedDefaults } from '@/db'
import { useState } from 'react'
import { Button, Modal, Input, Icon } from '@/components/ui'
import { Download, Trash2 } from 'lucide-react'
import { useActionMode } from '@/hooks/useActionMode'
import type { ActionMode } from '@/hooks/useActionMode'

const ACTION_MODE_OPTIONS: { value: ActionMode; label: string; description: string }[] = [
  { value: 'icons', label: 'Icons', description: 'Show icon only' },
  { value: 'text', label: 'Text', description: 'Show label only' },
  { value: 'both', label: 'Icons + text', description: 'Show icon and label' },
]

export default function Settings() {
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [purgeConfirm, setPurgeConfirm] = useState('')
  const [purging, setPurging] = useState(false)
  const [actionMode, setActionMode] = useActionMode()

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      await importDatabase(file)
      setMsg('Import successful')
      setTimeout(() => setMsg(null), 3000)
    } catch (err) {
      setMsg(`Import failed: ${(err as Error).message}`)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handlePurge() {
    if (purgeConfirm.trim().toLowerCase() !== 'purge') return
    setPurging(true)
    try {
      await purgeDatabase()
      await seedDefaults()
      setPurgeOpen(false)
      setPurgeConfirm('')
      setMsg('Database purged and reset to defaults')
      setTimeout(() => setMsg(null), 4000)
    } catch (err) {
      setMsg(`Purge failed: ${(err as Error).message}`)
    } finally {
      setPurging(false)
    }
  }

  function closePurgeModal() {
    setPurgeOpen(false)
    setPurgeConfirm('')
  }

  const canPurge = purgeConfirm.trim().toLowerCase() === 'purge'

  return (
    <AdminLayout title="Settings">
      <div className="max-w-2xl mx-auto flex flex-col gap-10 py-6 px-4">
        {/* ── Tags ─────────────────────────────────────────────── */}
        <ManageTags />

        {/* ── Difficulty levels ────────────────────────────────── */}
        <ManageDifficulties />

        {/* ── Labels ───────────────────────────────────────────── */}
        <ManageLabels />

        {/* ── Action buttons ───────────────────────────────────── */}
        <section>
          <div className="mb-3">
            <h2 className="font-semibold text-base" style={{ color: 'var(--color-ink)' }}>
              Action buttons
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              How row actions are displayed throughout the app
            </p>
          </div>

          <div className="flex gap-2">
            {ACTION_MODE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setActionMode(opt.value)}
                className="flex-1 flex flex-col items-center gap-1 rounded-lg border py-3 px-2 text-xs font-medium transition-all"
                style={{
                  borderColor:
                    actionMode === opt.value ? 'var(--color-ink)' : 'var(--color-border)',
                  background:
                    actionMode === opt.value ? 'var(--color-ink)' : 'var(--color-surface)',
                  color: actionMode === opt.value ? 'var(--color-cream)' : 'var(--color-muted)',
                }}
                aria-pressed={actionMode === opt.value}
                aria-label={opt.description}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Data ─────────────────────────────────────────────── */}
        <section>
          <div className="mb-3">
            <h2 className="font-semibold text-base" style={{ color: 'var(--color-ink)' }}>
              Data
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              Export and import your full database as JSON
            </p>
          </div>

          {msg && (
            <p
              className="text-xs mb-3 px-3 py-2 rounded"
              style={{
                color:
                  msg.startsWith('Import failed') || msg.startsWith('Purge failed')
                    ? 'var(--color-red)'
                    : 'var(--color-green)',
                background:
                  msg.startsWith('Import failed') || msg.startsWith('Purge failed')
                    ? 'var(--color-red)1a'
                    : 'var(--color-green)1a',
              }}
            >
              {msg}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={exportDatabase}>
              <Icon icon={Download} size="sm" />
              Export JSON
            </Button>

            <label>
              <span
                className="inline-flex items-center justify-center gap-2 font-medium rounded transition-all cursor-pointer px-4 py-2 text-sm border"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-ink)',
                  background: 'transparent',
                }}
              >
                {importing ? 'Importing…' : 'Import JSON'}
              </span>
              <input
                type="file"
                accept=".json"
                className="sr-only"
                onChange={handleImport}
                disabled={importing}
              />
            </label>
          </div>
        </section>

        {/* ── Danger zone ──────────────────────────────────────── */}
        <section>
          <div className="mb-3">
            <h2 className="font-semibold text-base" style={{ color: 'var(--color-red)' }}>
              Danger zone
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              Irreversible actions — export first if you want to keep your data
            </p>
          </div>

          <div
            className="rounded-lg border p-4 flex items-center justify-between gap-4"
            style={{ borderColor: 'var(--color-red)55' }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
                Purge all data
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                Deletes every question, round, game, note, tag and difficulty. Default tags and
                difficulties will be re-seeded.
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setPurgeOpen(true)}>
              <Icon icon={Trash2} size="sm" />
              Purge
            </Button>
          </div>
        </section>
      </div>

      {/* ── Purge confirm modal ───────────────────────────────── */}
      <Modal open={purgeOpen} title="Purge all data" onClose={closePurgeModal}>
        <div className="flex flex-col gap-4">
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{ background: 'var(--color-red)11', color: 'var(--color-ink)' }}
          >
            This will permanently delete <strong>all</strong> questions, rounds, games, notes, tags,
            and difficulty levels. This cannot be undone. Default tags and difficulties will be
            restored afterwards.
          </div>

          <Input
            label='Type "purge" to confirm'
            value={purgeConfirm}
            onChange={e => setPurgeConfirm(e.target.value)}
            placeholder="purge"
            onKeyDown={e => {
              if (e.key === 'Enter' && canPurge) handlePurge()
            }}
            autoFocus
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={closePurgeModal} disabled={purging}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handlePurge} disabled={!canPurge || purging}>
              {purging ? 'Purging…' : 'Purge all data'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
