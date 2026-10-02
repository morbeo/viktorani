import { useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'

/** One entry in the command palette. */
export interface Command {
  id: string
  label: string
  /** Shown next to the label, e.g. "Go to" or "Game". */
  group: string
  icon?: LucideIcon
  /** Keyboard shortcut to show, e.g. "Space" or "→". */
  shortcut?: string
  /** Extra words to match on. */
  keywords?: string
  run: () => void
}

// Commands offered by the mounted pages, keyed by the registering component
const registry = new Map<string, Command[]>()
const listeners = new Set<() => void>()
let snapshot: Command[] = []

function changed() {
  snapshot = [...registry.values()].flat()
  listeners.forEach(l => l())
}

/** Adds page commands under `key`, replacing any earlier ones; returns the remover. */
export function registerCommands(key: string, commands: Command[]): () => void {
  registry.set(key, commands)
  changed()
  return () => {
    if (registry.get(key) !== commands) return
    registry.delete(key)
    changed()
  }
}

export function subscribeCommands(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** All page commands; the same array until a page registers or removes some. */
export function getPageCommands(): Command[] {
  return snapshot
}

/**
 * Offer `commands` in the palette while the calling component is mounted.
 * Pass a memoised array; a new array re-registers.
 */
export function useRegisterCommands(key: string, commands: Command[]) {
  useEffect(() => registerCommands(key, commands), [key, commands])
}

/** True for Ctrl+K, or ⌘+K on a Mac. */
export function isPaletteShortcut(e: KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k'
}
