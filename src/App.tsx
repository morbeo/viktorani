import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { db, seedDefaults } from '@/db'
import { ToastProvider } from '@/components/ui'

// Pages — Admin (lazy-loaded per route)
const Dashboard = lazy(() => import('@/pages/admin/Dashboard'))
const Questions = lazy(() => import('@/pages/admin/Questions'))
const Games = lazy(() => import('@/pages/admin/Games'))
const GameMaster = lazy(() => import('@/pages/admin/GameMaster'))
const Screen = lazy(() => import('@/pages/admin/Screen'))
const Layouts = lazy(() => import('@/pages/admin/Layouts'))
const Notes = lazy(() => import('@/pages/admin/Notes'))
const NoteDetail = lazy(() => import('@/pages/admin/NoteDetail'))
const Settings = lazy(() => import('@/pages/admin/Settings'))
const Debug = lazy(() => import('@/pages/admin/Debug'))
const PlayersTeams = lazy(() => import('@/pages/admin/PlayersTeams'))

// Pages — Player (lazy-loaded per route)
const Join = lazy(() => import('@/pages/player/Join'))
const Play = lazy(() => import('@/pages/player/Play'))
const RemoteScreen = lazy(() => import('@/pages/screen/RemoteScreen'))

const Loading = () => (
  <div className="flex h-screen items-center justify-center">
    <span className="text-muted">Loading...</span>
  </div>
)

export default function App() {
  const [dbError, setDbError] = useState<string | null>(null)

  useEffect(() => {
    // Another tab holds an older connection open and is holding up a schema upgrade
    const onBlocked = () =>
      setDbError('Viktorani is updating. Close its other open tabs to continue.')
    db.on('blocked', onBlocked)
    db.open().then(
      () => setDbError(null),
      (err: Error) => setDbError(`Could not open the local database: ${err.message}`)
    )
    return () => db.on('blocked').unsubscribe(onBlocked)
  }, [])

  useEffect(() => {
    const ready = seedDefaults()
    // `npm run demo` opens the app with ?demo — dev builds only
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
      history.replaceState(null, '', location.pathname + location.hash)
      ready.then(() => import('@/db/demo')).then(m => m.seedDemo())
    }
  }, [])

  if (dbError) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center">
        <p role="alert">{dbError}</p>
      </div>
    )
  }

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
            <Route path="/admin/game/:id/screen" element={<Screen />} />
            <Route path="/admin/layouts/:gameId" element={<Layouts />} />
            <Route path="/admin/players-teams" element={<PlayersTeams />} />
            <Route path="/admin/notes" element={<Notes />} />
            <Route path="/admin/notes/:id" element={<NoteDetail />} />
            <Route path="/admin/settings" element={<Settings />} />
            <Route path="/admin/debug" element={<Debug />} />
            <Route path="/join" element={<Join />} />
            <Route path="/join/:roomId" element={<Join />} />
            <Route path="/play/:roomId" element={<Play />} />
            <Route path="/screen/:roomId" element={<RemoteScreen />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </ToastProvider>
  )
}
