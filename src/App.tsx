import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { seedDefaults } from '@/db'

// Pages — Admin
import Dashboard from '@/pages/admin/Dashboard'
import Questions from '@/pages/admin/Questions'
import Games from '@/pages/admin/Games'
import GameMaster from '@/pages/admin/GameMaster'
import Layouts from '@/pages/admin/Layouts'
import Notes from '@/pages/admin/Notes'
import Settings from '@/pages/admin/Settings'

// Pages — Player
import Join from '@/pages/player/Join'
import Play from '@/pages/player/Play'

export default function App() {
  useEffect(() => {
    seedDefaults()
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/questions" element={<Questions />} />
        <Route path="/admin/games" element={<Games />} />
        <Route path="/admin/game/:id" element={<GameMaster />} />
        <Route path="/admin/layouts/:gameId" element={<Layouts />} />
        <Route path="/admin/notes" element={<Notes />} />
        <Route path="/admin/settings" element={<Settings />} />
        <Route path="/join" element={<Join />} />
        <Route path="/join/:roomId" element={<Join />} />
        <Route path="/play/:roomId" element={<Play />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </HashRouter>
  )
}
