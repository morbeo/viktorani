import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { seedDefaults } from '@/db'
import { ToastProvider } from '@/components/ui'

// Pages — Admin (lazy-loaded per route)
const Dashboard = lazy(() => import('@/pages/admin/Dashboard'))
const Questions = lazy(() => import('@/pages/admin/Questions'))
const Games = lazy(() => import('@/pages/admin/Games'))
const GameMaster = lazy(() => import('@/pages/admin/GameMaster'))
const Layouts = lazy(() => import('@/pages/admin/Layouts'))
const Notes = lazy(() => import('@/pages/admin/Notes'))
const NoteDetail = lazy(() => import('@/pages/admin/NoteDetail'))
const Settings = lazy(() => import('@/pages/admin/Settings'))
const PlayersTeams = lazy(() => import('@/pages/admin/PlayersTeams'))

// Pages — Player (lazy-loaded per route)
const Join = lazy(() => import('@/pages/player/Join'))
const Play = lazy(() => import('@/pages/player/Play'))

const Loading = () => (
  <div className="flex h-screen items-center justify-center">
    <span className="text-muted">Loading...</span>
  </div>
)

export default function App() {
  useEffect(() => {
    const ready = seedDefaults()
    // `npm run demo` opens the app with ?demo — dev builds only
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
      history.replaceState(null, '', location.pathname + location.hash)
      ready.then(() => import('@/db/demo')).then(m => m.seedDemo())
    }
  }, [])

  return (
    <ToastProvider>
      <HashRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/questions" element={<Questions />} />
            <Route path="/admin/games" element={<Games />} />
            <Route path="/admin/game/:id" element={<GameMaster />} />
            <Route path="/admin/layouts/:gameId" element={<Layouts />} />
            <Route path="/admin/players-teams" element={<PlayersTeams />} />
            <Route path="/admin/notes" element={<Notes />} />
            <Route path="/admin/notes/:id" element={<NoteDetail />} />
            <Route path="/admin/settings" element={<Settings />} />
            <Route path="/join" element={<Join />} />
            <Route path="/join/:roomId" element={<Join />} />
            <Route path="/play/:roomId" element={<Play />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </ToastProvider>
  )
}
