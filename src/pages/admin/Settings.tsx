import AdminLayout from '@/components/AdminLayout'
import ManageTags from '@/components/settings/ManageTags'
import ManageDifficulties from '@/components/settings/ManageDifficulties'
import { exportDatabase, importDatabase } from '@/db/snapshot'
import { useState } from 'react'
import { Button } from '@/components/ui'

export default function Settings() {
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

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

  return (
    <AdminLayout title="Settings">
      <div className="max-w-2xl mx-auto flex flex-col gap-10 py-6 px-4">
        {/* ── Tags ─────────────────────────────────────────────── */}
        <ManageTags />

        {/* ── Difficulty levels ────────────────────────────────── */}
        <ManageDifficulties />

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
                color: msg.startsWith('Import failed') ? 'var(--color-red)' : 'var(--color-green)',
                background: msg.startsWith('Import failed')
                  ? 'var(--color-red)1a'
                  : 'var(--color-green)1a',
              }}
            >
              {msg}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={exportDatabase}>
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
      </div>
    </AdminLayout>
  )
}
