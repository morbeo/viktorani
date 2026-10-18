import { useState } from 'react'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { Button, Icon, Modal } from '@/components/ui'
import type { Theme } from '@/db'
import { deleteTheme, duplicateTheme, saveTheme } from '@/db/themes'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useIsDark, useUserThemes } from '@/hooks/useAppTheme'
import { BUILT_IN_THEMES, findTheme, resolveTheme } from '@/lib/theme'
import { ThemeEditor } from './ThemeEditor'
import { ThemeSwatches } from './ThemeSwatches'

/**
 * Pick the app's theme, and duplicate, edit or delete the host's own themes. Built-in
 * themes are read-only; duplicating one is how a host starts their own.
 */
export default function ThemeSettings() {
  const [settings, update] = useAppSettings()
  const userThemes = useUserThemes()
  const dark = useIsDark(settings.theme)
  const [editing, setEditing] = useState<Theme | null>(null)
  const [deleting, setDeleting] = useState<Theme | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = findTheme(settings.themeId, userThemes)
  const isNew = editing !== null && !userThemes.some(t => t.id === editing.id)

  async function save() {
    if (!editing) return
    try {
      await saveTheme({ ...editing, name: editing.name.trim() })
      update({ themeId: editing.id })
      setEditing(null)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove(theme: Theme) {
    await deleteTheme(theme.id)
    setDeleting(null)
  }

  const row = (theme: Theme, builtIn: boolean) => {
    const resolved = resolveTheme({ app: theme, surface: 'admin' })
    const selected = theme.id === current.id
    return (
      <li key={theme.id} className="flex items-center gap-3 px-3 py-2 border-border">
        <button
          onClick={() => update({ themeId: theme.id })}
          aria-pressed={selected}
          aria-label={`Use ${theme.name}`}
          className="flex flex-1 min-w-0 items-center gap-3 text-left"
        >
          <span
            className={`h-3 w-3 shrink-0 rounded-full border ${selected ? 'bg-accent border-accent' : 'border-border'}`}
            aria-hidden="true"
          />
          <ThemeSwatches palette={dark ? resolved.dark : resolved.light} />
          <span className="truncate text-sm font-medium">{theme.name}</span>
          {builtIn && <span className="text-xs text-muted">Built-in</span>}
        </button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Duplicate ${theme.name}`}
          onClick={() => setEditing(duplicateTheme(theme))}
        >
          <Icon icon={Copy} size="sm" />
        </Button>
        {!builtIn && (
          <>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Edit ${theme.name}`}
              onClick={() => setEditing(structuredClone(theme))}
            >
              <Icon icon={Pencil} size="sm" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Delete ${theme.name}`}
              onClick={() => (settings.confirmDestructive ? setDeleting(theme) : remove(theme))}
            >
              <Icon icon={Trash2} size="sm" />
            </Button>
          </>
        )}
      </li>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-base text-text">Theme</h2>
        <p className="text-xs mt-0.5 text-muted">
          Colours, fonts, icons and logos for the whole app. Duplicate a theme to make your own.
        </p>
      </div>

      <ul className="flex flex-col rounded-lg border divide-y border-border" aria-label="Themes">
        {BUILT_IN_THEMES.map(t => row(t, true))}
        {userThemes.map(t => row(t, false))}
      </ul>

      <Modal
        open={editing !== null}
        title={isNew ? 'New theme' : 'Edit theme'}
        onClose={() => setEditing(null)}
        maxWidth="720px"
      >
        {editing && (
          <>
            <ThemeEditor
              theme={editing}
              onChange={setEditing}
              onSave={() => void save()}
              onCancel={() => setEditing(null)}
            />
            {error && (
              <p role="alert" className="mt-3 text-xs text-negative">
                {error}
              </p>
            )}
          </>
        )}
      </Modal>

      <Modal open={deleting !== null} title="Delete theme?" onClose={() => setDeleting(null)}>
        {deleting && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              Delete <strong>{deleting.name}</strong>? The app and any game using it go back to
              their default theme.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => void remove(deleting)}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}
