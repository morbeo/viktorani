/** Stand-in for a widget whose live-data rendering isn't wired up yet (see #410). */
export function WidgetPlaceholder({ label }: { label: string }) {
  return (
    <div
      className="rounded-xl border border-dashed flex items-center justify-center p-6 text-sm"
      style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
    >
      {label}
    </div>
  )
}
