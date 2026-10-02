import { useState, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { HelpTip, Icon } from '@/components/ui'
import { JOIN_POLICY_HELP } from '@/components/gamemaster/join-policy-help'
import type { BuzzDeduplication, TargetVisibility } from '@/db'
import { MAX_LIMIT, PRESETS, matchPreset } from './game-settings'
import type { GameSettings, PresetId } from './game-settings'

export interface GameSettingsFormProps {
  value: GameSettings
  /** Receives only the changed fields. */
  onChange: (patch: Partial<GameSettings>) => void
  /**
   * `create`: every setting, with joining and buzzer under a collapsed Advanced section.
   * `live`: joining and buzzer only, all shown; scoring is shown locked.
   */
  mode: 'create' | 'live'
  disabled?: boolean
}

const VISIBILITY_ROWS: Array<{ key: keyof TargetVisibility; label: string }> = [
  { key: 'showQuestion', label: 'Question text' },
  { key: 'showAnswers', label: 'Answers' },
  { key: 'showMedia', label: 'Media' },
]

const VISIBILITY_COLUMNS = [
  { target: 'players', label: 'Players' },
  { target: 'screen', label: 'Screen' },
] as const

const DEDUP_OPTIONS: Array<{ value: BuzzDeduplication; label: string }> = [
  { value: 'firstOnly', label: 'First per player' },
  { value: 'all', label: 'All attempts' },
]

/** Game settings grouped into Basics, Joining, Buzzer and Visibility, with presets. */
export function GameSettingsForm({
  value,
  onChange,
  mode,
  disabled = false,
}: GameSettingsFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const preset = matchPreset(value)
  const live = mode === 'live'

  const joining = (
    <Section title="Joining">
      <Toggle
        label="Individual play"
        help={JOIN_POLICY_HELP.allowIndividual}
        checked={value.allowIndividual}
        disabled={disabled}
        onChange={v => onChange({ allowIndividual: v })}
      />
      <Toggle
        label="Players may create teams"
        help={JOIN_POLICY_HELP.allowPlayerTeams}
        checked={value.allowPlayerTeams}
        disabled={disabled}
        onChange={v => onChange({ allowPlayerTeams: v })}
      />
      <Toggle
        label="Allow late join"
        help={JOIN_POLICY_HELP.allowLateJoin}
        checked={value.allowLateJoin}
        disabled={disabled}
        onChange={v => onChange({ allowLateJoin: v })}
      />
      <Toggle
        label="Allow rejoin"
        help={JOIN_POLICY_HELP.allowRejoin}
        checked={value.allowRejoin}
        disabled={disabled}
        onChange={v => onChange({ allowRejoin: v })}
      />
      <Toggle
        label="Require approval"
        help={JOIN_POLICY_HELP.requireApproval}
        checked={value.requireApproval}
        disabled={disabled}
        onChange={v => onChange({ requireApproval: v })}
      />
      <LimitStepper
        label="Max teams"
        help="Players can't create a new team once the game has this many teams."
        value={value.maxTeams}
        disabled={disabled}
        onChange={v => onChange({ maxTeams: v })}
      />
      <LimitStepper
        label="Max per team"
        help="Players can't join a team that already has this many members."
        value={value.maxPerTeam}
        disabled={disabled}
        onChange={v => onChange({ maxPerTeam: v })}
      />
    </Section>
  )

  const buzzer = (
    <Section title="Buzzer">
      <Toggle
        label="Auto-lock after a correct answer"
        help="When you rule a buzz correct, the buzzer locks so nobody else can buzz until you unlock it."
        checked={value.autoLockOnFirstCorrect}
        disabled={disabled}
        onChange={v => onChange({ autoLockOnFirstCorrect: v })}
      />
      <Toggle
        label="Record false starts"
        help="Buzzes pressed while the buzzer is locked are kept and marked as false starts in the buzz list. Off: they are ignored."
        checked={value.allowFalseStarts}
        disabled={disabled}
        onChange={v => onChange({ allowFalseStarts: v })}
      />
      <Row
        label="Buzz display"
        help="First per player: each player is listed once, at their first buzz. All attempts: every press is listed. Every buzz is recorded either way."
      >
        <Segmented
          label="Buzz display"
          options={DEDUP_OPTIONS}
          value={value.buzzDeduplication}
          disabled={disabled}
          onChange={v => onChange({ buzzDeduplication: v })}
        />
      </Row>
    </Section>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Row
          label="Preset"
          help="Sets the joining and buzzer settings for a common kind of game. Scoring and visibility are not changed."
        >
          <Segmented<PresetId | null>
            label="Preset"
            options={PRESETS.map(p => ({ value: p.id, label: p.label }))}
            value={preset}
            disabled={disabled}
            onChange={id => {
              const p = PRESETS.find(x => x.id === id)
              if (p) onChange(p.settings)
            }}
          />
        </Row>
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          {preset
            ? PRESETS.find(p => p.id === preset)?.description
            : 'Custom: the settings below do not match a preset.'}
        </p>
      </div>

      {live ? (
        <Row
          label="Scoring"
          help="Scoring is set when the game is created and can't be changed once it exists."
        >
          <span
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: 'var(--color-muted)' }}
          >
            <Icon icon={Lock} size="sm" />
            {value.scoringEnabled ? 'On' : 'Off'} · set when the game was created
          </span>
        </Row>
      ) : (
        <Toggle
          label="Scoring"
          help="Keep a score for each player and team. Can't be changed after the game is created."
          checked={value.scoringEnabled}
          disabled={disabled}
          onChange={v => onChange({ scoringEnabled: v })}
        />
      )}

      {!live && (
        <VisibilityMatrix
          value={value.visibility}
          disabled={disabled}
          onChange={visibility => onChange({ visibility })}
        />
      )}

      {live ? (
        <>
          {joining}
          {buzzer}
        </>
      ) : (
        <>
          <button
            type="button"
            aria-expanded={showAdvanced}
            className="flex items-center gap-2 text-xs text-left transition-opacity hover:opacity-70"
            style={{ color: 'var(--color-muted)' }}
            onClick={() => setShowAdvanced(s => !s)}
          >
            <span
              style={{
                transform: showAdvanced ? 'rotate(90deg)' : 'none',
                display: 'inline-block',
                transition: 'transform 0.15s',
              }}
            >
              ▶
            </span>
            Advanced: joining and buzzer
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-1 gap-3">
              {joining}
              {buzzer}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset
      className="flex flex-col gap-2 rounded-lg border px-3 pb-3 pt-1"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <legend
        className="px-1 text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--color-muted)' }}
      >
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

function Row({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-sm">
        {label}
        {help && <HelpTip label={`About ${label}`} text={help} />}
      </span>
      {children}
    </div>
  )
}

function Toggle({
  label,
  help,
  checked,
  disabled,
  onChange,
}: {
  label: string
  help?: string
  checked: boolean
  disabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Row label={label} help={help}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="w-10 h-5 rounded-full transition-all relative shrink-0"
        style={{ background: checked ? 'var(--color-ink)' : 'var(--color-border)' }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
          style={{ left: checked ? '1.25rem' : '0.125rem' }}
        />
      </button>
    </Row>
  )
}

function Segmented<T extends string | null>({
  label,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string
  options: Array<{ value: T; label: string }>
  value: T
  disabled: boolean
  onChange: (v: T) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded border overflow-hidden shrink-0"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {options.map(o => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className="px-2.5 py-1 text-xs font-medium transition-all"
            style={{
              background: on ? 'var(--color-ink)' : 'transparent',
              color: on ? 'var(--color-cream)' : 'var(--color-muted)',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function LimitStepper({
  label,
  help,
  value,
  disabled,
  onChange,
}: {
  label: string
  help: string
  value: number
  disabled: boolean
  onChange: (v: number) => void
}) {
  const btn = 'w-6 h-6 rounded border text-sm leading-none disabled:opacity-40'
  return (
    <Row label={label} help={help}>
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= 0}
          onClick={() => onChange(value - 1)}
          className={btn}
          style={{ borderColor: 'var(--color-border)' }}
        >
          −
        </button>
        <span className="mono text-xs w-16 text-center" aria-live="polite">
          {value === 0 ? 'No limit' : value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={disabled || value >= MAX_LIMIT}
          onClick={() => onChange(value + 1)}
          className={btn}
          style={{ borderColor: 'var(--color-border)' }}
        >
          +
        </button>
        <button
          type="button"
          aria-label={`No limit for ${label}`}
          disabled={disabled || value === 0}
          onClick={() => onChange(0)}
          className="text-xs underline disabled:opacity-40 disabled:no-underline"
          style={{ color: 'var(--color-muted)' }}
        >
          ∞
        </button>
      </span>
    </Row>
  )
}

function VisibilityMatrix({
  value,
  disabled,
  onChange,
}: {
  value: GameSettings['visibility']
  disabled: boolean
  onChange: (v: GameSettings['visibility']) => void
}) {
  return (
    <table className="w-full text-sm">
      <caption className="text-left pb-1">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-muted)' }}
        >
          Visibility
          <HelpTip
            label="About Visibility"
            text="What player phones and the screen show for each question. Hidden parts are never sent to that device. You can change this during the game from the question panel."
          />
        </span>
      </caption>
      <thead>
        <tr>
          <th className="sr-only">Shown</th>
          {VISIBILITY_COLUMNS.map(c => (
            <th
              key={c.target}
              scope="col"
              className="text-xs font-medium w-20"
              style={{ color: 'var(--color-muted)' }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {VISIBILITY_ROWS.map(r => (
          <tr key={r.key} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
            <th scope="row" className="text-left font-normal py-1">
              {r.label}
            </th>
            {VISIBILITY_COLUMNS.map(c => (
              <td key={c.target} className="text-center">
                <input
                  type="checkbox"
                  aria-label={`${c.label}: ${r.label}`}
                  checked={value[c.target][r.key]}
                  disabled={disabled}
                  onChange={e =>
                    onChange({
                      ...value,
                      [c.target]: { ...value[c.target], [r.key]: e.target.checked },
                    })
                  }
                  className="w-4 h-4 cursor-pointer"
                  style={{ accentColor: 'var(--color-ink)' }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
