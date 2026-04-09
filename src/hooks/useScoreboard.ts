import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from '@/db'
import { transportManager } from '@/transport'
import type { Game, Player, Team, DifficultyLevel } from '@/db'

export interface ScoreEntry {
  id: string
  name: string
  score: number
  /** null for individual player when no team */
  teamId: string | null
  /** Present for team rows; undefined for solo players */
  members?: { id: string; name: string; score: number }[]
  kind: 'player' | 'team'
}

export interface UseScoreboardResult {
  entries: ScoreEntry[]
  adjust: (id: string, kind: 'player' | 'team', delta: number) => Promise<void>
  defaultIncrement: number
}

/**
 * Manages scoreboard state for the GM view.
 *
 * - Loads players (and teams in team mode) from DB on mount.
 * - Provides `adjust` to apply manual +/- delta to a player or team.
 * - Emits SCORE_UPDATE after every adjustment so players see live scores.
 * - In team mode, aggregates player scores into team totals.
 */
export function useScoreboard(game: Game): UseScoreboardResult {
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [difficulties, setDifficulties] = useState<DifficultyLevel[]>([])
  const gameRef = useRef(game)
  useEffect(() => {
    gameRef.current = game
  })

  // Load on mount
  useEffect(() => {
    if (!game.id) return
    Promise.all([
      db.players.where('gameId').equals(game.id).toArray(),
      db.teams.where('gameId').equals(game.id).toArray(),
      db.difficulties.orderBy('order').toArray(),
    ]).then(([ps, ts, ds]) => {
      setPlayers(ps)
      setTeams(ts)
      setDifficulties(ds)
    })
  }, [game.id])

  // Default increment: lowest difficulty score, or 1
  const defaultIncrement = difficulties.length > 0 ? Math.min(...difficulties.map(d => d.score)) : 1

  const adjust = useCallback(async (id: string, kind: 'player' | 'team', delta: number) => {
    const g = gameRef.current

    if (kind === 'player') {
      const player = await db.players.get(id)
      if (!player) return
      const newScore = Math.max(0, player.score + delta)
      await db.players.update(id, { score: newScore })
      setPlayers(prev => prev.map(p => (p.id === id ? { ...p, score: newScore } : p)))

      // If player belongs to a team, update team score too
      if (player.teamId) {
        const updatedPlayers = await db.players.where('gameId').equals(g.id).toArray()
        const teamScore = updatedPlayers
          .filter(p => p.teamId === player.teamId)
          .reduce((sum, p) => sum + p.score, 0)
        await db.teams.update(player.teamId, { score: teamScore })
        setTeams(prev => prev.map(t => (t.id === player.teamId ? { ...t, score: teamScore } : t)))
      }
    } else {
      // Team adjustment: distribute delta to team record, don't touch individual players
      const team = await db.teams.get(id)
      if (!team) return
      const newScore = Math.max(0, team.score + delta)
      await db.teams.update(id, { score: newScore })
      setTeams(prev => prev.map(t => (t.id === id ? { ...t, score: newScore } : t)))
    }

    // Broadcast updated scores
    const [allPlayers, allTeams] = await Promise.all([
      db.players.where('gameId').equals(g.id).toArray(),
      db.teams.where('gameId').equals(g.id).toArray(),
    ])
    const scores: Record<string, number> = {}
    for (const p of allPlayers) scores[p.id] = p.score
    for (const t of allTeams) scores[t.id] = t.score
    transportManager.send({ type: 'SCORE_UPDATE', scores })
  }, [])

  // Build display entries
  const isTeamMode = teams.length > 0

  let entries: ScoreEntry[]

  if (isTeamMode) {
    // Team rows with player breakdown
    const teamEntries: ScoreEntry[] = teams.map(team => {
      const members = players
        .filter(p => p.teamId === team.id)
        .map(p => ({ id: p.id, name: p.name, score: p.score }))
      return {
        id: team.id,
        name: team.name,
        score: team.score,
        teamId: team.id,
        members,
        kind: 'team',
      }
    })

    // Solo players (no team)
    const soloEntries: ScoreEntry[] = players
      .filter(p => !p.teamId)
      .map(p => ({ id: p.id, name: p.name, score: p.score, teamId: null, kind: 'player' }))

    entries = [...teamEntries, ...soloEntries]
  } else {
    entries = players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      teamId: null,
      kind: 'player',
    }))
  }

  // Sort by score descending
  entries = [...entries].sort((a, b) => b.score - a.score)

  return { entries, adjust, defaultIncrement }
}
