import { useState } from 'react'
import { Input } from '@/components/ui'
import { useAppSettings } from '@/hooks/useAppSettings'
import { isHttpUrl } from '@/lib/app-settings'

const isValidBase = (value: string) => value.trim() === '' || isHttpUrl(value.trim())

/** Delete confirmations and the base URL for player join links. */
export default function GeneralSettings() {
  const [settings, update] = useAppSettings()
  const [base, setBase] = useState(settings.joinUrlBase)
  const valid = isValidBase(base)

  function changeBase(value: string) {
    setBase(value)
    if (isValidBase(value)) update({ joinUrlBase: value.trim() })
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink)' }}>
          <input
            type="checkbox"
            checked={settings.confirmDestructive}
            onChange={e => update({ confirmDestructive: e.target.checked })}
          />
          Confirm destructive actions
        </label>
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          Ask before deleting questions, rounds and games, and before archiving players or teams
          in bulk. Purging all data always asks.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <Input
          id="join-url-base"
          label="Player join URL base"
          help="For a custom domain or a LAN address. The join link and QR code in the lobby use it. Leave empty to use this page's address."
          type="url"
          placeholder={window.location.origin + window.location.pathname}
          value={base}
          onChange={e => changeBase(e.target.value)}
          aria-invalid={!valid}
          aria-describedby={valid ? undefined : 'join-url-base-error'}
        />
        {!valid && (
          <p id="join-url-base-error" className="text-xs" style={{ color: 'var(--color-red)' }}>
            Enter an http:// or https:// address, or leave it empty.
          </p>
        )}
      </div>
    </section>
  )
}
