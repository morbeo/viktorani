import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  title?:   string
}

const nav = [
  { to: '/admin',           label: 'Dashboard',  icon: '◈' },
  { to: '/admin/questions', label: 'Questions',  icon: '?' },
  { to: '/admin/games',     label: 'Games',      icon: '▶' },
  { to: '/admin/notes',     label: 'Notes',      icon: '✎' },
  { to: '/admin/settings',  label: 'Settings',   icon: '⚙' },
]

export default function AdminLayout({ children, title }: Props) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-cream)' }}>
      {/* Sidebar */}
      <aside className="w-56 flex flex-col border-r shrink-0" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        {/* Logo */}
        <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h1 className="text-xl font-black tracking-tight" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--color-ink)' }}>
            Viktorani
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>Bar Trivia</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {nav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded text-sm transition-all ${
                  isActive
                    ? 'font-semibold'
                    : 'hover:bg-black/5'
                }`
              }
              style={({ isActive }) => ({
                color:      isActive ? 'var(--color-gold)'   : 'var(--color-ink)',
                background: isActive ? 'var(--color-gold-light)' : undefined,
              })}
            >
              <span className="text-base w-5 text-center">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Player join link */}
        <div className="px-3 pb-4">
          <a
            href="#/join"
            className="flex items-center gap-3 px-3 py-2 rounded text-sm border"
            style={{ color: 'var(--color-muted)', borderColor: 'var(--color-border)' }}
          >
            <span className="text-base w-5 text-center">⊕</span>
            Player view
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {title && (
          <header className="px-8 py-5 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>{title}</h2>
          </header>
        )}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
