import Dexie from 'dexie'
import { db } from './index'
import type { GameLogEntry, GameLogKind } from './index'

/**
 * Record something that happened in a game. Never blocks or breaks the action being
 * logged: the write runs in the background, outside any open transaction, and a failure
 * is only reported to the console.
 */
export function logEvent(
  gameId: string,
  kind: GameLogKind,
  opts: Partial<Pick<GameLogEntry, 'actorId' | 'subjectId' | 'data'>> = {}
): void {
  const entry: GameLogEntry = {
    id: crypto.randomUUID(),
    gameId,
    at: Date.now(),
    kind,
    actorId: opts.actorId ?? null,
    subjectId: opts.subjectId ?? null,
    data: opts.data ?? {},
  }
  const report = (err: unknown) => console.error(`[gameLog] Recording ${kind} failed:`, err)
  try {
    Dexie.ignoreTransaction(() => db.gameLog.add(entry)).catch(report)
  } catch (err) {
    report(err)
  }
}
