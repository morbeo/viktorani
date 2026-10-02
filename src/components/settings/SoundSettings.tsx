import { Volume2 } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { useAppSettings } from '@/hooks/useAppSettings'
import { playBeep } from '@/hooks/useTimer'

/** Master mute and volume for every sound the app plays. */
export default function SoundSettings() {
  const [settings, update] = useAppSettings()
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold text-base" style={{ color: 'var(--color-ink)' }}>
          Sound
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
          Applies to every sound on this device, such as the timer beep.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink)' }}>
        <input
          type="checkbox"
          checked={settings.soundMuted}
          onChange={e => update({ soundMuted: e.target.checked })}
        />
        Mute all sounds
      </label>
      <label className="flex flex-col gap-1 text-sm" style={{ color: 'var(--color-ink)' }}>
        <span>
          Volume <span className="mono">{settings.soundVolume}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={settings.soundVolume}
          disabled={settings.soundMuted}
          onChange={e => update({ soundVolume: Number(e.target.value) })}
          aria-label="Volume"
        />
      </label>
      <div>
        <Button variant="secondary" size="sm" onClick={() => playBeep()}>
          <Icon icon={Volume2} size="sm" />
          Test sound
        </Button>
      </div>
    </section>
  )
}
