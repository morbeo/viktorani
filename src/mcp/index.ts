import { BACKUP_TOOLS } from './tools/backup'
import { BANK_TOOLS } from './tools/bank'
import { GAME_TOOLS } from './tools/games'
import { LAYOUT_TOOLS } from './tools/layouts'
import { QUESTION_TOOLS } from './tools/questions'
import { ROUND_TOOLS } from './tools/rounds'
import { THEME_TOOLS } from './tools/themes'
import type { McpTool } from './tool'

export { callTool, newSession, ToolError } from './tool'
export type { FileAccess, McpContext, McpSession, McpTool, ToolKind } from './tool'
export { loadBackup } from './tools/backup'

/** Every authoring tool (ADR 0021, step 1), in the order a client lists them. */
export const AUTHORING_TOOLS: readonly McpTool[] = [
  ...BACKUP_TOOLS,
  ...BANK_TOOLS,
  ...QUESTION_TOOLS,
  ...ROUND_TOOLS,
  ...GAME_TOOLS,
  ...LAYOUT_TOOLS,
  ...THEME_TOOLS,
] as unknown as readonly McpTool[]
