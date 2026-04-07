import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'

interface Props {
  children: ReactNode
  title?: string
}

const nav = [
  { to: '/admin', label: 'Dashboard', icon: '◈' },
  { to: '/admin/questions', label: 'Questions', icon: '?' },
  { to: '/admin/games', label: 'Games', icon: '▶' },
  { to: '/admin/notes', label: 'Notes', icon: '✎' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙' },
]

export default function AdminLayout({ children, title }: Props) {
  const [collapsed, setCollapsed] = useLocalStorage('sidebar-collapsed', false)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-cream)' }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col border-r shrink-0 transition-all duration-200"
        style={{
          width: collapsed ? 52 : 224,
          borderColor: 'var(--color-border)',
          background: 'var(--color-surface)',
        }}
      >
        {/* Logo + collapse toggle */}
        <div
          className="border-b flex items-center justify-between shrink-0 overflow-hidden"
          style={{
            borderColor: 'var(--color-border)',
            minHeight: 64,
            padding: collapsed ? '0 10px' : '0 20px',
          }}
        >
          {!collapsed && (
            <div>
              <h1
                className="text-xl font-black tracking-tight"
                style={{ fontFamily: 'Playfair Display, serif', color: 'var(--color-ink)' }}
              >
                Viktorani
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                Bar Trivia
              </p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center justify-center rounded transition-all hover:bg-black/5"
            style={{
              color: 'var(--color-muted)',
              width: 28,
              height: 28,
              flexShrink: 0,
              marginLeft: collapsed ? 0 : 8,
              fontSize: 14,
            }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Nav */}
        <nav
          className="flex-1 flex flex-col gap-0.5"
          style={{ padding: collapsed ? '12px 6px' : '12px 8px' }}
        >
          {nav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded text-sm transition-all ${
                  collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'
                } ${isActive ? 'font-semibold' : 'hover:bg-black/5'}`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--color-gold)' : 'var(--color-ink)',
                background: isActive ? 'var(--color-gold-light)' : undefined,
              })}
            >
              <span className="text-base w-5 text-center shrink-0">{icon}</span>
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        {/* Player join link */}
        <div style={{ padding: collapsed ? '0 6px 12px' : '0 8px 12px' }}>
          <a
            href="#/join"
            title={collapsed ? 'Player view' : undefined}
            className={`flex items-center rounded text-sm border transition-all ${
              collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'
            }`}
            style={{ color: 'var(--color-muted)', borderColor: 'var(--color-border)' }}
          >
            <span className="text-base w-5 text-center shrink-0">⊕</span>
            {!collapsed && 'Player view'}
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {title && (
          <header
            className="px-8 py-5 border-b shrink-0"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
              {title}
            </h2>
          </header>
        )}
        <div className="flex-1 overflow-y-auto px-8 py-6">{children}</div>
      </main>
    </div>
  )
}
