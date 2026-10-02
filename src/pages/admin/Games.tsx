import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '@/components/AdminLayout'
import { Button, Badge, Input, Modal, Empty, HelpTip } from '@/components/ui'
import { JOIN_POLICY_HELP } from '@/components/gamemaster/join-policy-help'
import { db } from '@/db'
import type { Game, GameVisibility, Round, TargetVisibility } from '@/db'
import { generateRoomId } from '@/transport'
import { createGame, cloneGame, deleteGame } from '@/db/games'

// ─────────────────────────────────────────────────────────────────────────────
// Wizard state
// ─────────────────────────────────────────────────────────────────────────────

interface WizardState {
  // Step 1
  name: string
  scoringEnabled: boolean
  visibility: GameVisibility
  maxTeams: number
  maxPerTeam: number
  allowIndividual: boolean
  allowLateJoin: boolean
  allowRejoin: boolean
  requireApproval: boolean
  allowPlayerTeams: boolean
  // Buzzer config
  autoLockOnFirstCorrect: boolean
  allowFalseStarts: boolean
  buzzDeduplication: 'firstOnly' | 'all'
  // Step 2
  roundMode: 'existing' | 'custom'
  selectedRoundIds: string[]
  customRounds: { name: string; questionIds: string[] }[]
}

const VISIBILITY_TARGETS = [
  { target: 'players', title: 'Players see' },
  { target: 'screen', title: 'Screen shows' },
] as const

const VISIBILITY_FLAGS: Array<{ key: keyof TargetVisibility; label: string }> = [
  { key: 'showQuestion', label: 'Question text' },
  { key: 'showAnswers', label: 'Answers' },
  { key: 'showMedia', label: 'Media' },
]

function describeVisibility(v: TargetVisibility): string {
  const shown = VISIBILITY_FLAGS.filter(f => v[f.key]).map(f => f.label.toLowerCase())
  return shown.length ? shown.join(', ') : 'Nothing'
}

