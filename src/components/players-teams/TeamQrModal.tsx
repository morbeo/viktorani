import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { db } from '@/db'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ManagedTeam, TeamQrPayload, ManagedLabel, ManagedPlayer } from '@/types/players-teams'
import { Modal, Button } from '@/components/ui'

interface Props {
  team: ManagedTeam | null
  open: boolean
  onClose: () => void
}

interface Resolved {
  payload: TeamQrPayload
  labels: ManagedLabel[]
}

export default function TeamQrModal({ team, open, onClose }: Props) {
  // Single query: resolve labels and players then build payload atomically.
  const resolved = useLiveQuery<Resolved | null>(async () => {
    if (!team) return null
    const [labels, players] = await Promise.all([
      team.labelIds.length
        ? db.managedLabels.where('id').anyOf(team.labelIds).toArray()
        : Promise.resolve([] as ManagedLabel[]),
      team.playerIds.length
        ? db.managedPlayers.where('id').anyOf(team.playerIds).toArray()
        : Promise.resolve([] as ManagedPlayer[]),
    ])
    const activePlayers = players.filter(p => !p.archivedAt)
    return {
      payload: {
        type: 'viktorani/team/v1',
        id: team.id,
        name: team.name,
        color: team.color,
        icon: team.icon,
        labels: labels.map(l => l.name),
        players: activePlayers.map(p => ({ id: p.id, name: p.name })),
      },
      labels,
    }
  }, [team?.id, team?.labelIds.join(','), team?.playerIds.join(',')])

  const svgRef = useRef<SVGSVGElement>(null)

  function downloadSvg() {
    const svg = svgRef.current
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team-qr-${team?.name ?? 'unknown'}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!team || !resolved) return null

  const { payload, labels } = resolved
  const value = JSON.stringify(payload)
  const activePlayerCount = payload.players.length

  return (
    <Modal open={open} onClose={onClose} title={`QR — ${team.name}`} maxWidth="320px">
      <div className="flex flex-col items-center gap-4">
        <div
          className="p-3 rounded-lg border"
          style={{ borderColor: 'var(--color-border)', background: '#ffffff' }}
          aria-label="Team QR code"
        >
          <QRCodeSVG value={value} size={180} level="M" ref={svgRef as React.Ref<SVGSVGElement>} />
        </div>

        <div className="w-full text-left flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className="w-5 h-5 rounded flex items-center justify-center text-xs text-white shrink-0"
              style={{ background: team.color }}
              aria-hidden
            >
              {team.icon}
            </span>
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
              {team.name}
            </p>
          </div>

          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {activePlayerCount} player{activePlayerCount !== 1 ? 's' : ''} in roster snapshot
          </p>

          {labels.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-0.5">
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
            Generated fresh — roster reflects current active members.
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
