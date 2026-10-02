import { Navigate, NavLink, useParams } from 'react-router-dom'
import AdminLayout from '@/components/AdminLayout'
import ManageTags from '@/components/settings/ManageTags'
import ManageDifficulties from '@/components/settings/ManageDifficulties'
import ManageLabels from '@/components/players-teams/ManageLabels'
import AppearanceSettings from '@/components/settings/AppearanceSettings'
import GeneralSettings from '@/components/settings/GeneralSettings'
import DataSettings from '@/components/settings/DataSettings'
import SoundSettings from '@/components/settings/SoundSettings'
import TimerSettings from '@/components/settings/TimerSettings'
import GameDefaultsSettings from '@/components/settings/GameDefaultsSettings'
import { SETTINGS_CATEGORIES } from '@/components/settings/categories'
import type { SettingsCategoryId } from '@/components/settings/categories'

function LibrarySettings() {
  return (
    <div className="flex flex-col gap-10">
      <ManageTags />
      <ManageDifficulties />
      <ManageLabels />
    </div>
  )
}

const ELEMENTS: Record<SettingsCategoryId, React.ReactElement> = {
  appearance: <AppearanceSettings />,
  general: <GeneralSettings />,
  sound: <SoundSettings />,
  timers: <TimerSettings />,
  'game-defaults': <GameDefaultsSettings />,
  library: <LibrarySettings />,
  data: <DataSettings />,
}

const CATEGORIES = SETTINGS_CATEGORIES.map(c => ({ ...c, element: ELEMENTS[c.id] }))

/** Settings, one category per route: `/admin/settings/<category>`. */
export default function Settings() {
  const { category } = useParams()
  const current = CATEGORIES.find(c => c.id === category)
  if (!current) return <Navigate to={`/admin/settings/${CATEGORIES[0].id}`} replace />

  return (
    <AdminLayout title="Settings">
      <div className="max-w-2xl mx-auto flex flex-col gap-6 py-6 px-4">
        <nav
          aria-label="Settings categories"
          className="flex gap-1 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {CATEGORIES.map(c => (
            <NavLink
              key={c.id}
              to={`/admin/settings/${c.id}`}
              className="px-3 py-2 text-sm -mb-px border-b-2 transition-colors"
              style={({ isActive }) => ({
                borderColor: isActive ? 'var(--color-ink)' : 'transparent',
                color: isActive ? 'var(--color-ink)' : 'var(--color-muted)',
                fontWeight: isActive ? 600 : 400,
              })}
            >
              {c.label}
            </NavLink>
          ))}
        </nav>
        {current.element}
      </div>
    </AdminLayout>
  )
}
