/**
 * Live AI tools on the game master (ADR 0021, step 2): the per-device switch, WebMCP
 * detection, and confirmations the host gives in the app.
 *
 * The switch is kept in its own local storage entry, not in the app settings, so it never
 * travels in a backup: importing one can't turn AI tools on for another device.
 */

const KEY = 'viktorani:ai-tools'

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(l => l())
}

/** Whether the host turned on AI tools on this device. Off by default. */
export function readAiToolsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

/** Turn AI tools on or off for this device. */
export function writeAiToolsEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, 'on')
    else localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable: the switch stays off
  }
  emit()
}

/** Subscribe to the switch, here or in another tab. */
export function subscribeAiTools(listener: () => void): () => void {
  function onStorage(e: StorageEvent) {
    if (e.key === KEY || e.key === null) listener()
  }
  listeners.add(listener)
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

// ── WebMCP ────────────────────────────────────────────────────────────────────

/** One tool as WebMCP registers it. `execute` resolves to the text the agent reads. */
export interface WebMcpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean }
  execute(args: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<string>
}

/**
 * The part of the WebMCP API this app uses. Drafts have changed: the current one has
 * `registerTool(tool, { signal })` and no `unregisterTool`; earlier ones had
 * `unregisterTool(name)`. Both are handled.
 */
export interface ModelContext {
  registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): unknown
  unregisterTool?(name: string): unknown
}

/**
 * The browser's WebMCP entry point, or `null` where there is none. The July 2026 draft moved
 * it from `navigator.modelContext` to `document.modelContext`; either is accepted.
 */
export function modelContext(): ModelContext | null {
  const fromDocument = (globalThis.document as { modelContext?: ModelContext } | undefined)
    ?.modelContext
  const fromNavigator = (globalThis.navigator as { modelContext?: ModelContext } | undefined)
    ?.modelContext
  const mc = fromDocument ?? fromNavigator
  return mc && typeof mc.registerTool === 'function' ? mc : null
}

/**
 * Register `tools` with WebMCP. Returns a function that takes them all back off, whichever
 * way the browser's draft does that. Tools that fail to register are skipped.
 */
export function registerWebMcpTools(mc: ModelContext, tools: readonly WebMcpTool[]): () => void {
  const controller = new AbortController()
  const registered: string[] = []
  for (const tool of tools) {
    try {
      const result = mc.registerTool(tool, { signal: controller.signal })
      // Promise-returning drafts report failure asynchronously
      if (result instanceof Promise) result.catch(() => {})
      registered.push(tool.name)
    } catch {
      // A name clash or an unsupported schema: leave that tool out
    }
  }
  return () => {
    controller.abort()
    if (mc.unregisterTool) {
      for (const name of registered) {
        try {
          mc.unregisterTool(name)
        } catch {
          // Already gone
        }
      }
    }
  }
}

// ── Confirmations ─────────────────────────────────────────────────────────────

/** An action an assistant asked for that waits for the host's click. */
export interface PendingConfirmation {
  id: number
  /** What will happen, e.g. "End the game". */
  title: string
  /** More about it, e.g. who is kicked. */
  detail: string
}

let pending: PendingConfirmation[] = []
const resolvers = new Map<number, (ok: boolean) => void>()
const confirmListeners = new Set<() => void>()
let nextId = 1

function emitConfirm() {
  confirmListeners.forEach(l => l())
}

/**
 * Ask the host to allow an action, resolving `true` only when they click Allow in the game
 * master. Nothing an assistant sends can answer it: only {@link answerConfirmation}, called
 * from the dialog's buttons, does.
 */
export function requestConfirmation(title: string, detail = ''): Promise<boolean> {
  const id = nextId++
  pending = [...pending, { id, title, detail }]
  emitConfirm()
  return new Promise(resolve => resolvers.set(id, resolve))
}

/** Answer the confirmation `id`; an unknown id does nothing. */
export function answerConfirmation(id: number, ok: boolean): void {
  const resolve = resolvers.get(id)
  if (!resolve) return
  resolvers.delete(id)
  pending = pending.filter(p => p.id !== id)
  emitConfirm()
  resolve(ok)
}

/** Deny everything still waiting, e.g. when the tools are taken off. */
export function denyAllConfirmations(): void {
  for (const { id } of pending) answerConfirmation(id, false)
}

/** Confirmations waiting for the host, oldest first. Same array until it changes. */
export function readConfirmations(): readonly PendingConfirmation[] {
  return pending
}

export function subscribeConfirmations(listener: () => void): () => void {
  confirmListeners.add(listener)
  return () => {
    confirmListeners.delete(listener)
  }
}
