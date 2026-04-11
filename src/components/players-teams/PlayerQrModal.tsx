import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { db } from '@/db'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ManagedPlayer, PlayerQrPayload, ManagedLabel } from '@/types/players-teams'
import { Modal, Button } from '@/components/ui'

interface Props {
  player: ManagedPlayer | null
  open: boolean
  onClose: () => void
}

interface Resolved {
  payload: PlayerQrPayload
  labels: ManagedLabel[]
}

export default function PlayerQrModal({ player, open, onClose }: Props) {
  // Single query: resolve labels then build payload atomically so the
  // QR value and the chip UI are always in sync and never stale.
  const resolved = useLiveQuery<Resolved | null>(async () => {
    if (!player) return null
    const labels = player.labelIds.length
      ? await db.managedLabels.where('id').anyOf(player.labelIds).toArray()
      : []
    return {
      payload: {
        type: 'viktorani/player/v1',
        id: player.id,
        name: player.name,
        labels: labels.map(l => l.name),
      },
      labels,
    }
  }, [player?.id, player?.labelIds.join(',')])

  const svgRef = useRef<SVGSVGElement>(null)

  function downloadSvg() {
    const svg = svgRef.current
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `player-qr-${player?.name ?? 'unknown'}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Don't render until both player and resolved data are ready
  if (!player || !resolved) return null

  const { payload, labels } = resolved
  const value = JSON.stringify(payload)

  return (
    <Modal open={open} onClose={onClose} title={`QR — ${player.name}`} maxWidth="320px">
      <div className="flex flex-col items-center gap-4">
        <div
          className="p-3 rounded-lg border"
          style={{ borderColor: 'var(--color-border)', background: '#ffffff' }}
          aria-label="Player QR code"
        >
          <QRCodeSVG value={value} size={180} level="M" ref={svgRef as React.Ref<SVGSVGElement>} />
        </div>

        <div className="w-full text-left flex flex-col gap-1">
          <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
            {player.name}
          </p>
          {labels.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {labels.map(l => (
                <span
                  key={l.id}
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: l.color + '22',
                    color: l.color,
                    border: `1px solid ${l.color}44`,
                  }}
                >
                  {l.name}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
            Generated fresh — always reflects current data.
          </p>
        </div>

        <div className="flex gap-2 w-full">
          <Button variant="secondary" size="sm" onClick={downloadSvg} style={{ flex: 1 }}>
            Download SVG
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} style={{ flex: 1 }}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
