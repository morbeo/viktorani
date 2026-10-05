import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, Copy, Check } from 'lucide-react'
import { Icon } from '@/components/ui'
import { joinUrl } from '@/pages/admin/gamemaster-utils'
import { useAppSettings } from '@/hooks/useAppSettings'
import type { Game } from '@/db'

/** The lobby's QR code, room code and copyable join URL. */
export function QrCodePanel({ game }: { game: Game }) {
  const [{ joinUrlBase }] = useAppSettings()
  const url = game.roomId ? joinUrl(game.roomId, joinUrlBase) : ''
  const [copied, setCopied] = useState(false)

  function handleCopyUrl() {
    if (!url) return
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="rounded-xl border flex flex-col items-center gap-4 p-6"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <p
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--color-muted)' }}
      >
        <Icon icon={QrCode} size="sm" />
        Scan to join
      </p>

      {url ? (
        <div className="rounded-lg p-3" style={{ background: '#fff' }}>
          <QRCodeSVG value={url} size={160} level="M" />
        </div>
      ) : (
        <div
          className="w-40 h-40 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--color-border)' }}
        >
          <span style={{ color: 'var(--color-muted)' }}>—</span>
        </div>
      )}

      {game.roomId && (
        <div className="text-center w-full">
          <p className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>
            Room code
          </p>
          <p
            className="mono text-3xl font-bold"
            style={{ color: 'var(--color-ink)', letterSpacing: '0.15em' }}
          >
            {game.roomId}
          </p>

          {/* Join URL + copy */}
          <div
            className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 w-full"
            style={{ background: 'var(--color-border)' }}
          >
            <span
              className="flex-1 text-xs truncate text-left mono"
              style={{ color: 'var(--color-muted)' }}
              title={url}
            >
              {url}
            </span>
            <button
              onClick={handleCopyUrl}
              className="shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
              style={{
                background: copied ? 'var(--color-green)22' : 'transparent',
                color: copied ? 'var(--color-green)' : 'var(--color-muted)',
              }}
              aria-label={copied ? 'Copied!' : 'Copy join URL'}
              title={copied ? 'Copied!' : 'Copy join URL'}
            >
              <Icon icon={copied ? Check : Copy} size="sm" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
