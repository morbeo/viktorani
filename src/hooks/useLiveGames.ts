import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { Game } from '@/db'

/** A game that is active or paused, with how many players have joined it. */
export interface LiveGame {
  game: Game
  players: number
}

const NONE: LiveGame[] = []

/** Games that are active or paused, oldest first. Updates as the database changes. */
export function useLiveGames(): LiveGame[] {
  return (
    useLiveQuery(async () => {
      const games = await db.games.where('status').anyOf('active', 'paused').sortBy('createdAt')
      return Promise.all(
        games.map(async game => ({
          game,
          players: await db.players.where('gameId').equals(game.id).count(),
        }))
      )
    }, []) ?? NONE
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Short count for an accessible name, e.g. "1 game live" or "1 game live, 1 paused". */
export function liveGamesLabel(live: LiveGame[]): string {
  const active = live.filter(l => l.game.status === 'active').length
  const paused = live.length - active
  if (!paused) return `${plural(active, 'game')} live`
  if (!active) return `${plural(paused, 'game')} paused`
  return `${plural(active, 'game')} live, ${paused} paused`
}

/** One game's status, e.g. "Quiz night is live: 6 players, round 2". */
export function describeLiveGame({ game, players }: LiveGame): string {
  const state = game.status === 'paused' ? 'paused' : 'live'
  const round = game.currentRoundIdx >= 0 ? `, round ${game.currentRoundIdx + 1}` : ''
  return `${game.name} is ${state}: ${plural(players, 'player')}${round}`
}
