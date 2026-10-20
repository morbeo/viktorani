import { useState, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Button, HelpTip, Icon, Input } from '@/components/ui'
import { JOIN_POLICY_HELP } from '@/components/gamemaster/join-policy-help'
import type {
  AnswersClose,
  TeamAnswering,
  RankTies,
  BuzzDeduplication,
  InputType,
  RevealTiming,
  TargetVisibility,
} from '@/db'
import { useAppSettings } from '@/hooks/useAppSettings'
import { MAX_PRESETS, MAX_TIMER_SECONDS } from '@/lib/app-settings'
import {
  GAME_SETTINGS_KEYS,
  LIVE_PRESET_KEYS,
  MAX_AUTO_ADVANCE_DELAY,
  MAX_LIMIT,
  matchPreset,
  pickGameSettings,
  presetPatch,
} from './game-settings'
import type { GameSettings } from './game-settings'

export interface GameSettingsFormProps {
  value: GameSettings
  /** Receives only the changed fields. */
  onChange: (patch: Partial<GameSettings>) => void
  /**
   * `create`: every setting, with joining, buzzer, round flow and sound under a collapsed
   * Advanced section.
   * `live`: joining, buzzer, round flow and sound only, all shown; scoring is shown locked.
   */
  mode: 'create' | 'live'
  disabled?: boolean
  /** Show the preset picker and Save as preset. Off when editing a preset itself. */
  presets?: boolean
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

const INPUT_OPTIONS: Array<{ value: InputType; label: string }> = [
  { value: 'none', label: 'Out loud' },
  { value: 'buzzer', label: 'Buzzer' },
  { value: 'choice', label: 'Pick an option' },
  { value: 'text', label: 'Type an answer' },
]

const CLOSE_OPTIONS: Array<{ value: AnswersClose; label: string }> = [
  { value: 'perQuestion', label: 'When I move on' },
  { value: 'endOfRound', label: 'At the end of the round' },
]

const TEAM_ANSWER_OPTIONS: Array<{ value: TeamAnswering; label: string }> = [
  { value: 'anyone', label: 'Anyone can change it' },
  { value: 'firstReply', label: 'First reply holds it' },
  { value: 'captain', label: 'Captain only' },
  { value: 'vote', label: 'Team vote' },
]

const TIE_OPTIONS: Array<{ value: RankTies; label: string }> = [
  { value: 'share', label: 'Share the place' },
  { value: 'mostCorrect', label: 'Most correct answers' },
]

const REVEAL_OPTIONS: Array<{ value: RevealTiming; label: string }> = [
  { value: 'manual', label: 'When I reveal it' },
  { value: 'perQuestion', label: 'After each ruling' },
  { value: 'endOfRound', label: 'At the end of the round' },
]

/** Game settings grouped into Basics, Joining, Answering and Visibility, with presets. */
export function GameSettingsForm({
  value,
  onChange,
  mode,
  disabled = false,
  presets: showPresets = true,
}: GameSettingsFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [{ gamePresets }, updateSettings] = useAppSettings()
  const [presetName, setPresetName] = useState<string | null>(null)
  const live = mode === 'live'
  // During a game a preset only sets joining and the buzzer
  const presetKeys = live ? LIVE_PRESET_KEYS : GAME_SETTINGS_KEYS
  const preset = matchPreset(value, gamePresets, presetKeys)

  function savePreset() {
    const label = presetName?.trim()
    if (!label) return
    const settings = pickGameSettings(value)
    updateSettings({
      gamePresets: [...gamePresets, { id: crypto.randomUUID(), label, description: '', settings }],
    })
    setPresetName(null)
  }

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
      <LimitStepper
        label="Rejoin window (seconds)"
        help="How long a disconnected device can still rejoin as the same player. 0 = no limit."
        value={value.rejoinWindowSeconds}
        disabled={disabled}
        onChange={v => onChange({ rejoinWindowSeconds: v })}
      />
      <LimitStepper
        label="Remove after disconnect (minutes)"
        help="A player who stays disconnected this long is marked as left, which frees their place when the game has a player cap. They can still rejoin if rejoining is allowed and a place is free. 0 = never."
        value={value.autoRemoveAfterMinutes}
        disabled={disabled}
        onChange={v => onChange({ autoRemoveAfterMinutes: v })}
      />
      <Toggle
        label="Require approval"
        help={JOIN_POLICY_HELP.requireApproval}
        checked={value.requireApproval}
        disabled={disabled}
        onChange={v => onChange({ requireApproval: v })}
      />
      <Toggle
        label="Allow spectators"
        help={JOIN_POLICY_HELP.allowSpectators}
        checked={value.allowSpectators}
        disabled={disabled}
        onChange={v => onChange({ allowSpectators: v })}
      />
      <Toggle
        label="Local network only"
        help={JOIN_POLICY_HELP.localNetworkOnly}
        checked={value.localNetworkOnly}
        disabled={disabled}
        onChange={v => onChange({ localNetworkOnly: v })}
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
      <LimitStepper
        label="Max players"
        help="No more players, teamed or not, can join once the game has this many."
        value={value.maxPlayers}
        disabled={disabled}
        onChange={v => onChange({ maxPlayers: v })}
      />
    </Section>
  )

