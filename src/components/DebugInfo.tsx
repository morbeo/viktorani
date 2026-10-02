import { useEffect, useState } from 'react'
import { Copy, Database } from 'lucide-react'
import { Button, Icon, useToast } from '@/components/ui'
import { db } from '@/db'
import { buildInfo } from '@/buildInfo'
import { formatBytes } from '@/lib/format'

const REPO_URL = 'https://github.com/morbeo/viktorani'

interface AsyncInfo {
  storage: string
  swRegistration: string
}

async function loadAsyncInfo(): Promise<AsyncInfo> {
  let storage = 'unavailable'
  if (navigator.storage?.estimate) {
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate()
      storage = `${formatBytes(usage)} of ${formatBytes(quota)}`
    } catch {
      storage = 'error'
    }
  }
  let swRegistration = 'unsupported'
  if (navigator.serviceWorker?.getRegistration) {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const worker = reg?.active ?? reg?.waiting ?? reg?.installing
      swRegistration = worker ? worker.state : 'none'
    } catch {
      swRegistration = 'error'
    }
  }
  return { storage, swRegistration }
}

/**
 * Build and runtime info for bug reports, with Copy and demo data loading.
 * Shown on the debug page opened from the sidebar. Cosmetic only — show nothing sensitive.
 */
export default function DebugInfo() {
  const { addToast } = useToast()
  const [asyncInfo, setAsyncInfo] = useState<AsyncInfo | null>(null)
  const [loadingDemo, setLoadingDemo] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadAsyncInfo().then(info => {
      if (!cancelled) setAsyncInfo(info)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const { commit, runId } = buildInfo
  const rows: { label: string; value: string; href?: string }[] = [
    { label: 'Version', value: buildInfo.version },
    {
      label: 'Commit',
      value: commit.slice(0, 7),
      href: commit !== 'unknown' ? `${REPO_URL}/commit/${commit}` : undefined,
    },
    { label: 'Built / deployed', value: buildInfo.builtAt },
    {
      label: 'CI run',
      value: runId ? `#${buildInfo.runNumber ?? '?'} (${runId})` : 'local build',
      href: runId ? `${REPO_URL}/actions/runs/${runId}` : undefined,
    },
    { label: 'Ref', value: buildInfo.ref ?? '—' },
    { label: 'Mode', value: import.meta.env.MODE },
    { label: 'Database', value: `${db.name} v${db.verno}` },
    { label: 'Storage', value: asyncInfo?.storage ?? '…' },
    {
      label: 'Service worker',
      value: `${navigator.serviceWorker?.controller ? 'controlling' : 'not controlling'}, registration: ${asyncInfo?.swRegistration ?? '…'}`,
    },
    { label: 'Online', value: navigator.onLine ? 'yes' : 'no' },
    { label: 'Screen', value: `${window.screen.width}×${window.screen.height}` },
    {
      label: 'Viewport',
      value: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
    },
    { label: 'User agent', value: navigator.userAgent },
  ]

  async function handleLoadDemo() {
    setLoadingDemo(true)
    try {
      const { seedDemo, DEMO_GAME_NAME } = await import('@/db/demo')
      await seedDemo()
      addToast(`Demo data loaded: open "${DEMO_GAME_NAME}" in Games`)
    } catch {
      addToast('Could not load demo data', { variant: 'error' })
    } finally {
      setLoadingDemo(false)
    }
  }

  async function handleCopy() {
    const text = rows.map(r => `${r.label}: ${r.value}${r.href ? ` (${r.href})` : ''}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      addToast('Debug info copied')
    } catch {
      addToast('Could not copy debug info', { variant: 'error' })
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-4">
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
          Build and runtime info for bug reports. Demo data adds sample questions, rounds, teams
          and a ready-to-run game; loading it twice adds nothing.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleLoadDemo} disabled={loadingDemo}>
            <Icon icon={Database} size="sm" />
            Load demo data
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            <Icon icon={Copy} size="sm" />
            Copy
          </Button>
        </div>
      </div>

      <dl
        className="rounded-lg border p-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-xs"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {rows.map(r => (
          <div key={r.label} className="contents">
            <dt style={{ color: 'var(--color-muted)' }}>{r.label}</dt>
            <dd className="font-mono break-all" style={{ color: 'var(--color-ink)' }}>
              {r.href ? (
                <a href={r.href} target="_blank" rel="noreferrer" className="underline">
                  {r.value}
                </a>
              ) : (
                r.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
