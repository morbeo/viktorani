import React from 'react'

export interface StepConfig {
  label: string
}

interface StepsProps {
  steps: StepConfig[]
  /** 0-based index of the active step */
  current: number
}

/**
 * Compact dot + connector step indicator.
 *
 * States:
 *   completed  — filled dot (bg-ink)
 *   active     — filled dot with ring
 *   upcoming   — hollow dot (border-2 border-border)
 *
 * The current step label is shown centred below the track.
 */
export function Steps({ steps, current }: StepsProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Track */}
      <div className="flex items-center">
        {steps.map((step, i) => {
          const completed = i < current
          const active = i === current
          const last = i === steps.length - 1

          return (
            <React.Fragment key={step.label}>
              <div
                role="img"
                aria-label={
                  active
                    ? `${step.label} (current)`
                    : completed
                      ? `${step.label} (completed)`
                      : step.label
                }
                className={[
                  'h-2.5 w-2.5 rounded-full transition-colors duration-200',
                  completed
                    ? 'bg-ink'
                    : active
                      ? 'bg-ink ring-2 ring-ink ring-offset-2 ring-offset-cream'
                      : 'border-2 border-border bg-cream',
                ].join(' ')}
              />
              {!last && (
                <div
                  className={[
                    'h-px w-8 transition-colors duration-200',
                    completed ? 'bg-ink' : 'bg-border',
                  ].join(' ')}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Active step label */}
      <p className="text-xs transition-all duration-200" style={{ color: 'var(--color-muted)' }}>
        {steps[current]?.label}
      </p>
    </div>
  )
}
