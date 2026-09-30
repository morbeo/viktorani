import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Copy } from 'lucide-react'
import { Button, Icon, useToast } from '@/components/ui'
import { db } from '@/db'
import { buildInfo } from '@/buildInfo'

const STORAGE_KEY = 'viktorani:debug'
const REPO_URL = 'https://github.com/morbeo/viktorani'

interface AsyncInfo {
  storage: string
  swRegistration: string
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
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
 * Hidden debug section for bug reports. Opening Settings with `?debug=1` shows it and
 * remembers that in localStorage; `?debug=0` forgets it. Cosmetic only — show nothing sensitive.
 */
export default function DebugInfo() {
  const [params] = useSearchParams()
  const flag = params.get('debug')
  const visible = flag === '1' || (flag !== '0' && localStorage.getItem(STORAGE_KEY) === '1')

  useEffect(() => {
    if (flag === '1') localStorage.setItem(STORAGE_KEY, '1')
    else if (flag === '0') localStorage.removeItem(STORAGE_KEY)
  }, [flag])

  return visible ? <DebugPanel /> : null
}

function DebugPanel() {
  const { addToast } = useToast()
  const [asyncInfo, setAsyncInfo] = useState<AsyncInfo | null>(null)

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
        <div>
          <h2 className="font-semibold text-base" style={{ color: 'var(--color-ink)' }}>
            Debug
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
            Build and runtime info for bug reports. Hide with ?debug=0
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          <Icon icon={Copy} size="sm" />
          Copy
        </Button>
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
