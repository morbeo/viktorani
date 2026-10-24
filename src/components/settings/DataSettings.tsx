import { useEffect, useState } from 'react'
import { Database, Download, Trash2 } from 'lucide-react'
import { Button, Modal, Input, Icon } from '@/components/ui'
import {
  applySnapshot,
  exportDatabase,
  importDatabase,
  previewReplace,
  readSnapshot,
} from '@/db/snapshot'
import type { ParsedSnapshot, RemovalGroup } from '@/db/snapshot'
import { purgeDatabase, seedDefaults } from '@/db'
import { formatBytes } from '@/lib/format'
import { loadDemo } from '@/lib/load-demo'
import ReplaceImportModal from './ReplaceImportModal'

/** A validated backup waiting for the host to confirm a replace import. */
interface PendingReplace {
  fileName: string
  snapshot: ParsedSnapshot
  removals: RemovalGroup[]
}

interface StorageInfo {
  usage: string
  persisted: string
}

async function loadStorageInfo(): Promise<StorageInfo> {
  const info: StorageInfo = { usage: 'unavailable', persisted: 'unknown' }
  try {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate()
      info.usage = `${formatBytes(usage)} of ${formatBytes(quota)}`
    }
    if (navigator.storage?.persisted) {
      info.persisted = (await navigator.storage.persisted())
        ? 'Persistent: the browser keeps it under storage pressure'
        : 'Best effort: the browser may clear it under storage pressure'
    }
  } catch {
    // leave the defaults
  }
  return info
}

/** Storage usage, backup export and import, demo data, and purge. */
export default function DataSettings() {
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [purgeConfirm, setPurgeConfirm] = useState('')
  const [purging, setPurging] = useState(false)
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [pendingReplace, setPendingReplace] = useState<PendingReplace | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadStorageInfo().then(info => {
      if (!cancelled) setStorage(info)
    })
    return () => {
      cancelled = true
    }
  }, [])

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

  async function handlePickReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const snapshot = await readSnapshot(file)
      const removals = await previewReplace(snapshot)
      setPendingReplace({ fileName: file.name, snapshot, removals })
    } catch (err) {
      setMsg(`Import failed: ${(err as Error).message}`)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handleConfirmReplace() {
    if (!pendingReplace) return
    try {
      await applySnapshot(pendingReplace.snapshot, 'replace')
      setMsg('Data replaced from backup')
      setTimeout(() => setMsg(null), 3000)
    } catch (err) {
      setMsg(`Import failed: ${(err as Error).message}`)
    } finally {
      setPendingReplace(null)
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

  async function handleLoadDemo() {
    setLoadingDemo(true)
    try {
      const name = await loadDemo()
      setMsg(`Demo data loaded: open "${name}" in Games`)
      setTimeout(() => setMsg(null), 4000)
    } catch (err) {
      setMsg(`Demo data failed: ${(err as Error).message}`)
    } finally {
      setLoadingDemo(false)
    }
  }

  function closePurgeModal() {
    setPurgeOpen(false)
    setPurgeConfirm('')
  }

  const canPurge = purgeConfirm.trim().toLowerCase() === 'purge'

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="mb-3">
          <h2 className="font-semibold text-base text-text">Storage</h2>
          <p className="text-xs mt-0.5 text-muted">
            Everything is stored in this browser on this device
          </p>
        </div>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
          <dt className="text-muted">Used</dt>
          <dd>{storage?.usage ?? '…'}</dd>
          <dt className="text-muted">Kept</dt>
          <dd>{storage?.persisted ?? '…'}</dd>
        </dl>
      </section>

      {/* ── Data ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-3">
          <h2 className="font-semibold text-base text-text">Data</h2>
          <p className="text-xs mt-0.5 text-muted">
            Export and import your questions, games and settings as JSON
          </p>
        </div>

        {msg && (
          <p
            className="text-xs mb-3 px-3 py-2 rounded"
            style={{
              color: /^(Import|Purge|Demo data) failed/.test(msg)
                ? 'var(--color-negative)'
                : 'var(--color-positive)',
              background: /^(Import|Purge|Demo data) failed/.test(msg)
                ? 'var(--color-negative)1a'
                : 'var(--color-positive)1a',
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
              className="inline-flex items-center justify-center gap-2 font-medium rounded transition-all cursor-pointer px-4 py-2 text-sm border border-border text-text"
              style={{
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

          <label>
            <span className="inline-flex items-center justify-center gap-2 font-medium rounded transition-all cursor-pointer px-4 py-2 text-sm border border-border text-text">
              Replace from JSON
            </span>
            <input
              type="file"
              accept=".json"
              className="sr-only"
              aria-label="Replace from JSON"
              onChange={handlePickReplace}
              disabled={importing}
            />
          </label>
        </div>
        <p className="text-xs mt-2 text-muted">
          Import adds and updates. Replace also removes anything the file doesn't have, after you
          confirm.
        </p>
      </section>

      {/* ── Demo data ────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-base text-text">Demo data</h2>
            <p className="text-xs mt-0.5 text-muted">
              Adds sample questions, rounds, teams and a ready-to-run game to try things out.
              Loading it twice adds nothing.
            </p>
          </div>
          <Button variant="secondary" onClick={handleLoadDemo} disabled={loadingDemo}>
            <Icon icon={Database} size="sm" />
            {loadingDemo ? 'Loading…' : 'Load demo data'}
          </Button>
        </div>
      </section>

      {/* ── Danger zone ──────────────────────────────────────── */}
      <section>
        <div className="mb-3">
          <h2 className="font-semibold text-base text-negative">Danger zone</h2>
          <p className="text-xs mt-0.5 text-muted">
            Irreversible actions — export first if you want to keep your data
          </p>
        </div>

        <div
          className="rounded-lg border p-4 flex items-center justify-between gap-4"
          style={{ borderColor: 'var(--color-negative)55' }}
        >
          <div>
            <p className="text-sm font-medium text-text">Purge all data</p>
            <p className="text-xs mt-0.5 text-muted">
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
      <ReplaceImportModal
        fileName={pendingReplace?.fileName ?? null}
        removals={pendingReplace?.removals ?? []}
        onConfirm={handleConfirmReplace}
        onClose={() => setPendingReplace(null)}
      />

      {/* ── Purge confirm modal ───────────────────────────────── */}
      <Modal open={purgeOpen} title="Purge all data" onClose={closePurgeModal}>
        <div className="flex flex-col gap-4">
          <div
            className="rounded-lg px-4 py-3 text-sm text-text"
            style={{ background: 'var(--color-negative)11' }}
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
    </div>
  )
}