  const buzzer = (
    <Section title="Answering">
      <Row
        label="How players answer"
        help="Out loud: players answer aloud or on paper and you rule on each question. Buzzer: players buzz in and you rule on each buzz. Pick an option: players tap an option of a multiple-choice or true/false question on their phones, and their answers are marked for them. Type an answer: players type their answer to any question on their phones, and you mark each one."
      >
        <Segmented
          label="How players answer"
          options={INPUT_OPTIONS}
          value={value.inputType}
          disabled={disabled}
          onChange={v => onChange({ inputType: v })}
        />
      </Row>
      {(value.inputType === 'choice' || value.inputType === 'text') && (
        <Row
          label="Close answers"
          help="When players can no longer answer a question. When I move on: as soon as you show the next question. At the end of the round: players can still answer the round's earlier questions until you click Close answers on the round sheet or leave the round, like handing in an answer sheet."
        >
          <Segmented
            label="Close answers"
            options={CLOSE_OPTIONS}
            value={value.answersClose}
            disabled={disabled}
            onChange={v => onChange({ answersClose: v })}
          />
        </Row>
      )}
      {(value.inputType === 'choice' || value.inputType === 'text') && (
        <Row
          label="Team answers"
          help="How a team's one answer is decided. Anyone can change it: any member can answer or change the team's answer. First reply holds it: the first member to answer holds the team's answer, and only they can change it. Captain only: only the team's captain answers; you pick captains in the team list, and otherwise it's the member who joined first. Team vote: each member votes, and the answer with the most votes counts; a tie goes to the answer voted for first."
        >
          <Segmented
            label="Team answers"
            options={TEAM_ANSWER_OPTIONS}
            value={value.teamAnswering}
            disabled={disabled}
            onChange={v => onChange({ teamAnswering: v })}
          />
        </Row>
      )}
      {value.inputType === 'buzzer' && (
        <>
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
        </>
      )}
    </Section>
  )

