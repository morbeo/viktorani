import { useEffect } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { Card } from '@/components/ui'
import { useLocalStorage } from '@/hooks/useLocalStorage'

type Theme = 'system' | 'light' | 'dark'

const THEMES: { value: Theme; label: string; icon: string; desc: string }[] = [
  { value: 'system', label: 'System', icon: '◑', desc: 'Follows your OS preference' },
  { value: 'light', label: 'Light', icon: '○', desc: 'Always light' },
  { value: 'dark', label: 'Dark', icon: '●', desc: 'Always dark' },
]

export default function Settings() {
  const [theme, setTheme] = useLocalStorage<Theme>('app-theme', 'system')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <AdminLayout title="Settings">
      <div className="max-w-lg flex flex-col gap-6">
        {/* Theme */}
        <Card>
          <h3
            className="text-base font-bold mb-1"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Appearance
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--color-muted)' }}>
            Choose how Viktorani looks. System follows your device setting.
          </p>

          <div className="flex gap-3">
            {THEMES.map(t => {
              const active = theme === t.value
              return (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className="flex-1 flex flex-col items-center gap-2 py-4 px-3 rounded-lg border transition-all"
                  style={{
                    borderColor: active ? 'var(--color-gold)' : 'var(--color-border)',
                    background: active ? 'var(--color-gold-light)' : 'transparent',
                    color: active ? 'var(--color-ink)' : 'var(--color-muted)',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{t.icon}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
                    {t.label}
                  </span>
                  <span className="text-xs text-center" style={{ color: 'var(--color-muted)' }}>
                    {t.desc}
                  </span>
                </button>
              )
            })}
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}
