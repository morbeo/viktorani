import { Select } from '@/components/ui'
import { GameSettingsForm } from '@/components/game-settings/GameSettingsForm'
import { useAppSettings } from '@/hooks/useAppSettings'
import type { GameDefaults } from '@/lib/app-settings'

const TIEBREAKER_OPTIONS = [{ value: 'serverOrder', label: 'First buzz to reach the host' }]

/** What the new-game wizard starts with. */
export default function GameDefaultsSettings() {
  const [settings, update] = useAppSettings()
  const value = settings.gameDefaults

  function change(patch: Partial<GameDefaults>) {
    update({ gameDefaults: { ...value, ...patch } })
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold text-base" style={{ color: 'var(--color-ink)' }}>
          New games
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
          What the new-game wizard starts with. Existing games keep their settings.
        </p>
      </div>
      <GameSettingsForm value={value} onChange={change} mode="create" />
      <Select
        id="game-tiebreaker"
        label="Tiebreaker"
        value={value.tiebreakerMode}
        options={TIEBREAKER_OPTIONS}
        onChange={e => change({ tiebreakerMode: e.target.value as GameDefaults['tiebreakerMode'] })}
      />
    </section>
  )
}