  const roundFlow = (
    <Section title="Round flow">
      <Toggle
        label="Confirm before skipping an unruled question"
        help="Ask before moving to the next question when the current one has no ruling yet."
        checked={value.confirmUnruledNavigation}
        disabled={disabled}
        onChange={v => onChange({ confirmUnruledNavigation: v })}
      />
      <Toggle
        label="Next question after a correct answer"
        help="Moves on by itself a few seconds after you rule a buzz correct. You can cancel it from the countdown."
        checked={value.autoAdvanceOnCorrect}
        disabled={disabled}
        onChange={v => onChange({ autoAdvanceOnCorrect: v })}
      />
      <Toggle
        label="Next question when the question timer runs out"
        help="Moves on by itself a few seconds after a question timer (one that resets every question) reaches zero. You can cancel it from the countdown."
        checked={value.autoAdvanceOnTimerExpiry}
        disabled={disabled}
        onChange={v => onChange({ autoAdvanceOnTimerExpiry: v })}
      />
      {(value.autoAdvanceOnCorrect || value.autoAdvanceOnTimerExpiry) && (
        <LimitStepper
          label="Countdown before moving on (seconds)"
          help="How long you have to cancel before the next question is shown."
          value={value.autoAdvanceDelaySeconds}
          min={1}
          max={MAX_AUTO_ADVANCE_DELAY}
          disabled={disabled}
          onChange={v => onChange({ autoAdvanceDelaySeconds: v })}
        />
      )}
      <Row
        label="Show the answer"
        help="When players and the screen see the correct answer. When I reveal it: only after you click Reveal answer on the question. After each ruling: as soon as you rule the question Correct, Wrong or Skip, or rule a buzz correct. At the end of the round: Next on the round's last question opens a review where you reveal the round's answers one by one or all at once in a table."
      >
        <Segmented
          label="Show the answer"
          options={REVEAL_OPTIONS}
          value={value.revealTiming}
          disabled={disabled}
          onChange={v => onChange({ revealTiming: v })}
        />
      </Row>
      {value.scoringEnabled && (
        <Toggle
          label="Hold scores until announced"
          help="Players and the screen keep seeing the scores from your last announcement while you mark. Click Announce scores to show the new ones. Final scores show when the game ends."
          checked={value.holdScores}
          disabled={disabled}
          onChange={v => onChange({ holdScores: v })}
        />
      )}
      {value.scoringEnabled && (
        <Row
          label="Tied scores"
          help="How teams or players with the same score are placed. Share the place: they share it (1, 2, 2, 4). Most correct answers: the one with more correct answers places higher, and those still level share the place."
        >
          <Segmented
            label="Tied scores"
            options={TIE_OPTIONS}
            value={value.rankTies}
            disabled={disabled}
            onChange={v => onChange({ rankTies: v })}
          />
        </Row>
      )}
      <Toggle
        label="Auto-start timer on question"
        help="Start a timer automatically whenever a question is shown, using the default duration below."
        checked={value.autoStartTimerOnQuestionShow}
        disabled={disabled}
        onChange={v => onChange({ autoStartTimerOnQuestionShow: v })}
      />
      {value.autoStartTimerOnQuestionShow && (
        <DurationInput
          label="Default timer duration"
          value={value.defaultTimerDuration}
          disabled={disabled}
          onChange={v => onChange({ defaultTimerDuration: v })}
        />
      )}
    </Section>
  )

  const sound = (
    <Section title="Sound">
      <Toggle
        label="Mute sound effects"
        help="Mutes the host's timer-expiry beep for everyone in this game."
        checked={value.soundEffectsMuted}
        disabled={disabled}
        onChange={v => onChange({ soundEffectsMuted: v })}
      />
    </Section>
  )