function defaultWizard(): WizardState {
  return {
    name: '',
    scoringEnabled: true,
    visibility: {
      players: { showQuestion: true, showAnswers: false, showMedia: true },
      screen: { showQuestion: true, showAnswers: false, showMedia: true },
    },
    maxTeams: 0,
    maxPerTeam: 0,
    allowIndividual: true,
    allowLateJoin: true,
    allowRejoin: true,
    requireApproval: false,
    allowPlayerTeams: true,
    autoLockOnFirstCorrect: false,
    allowFalseStarts: false,
    buzzDeduplication: 'firstOnly',
    roundMode: 'existing',
    selectedRoundIds: [],
    customRounds: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step indicators
// ─────────────────────────────────────────────────────────────────────────────

function Steps({ current }: { current: number }) {
  const steps = ['Basic settings', 'Select rounds', 'Review & create']
  return (
    <div className="flex items-center gap-0 mb-5">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              style={{
                background: i <= current ? 'var(--color-ink)' : 'var(--color-border)',
                color: i <= current ? 'var(--color-cream)' : 'var(--color-muted)',
              }}
            >
              {i + 1}
            </div>
            <span
              className="text-sm"
              style={{
                color: i === current ? 'var(--color-ink)' : 'var(--color-muted)',
                fontWeight: i === current ? 600 : 400,
              }}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="w-8 h-px mx-3" style={{ background: 'var(--color-border)' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 – Basic settings
// ─────────────────────────────────────────────────────────────────────────────

function Step1({
  state,
  set,
}: {
  state: WizardState
  set: (k: keyof WizardState, v: unknown) => void
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      {/* Game name — primary field, full width */}
      <Input
        label="Game name *"
        value={state.name}
        onChange={e => set('name', e.target.value)}
        placeholder="e.g. Friday Night Trivia"
      />

      <Toggle
        label="Scoring"
        checked={state.scoringEnabled}
        onChange={v => set('scoringEnabled', v)}
      />

      {/* Visibility toggles — one block per target */}
      <div className="grid grid-cols-2 gap-3">
        {VISIBILITY_TARGETS.map(({ target, title }) => (
          <div
            key={target}
            className="flex flex-col gap-0 rounded-lg border overflow-hidden"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div
              className="px-3 py-1.5 border-b"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-muted)' }}
              >
                {title}
              </p>
            </div>
            <div className="px-3 py-2 flex flex-col gap-2">
              {VISIBILITY_FLAGS.map(({ key, label }) => (
                <Toggle
                  key={key}
                  label={label}
                  checked={state.visibility[target][key]}
                  onChange={v =>
                    set('visibility', {
                      ...state.visibility,
                      [target]: { ...state.visibility[target], [key]: v },
                    })
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Advanced — collapsed by default */}
      <button
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
        Teams & joining
      </button>

      {showAdvanced && (
        <div
          className="flex flex-col gap-3 rounded-lg border p-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Toggle
            label="Allow individual play (no team)"
            help={JOIN_POLICY_HELP.allowIndividual}
            checked={state.allowIndividual}
            onChange={v => set('allowIndividual', v)}
          />
          <Toggle
            label="Players may create their own team"
            help={JOIN_POLICY_HELP.allowPlayerTeams}
            checked={state.allowPlayerTeams}
            onChange={v => set('allowPlayerTeams', v)}
          />
          <Toggle
            label="Allow joining after the game starts"
            help={JOIN_POLICY_HELP.allowLateJoin}
            checked={state.allowLateJoin}
            onChange={v => set('allowLateJoin', v)}
          />
          <Toggle
            label="Allow players to rejoin"
            help={JOIN_POLICY_HELP.allowRejoin}
            checked={state.allowRejoin}
            onChange={v => set('allowRejoin', v)}
          />
          <Toggle
            label="Require approval to join"
            help={JOIN_POLICY_HELP.requireApproval}
            checked={state.requireApproval}
            onChange={v => set('requireApproval', v)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Max teams (0 = ∞)"
              help="Players can't create a new team once the game has this many teams. 0: no limit."
              type="number"
              min={0}
              value={state.maxTeams}
              onChange={e => set('maxTeams', +e.target.value)}
            />
            <Input
              label="Max per team (0 = ∞)"
              help="Players can't join a team that already has this many members. 0: no limit."
              type="number"
              min={0}
              value={state.maxPerTeam}
              onChange={e => set('maxPerTeam', +e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Buzzer configuration */}
      <div
        className="flex flex-col gap-3 rounded-lg border p-3"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-muted)' }}
        >
          Buzzer behaviour
        </p>
        <Toggle
          label="Auto-lock after first correct answer"
          help="When you rule a buzz correct, the buzzer locks so nobody else can buzz until you unlock it."
          checked={state.autoLockOnFirstCorrect}
          onChange={v => set('autoLockOnFirstCorrect', v)}
        />
        <Toggle
          label="Record false starts (buzzes before unlock)"
          help="Buzzes pressed while the buzzer is locked are kept and marked as false starts in the buzz list. Off: they are ignored."
          checked={state.allowFalseStarts}
          onChange={v => set('allowFalseStarts', v)}
        />
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-sm">
            Buzz display
            <HelpTip
              label="About Buzz display"
              text="First buzz per player: each player is listed once, at their first buzz. All attempts: every press is listed. Every buzz is recorded either way."
            />
          </span>
          <div className="flex gap-2">
            {(['firstOnly', 'all'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => set('buzzDeduplication', mode)}
                className="px-3 py-1.5 rounded text-xs font-medium border transition-all"
                style={{
                  borderColor:
                    state.buzzDeduplication === mode ? 'var(--color-ink)' : 'var(--color-border)',
                  background: state.buzzDeduplication === mode ? 'var(--color-ink)' : 'transparent',
                  color:
                    state.buzzDeduplication === mode ? 'var(--color-cream)' : 'var(--color-muted)',
                }}
              >
                {mode === 'firstOnly' ? 'First buzz per player' : 'All attempts'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string
  help?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer gap-4">
      <span className="flex items-center gap-1.5 text-sm">
        {label}
        {help && <HelpTip label={`About ${label}`} text={help} />}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="w-10 h-5 rounded-full transition-all relative shrink-0"
        style={{ background: checked ? 'var(--color-ink)' : 'var(--color-border)' }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
          style={{ left: checked ? '1.25rem' : '0.125rem' }}
        />
      </button>
    </label>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 – Select rounds
// ─────────────────────────────────────────────────────────────────────────────

function Step2({
  state,
  set,
  rounds,
}: {
  state: WizardState
  set: (k: keyof WizardState, v: unknown) => void
  rounds: Round[]
}) {
  function toggleRound(id: string) {
    const ids = state.selectedRoundIds
    set('selectedRoundIds', ids.includes(id) ? ids.filter(r => r !== id) : [...ids, id])
  }

  function moveRound(id: string, dir: -1 | 1) {
    const ids = [...state.selectedRoundIds]
    const i = ids.indexOf(id)
    if (i + dir < 0 || i + dir >= ids.length) return
    const tmp = ids[i]
    ids[i] = ids[i + dir]
    ids[i + dir] = tmp
    set('selectedRoundIds', ids)
  }

  const totalQuestions = state.selectedRoundIds.reduce((sum, rid) => {
    const r = rounds.find(r => r.id === rid)
    return sum + (r?.questionIds.length ?? 0)
  }, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Mode tabs */}
      <div
        className="flex rounded-lg border overflow-hidden"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {(['existing', 'custom'] as const).map(m => (
          <button
            key={m}
            onClick={() => set('roundMode', m)}
            className="flex-1 py-2 text-sm font-medium transition-all"
            style={{
              background: state.roundMode === m ? 'var(--color-ink)' : 'transparent',
              color: state.roundMode === m ? 'var(--color-cream)' : 'var(--color-muted)',
            }}
          >
            {m === 'existing' ? 'Use existing rounds' : 'Create new rounds'}
          </button>
        ))}
      </div>

      {state.roundMode === 'existing' && (
        <>
          {rounds.length === 0 ? (
            <Empty icon="◎" message="No rounds yet. Create some in the Questions page first." />
          ) : (
            <>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                Select and order the rounds for this game.
              </p>
              <div className="flex flex-col gap-2">
                {rounds.map(r => {
                  const selected = state.selectedRoundIds.includes(r.id)
                  const pos = state.selectedRoundIds.indexOf(r.id)
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all"
                      style={{
                        borderColor: selected ? 'var(--color-gold)' : 'var(--color-border)',
                        background: selected ? 'var(--color-gold-light)' : 'var(--color-surface)',
                      }}
                      onClick={() => toggleRound(r.id)}
                    >
                      <div
                        className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{
                          borderColor: selected ? 'var(--color-gold)' : 'var(--color-border)',
                          background: selected ? 'var(--color-gold)' : 'transparent',
                          color: '#fff',
                        }}
                      >
                        {selected ? pos + 1 : ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{r.name}</p>
                        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                          {r.questionIds.length} question{r.questionIds.length !== 1 ? 's' : ''}
                          {r.description ? ` · ${r.description}` : ''}
                        </p>
                      </div>
                      {selected && (
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => moveRound(r.id, -1)}
                            className="text-xs px-1 hover:opacity-60"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveRound(r.id, 1)}
                            className="text-xs px-1 hover:opacity-60"
                          >
                            ▼
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {state.selectedRoundIds.length > 0 && (
                <p className="text-sm font-medium" style={{ color: 'var(--color-green)' }}>
                  ✓ {state.selectedRoundIds.length} round
                  {state.selectedRoundIds.length > 1 ? 's' : ''} · {totalQuestions} questions total
                </p>
              )}
            </>
          )}
        </>
      )}

      {state.roundMode === 'custom' && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        >
          Custom round builder coming in a future update. For now, create rounds in the Questions
          page and select them here.
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 – Review
// ─────────────────────────────────────────────────────────────────────────────

function Step3({ state, rounds }: { state: WizardState; rounds: Round[] }) {
  const selectedRounds = state.selectedRoundIds
    .map(id => rounds.find(r => r.id === id))
    .filter(Boolean) as Round[]
  const totalQ = selectedRounds.reduce((s, r) => s + r.questionIds.length, 0)

  const rows = [
    ['Game name', state.name],
    ['Scoring', state.scoringEnabled ? 'Enabled' : 'Disabled'],
    ['Players see', describeVisibility(state.visibility.players)],
    ['Screen shows', describeVisibility(state.visibility.screen)],
    ['Individual play', state.allowIndividual ? 'Allowed' : 'Teams only'],
    ['Max teams', state.maxTeams === 0 ? 'Unlimited' : String(state.maxTeams)],
    ['Max per team', state.maxPerTeam === 0 ? 'Unlimited' : String(state.maxPerTeam)],
    ['Player-made teams', state.allowPlayerTeams ? 'Allowed' : 'No'],
    ['Late join', state.allowLateJoin ? 'Allowed' : 'No'],
    ['Rejoin', state.allowRejoin ? 'Allowed' : 'No'],
    ['Join approval', state.requireApproval ? 'Required' : 'Not required'],
    ['Rounds', `${selectedRounds.length} round${selectedRounds.length !== 1 ? 's' : ''}`],
    ['Questions', `${totalQ} total`],
  ]

  return (
    <div className="flex flex-col gap-6">
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className="flex items-center justify-between px-4 py-2.5 text-sm"
            style={{ background: i % 2 === 0 ? 'var(--color-surface)' : 'transparent' }}
          >
            <span style={{ color: 'var(--color-muted)' }}>{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>

      {selectedRounds.length > 0 && (
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-muted)' }}
          >
            Round order
          </p>
          <div className="flex flex-col gap-1.5">
            {selectedRounds.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 text-sm">
                <span
                  className="mono text-xs w-5 text-center"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {i + 1}
                </span>
                <span className="font-medium">{r.name}</span>
                <span style={{ color: 'var(--color-muted)' }}>· {r.questionIds.length}q</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Wizard modal
// ─────────────────────────────────────────────────────────────────────────────

function GameWizard({
  onClose,
  onCreated,
  rounds,
}: {
  onClose: () => void
  onCreated: (id: string) => void
  rounds: Round[]
}) {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(defaultWizard)
  const [saving, setSaving] = useState(false)

  function set(key: keyof WizardState, value: unknown) {
    setState(s => ({ ...s, [key]: value }))
  }

  const canNext =
    step === 0
      ? state.name.trim().length > 0
      : step === 1
        ? // The custom round builder is a placeholder (#288); a game needs at least one question
          state.roundMode === 'existing' &&
          rounds.some(r => state.selectedRoundIds.includes(r.id) && r.questionIds.length > 0)
        : true

  async function handleCreate() {
    setSaving(true)
    try {
      const now = Date.now()
      const game: Game = {
        id: crypto.randomUUID(),
        name: state.name.trim(),
        status: 'waiting',
        roomId: generateRoomId(),
        visibility: state.visibility,
        maxTeams: state.maxTeams,
        maxPerTeam: state.maxPerTeam,
        allowIndividual: state.allowIndividual,
        allowLateJoin: state.allowLateJoin,
        allowRejoin: state.allowRejoin,
        requireApproval: state.requireApproval,
        allowPlayerTeams: state.allowPlayerTeams,
        roundIds: state.selectedRoundIds,
        currentRoundIdx: 0,
        currentQuestionIdx: 0,
        buzzerLocked: true,
        scoringEnabled: state.scoringEnabled,
        autoLockOnFirstCorrect: state.autoLockOnFirstCorrect,
        allowFalseStarts: state.allowFalseStarts,
        buzzDeduplication: state.buzzDeduplication,
        tiebreakerMode: 'serverOrder' as const,
        createdAt: now,
        updatedAt: now,
      }
      await createGame(game, rounds)

      onCreated(game.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    // Custom dialog — fixed viewport-aware height so footer buttons are always visible
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(26,22,16,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-xl border shadow-2xl flex flex-col"
        style={{
          maxWidth: 560,
          maxHeight: 'calc(100vh - 80px)',
          background: 'var(--color-cream)',
          borderColor: 'var(--color-border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-4 pb-3 shrink-0 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h3 className="text-lg font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
            New game
          </h3>
          <button
            onClick={onClose}
            className="text-xl leading-none hover:opacity-60 transition-opacity"
            style={{ color: 'var(--color-muted)' }}
          >
            ×
          </button>
        </div>

        {/* Step indicators */}
        <div className="px-6 pt-3 pb-1 shrink-0">
          <Steps current={step} />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {step === 0 && <Step1 state={state} set={set} />}
          {step === 1 && <Step2 state={state} set={set} rounds={rounds} />}
          {step === 2 && <Step3 state={state} rounds={rounds} />}
        </div>

        {/* Pinned footer — always visible */}
        <div
          className="flex justify-between gap-2 px-6 py-3 shrink-0 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Button variant="ghost" onClick={step === 0 ? onClose : () => setStep(s => s - 1)}>
            {step === 0 ? 'Cancel' : '← Back'}
          </Button>
          {step < 2 ? (
            <Button variant="primary" disabled={!canNext} onClick={() => setStep(s => s + 1)}>
              Next →
            </Button>
          ) : (
            <Button variant="primary" disabled={saving} onClick={handleCreate}>
              {saving ? 'Creating…' : 'Create game'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  waiting: 'var(--color-muted)',
  active: 'var(--color-green)',
  paused: 'var(--color-gold)',
  ended: 'var(--color-red)',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge style={{ background: STATUS_COLOR[status] + '22', color: STATUS_COLOR[status] }}>
      {status}
    </Badge>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function Games() {
  const navigate = useNavigate()
  const [games, setGames] = useState<Game[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [wizard, setWizard] = useState(false)
  const [deleting, setDeleting] = useState<Game | null>(null)

  async function load() {
    const [gs, rs] = await Promise.all([
      db.games.orderBy('createdAt').reverse().toArray(),
      db.rounds.toArray(),
    ])
    setGames(gs)
    setRounds(rs)
  }

  useEffect(() => {
    void load() // eslint-disable-line react-hooks/set-state-in-effect
  }, [])

  async function handleDelete(game: Game) {
    await deleteGame(game.id)
    setDeleting(null)
    load()
  }

  async function handleClone(game: Game) {
    const newId = await cloneGame(game)
    await load()
    navigate(`/admin/game/${newId}`)
  }

  const grouped = {
    active: games.filter(g => g.status === 'active' || g.status === 'paused'),
    waiting: games.filter(g => g.status === 'waiting'),
    ended: games.filter(g => g.status === 'ended'),
  }

  return (
    <AdminLayout title="Games">
      <div className="flex items-center justify-between mb-6">
        <p style={{ color: 'var(--color-muted)' }}>
          {games.length} game{games.length !== 1 ? 's' : ''}
        </p>
        <Button variant="primary" onClick={() => setWizard(true)}>
          + New game
        </Button>
      </div>

      {games.length === 0 ? (
        <Empty icon="▶" message="No games yet. Create your first one." />
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(grouped).map(([group, gs]) =>
            gs.length === 0 ? null : (
              <div key={group}>
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {group === 'active'
                    ? 'Active / Paused'
                    : group === 'waiting'
                      ? 'Waiting to start'
                      : 'Ended'}
                </p>
                <div className="flex flex-col gap-3">
                  {gs.map(game => {
                    return (
                      <div
                        key={game.id}
                        className="flex items-center gap-4 p-4 rounded-lg border transition-all hover:shadow-sm"
                        style={{
                          borderColor: 'var(--color-border)',
                          background: 'var(--color-surface)',
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold truncate">{game.name}</span>
                            <StatusBadge status={game.status} />
                          </div>
                          <div
                            className="flex items-center gap-3 text-xs"
                            style={{ color: 'var(--color-muted)' }}
                          >
                            <span className="mono">{game.roomId}</span>
                            <span>·</span>
                            <span>
                              {game.roundIds.length} round{game.roundIds.length !== 1 ? 's' : ''}
                            </span>
                            <span>·</span>
                            <span>{new Date(game.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/admin/game/${game.id}`)}
                          >
                            {game.status === 'waiting' ? 'Open' : 'Manage'}
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleClone(game)}>
                            Clone
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            style={{ color: 'var(--color-red)' }}
                            onClick={() => setDeleting(game)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {wizard && (
        <GameWizard
          rounds={rounds}
          onClose={() => setWizard(false)}
          onCreated={id => {
            setWizard(false)
            navigate(`/admin/game/${id}`)
          }}
        />
      )}

      {/* Delete confirm */}
      <Modal open={!!deleting} title="Delete game" onClose={() => setDeleting(null)}>
        <p className="text-sm mb-5" style={{ color: 'var(--color-muted)' }}>
          Delete <strong>{deleting?.name}</strong>? This will permanently remove all players, buzz
          events, and scores. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => deleting && handleDelete(deleting)}>
            Delete game
          </Button>
        </div>
      </Modal>
    </AdminLayout>
  )
}
