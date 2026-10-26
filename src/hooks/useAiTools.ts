import { useEffect, useRef, useSyncExternalStore } from 'react'
import {
  denyAllConfirmations,
  modelContext,
  readAiToolsEnabled,
  readConfirmations,
  registerWebMcpTools,
  subscribeAiTools,
  subscribeConfirmations,
  writeAiToolsEnabled,
} from '@/lib/ai-tools'
import type { WebMcpTool } from '@/lib/ai-tools'

/** Whether AI tools are on for this device, and a setter. */
export function useAiTools() {
  const enabled = useSyncExternalStore(subscribeAiTools, readAiToolsEnabled)
  return [enabled, writeAiToolsEnabled] as const
}

/** Assistant actions waiting for the host's click, oldest first. */
export function useAiConfirmations() {
  return useSyncExternalStore(subscribeConfirmations, readConfirmations)
}

/**
 * Register the tools `build` makes with the browser's WebMCP while `open` is true, the host
 * turned AI tools on for this device, and the browser supports WebMCP. Returns whether they
 * are registered.
 *
 * The tools are registered once; each call runs the tool from the latest render's `build`,
 * so handlers can close over fresh state without registering again. `build` must always make
 * the same tool names. Taking the tools off denies every confirmation still waiting.
 */
export function useWebMcpTools(build: () => readonly WebMcpTool[], open: boolean): boolean {
  const [enabled] = useAiTools()
  const mc = modelContext()
  const active = open && enabled && mc !== null
  const latest = useRef(build)
  useEffect(() => {
    latest.current = build
  })

  useEffect(() => {
    if (!active || !mc) return
    const stable = latest.current().map((tool): WebMcpTool => ({
      ...tool,
      execute: (args, options) => {
        const now = latest.current().find(t => t.name === tool.name)
        return now ? now.execute(args, options) : Promise.resolve('This tool is gone.')
      },
    }))
    const unregister = registerWebMcpTools(mc, stable)
    return () => {
      unregister()
      denyAllConfirmations()
    }
  }, [active, mc])

  return active
}