  return (
    <div className="flex flex-col gap-3">
      {showPresets && (
        <div className="flex flex-col gap-1.5">
          <Row
            label="Preset"
            help={
              live
                ? 'Sets the joining and buzzer settings from a saved preset. Manage presets in Settings → Game defaults.'
                : 'Sets every setting below from a saved preset. Manage presets in Settings → Game defaults.'
            }
          >
            <div className="flex items-center gap-2">
              {gamePresets.length > 0 && (
                <select
                  aria-label="Preset"
                  value={preset?.id ?? ''}
                  disabled={disabled}
                  onChange={e => {
                    const p = gamePresets.find(x => x.id === e.target.value)
                    if (p) onChange(presetPatch(p, presetKeys))
                  }}
                  className="px-2 py-1 rounded border text-xs outline-none max-w-[12rem] border-border bg-bg text-text"
                >
                  {!preset && (
                    <option value="" disabled>
                      Custom
                    </option>
                  )}
                  {gamePresets.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled || presetName !== null || gamePresets.length >= MAX_PRESETS}
                onClick={() => setPresetName('')}
              >
                Save as preset
              </Button>
            </div>
          </Row>
          {presetName !== null && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  id="new-preset-name"
                  label="Preset name"
                  value={presetName}
                  maxLength={60}
                  autoFocus
                  onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      savePreset()
                    }
                  }}
                />
              </div>
              <Button size="sm" onClick={savePreset} disabled={!presetName.trim()}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPresetName(null)}>
                Cancel
              </Button>
            </div>
          )}
          <p className="text-xs text-muted">
            {preset
              ? preset.description || `Matches the ${preset.label} preset.`
              : 'Custom: the settings below do not match a preset.'}
          </p>
        </div>
      )}

      {live ? (
        <Row
          label="Scoring"
          help="Scoring is set when the game is created and can't be changed once it exists."
        >
          <span className="inline-flex items-center gap-1 text-xs text-muted">
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
          {roundFlow}
          {sound}
        </>
      ) : (
        <>
          <button
            type="button"
            aria-expanded={showAdvanced}
            className="flex items-center gap-2 text-xs text-left transition-opacity hover:opacity-70 text-muted"
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
            Advanced: joining, buzzer, round flow and sound
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-1 gap-3">
              {joining}
              {buzzer}
              {roundFlow}
              {sound}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border px-3 pb-3 pt-1 border-border">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
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
        style={{ background: checked ? 'var(--color-text)' : 'var(--color-border)' }}
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
      className="inline-flex rounded border overflow-hidden shrink-0 border-border"
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
              background: on ? 'var(--color-text)' : 'transparent',
              color: on ? 'var(--color-bg)' : 'var(--color-muted)',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** A number stepper; `0` means no limit unless `min` is set above it. */
function LimitStepper({
  label,
  help,
  value,
  disabled,
  onChange,
  min = 0,
  max = MAX_LIMIT,
}: {
  label: string
  help: string
  value: number
  disabled: boolean
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  const unlimited = min === 0
  const btn = 'w-6 h-6 rounded border text-sm leading-none disabled:opacity-40'
  return (
    <Row label={label} help={help}>
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
          className={btn}
          style={{ borderColor: 'var(--color-border)' }}
        >
          −
        </button>
        <span className="mono text-xs w-16 text-center" aria-live="polite">
          {unlimited && value === 0 ? 'No limit' : value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
          className={btn}
          style={{ borderColor: 'var(--color-border)' }}
        >
          +
        </button>
        {unlimited && (
          <button
            type="button"
            aria-label={`No limit for ${label}`}
            disabled={disabled || value === 0}
            onClick={() => onChange(0)}
            className="text-xs underline disabled:opacity-40 disabled:no-underline text-muted"
          >
            ∞
          </button>
        )}
      </span>
    </Row>
  )
}

function toSeconds(value: string): number {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Minutes/seconds duration picker, e.g. for an auto-started timer's default length. */
function DurationInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: number
  disabled: boolean
  onChange: (v: number) => void
}) {
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  const inputStyle = {
    borderColor: 'var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
  }
  function setDuration(m: number, s: number) {
    onChange(Math.min(MAX_TIMER_SECONDS, Math.max(1, m * 60 + s)))
  }
  return (
    <Row label={label}>
      <fieldset className="flex items-end gap-2">
        <legend className="sr-only">{label}</legend>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Minutes
          <input
            type="number"
            min={0}
            max={99}
            disabled={disabled}
            value={minutes}
            onChange={e => setDuration(Math.min(99, toSeconds(e.target.value)), seconds)}
            className="w-16 px-2 py-1 rounded border text-sm outline-none"
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Seconds
          <input
            type="number"
            min={0}
            max={59}
            disabled={disabled}
            value={seconds}
            onChange={e => setDuration(minutes, Math.min(59, toSeconds(e.target.value)))}
            className="w-16 px-2 py-1 rounded border text-sm outline-none"
            style={inputStyle}
          />
        </label>
      </fieldset>
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
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
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
            <th key={c.target} scope="col" className="text-xs font-medium w-20 text-muted">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {VISIBILITY_ROWS.map(r => (
          <tr key={r.key} className="border-t border-border">
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
                  style={{ accentColor: 'var(--color-text)' }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
