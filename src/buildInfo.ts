/** Build metadata injected by Vite `define` (see vite.config.ts). */
export interface BuildInfo {
  version: string
  /** Full SHA in CI (GITHUB_SHA), short SHA locally, or 'unknown'. */
  commit: string
  /** ISO timestamp of the build; deploy.yml builds on deploy, so this is the last deploy. */
  builtAt: string
  runId: string | null
  runNumber: string | null
  ref: string | null
}

// Declared here rather than in a global .d.ts so every tsconfig that imports this
// module (app and test) sees the type.
declare const __BUILD_INFO__: BuildInfo

export const buildInfo: BuildInfo = __BUILD_INFO__
