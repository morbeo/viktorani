import type { QuestionContent } from './player-session'

type MediaType = NonNullable<QuestionContent['mediaType']>

/**
 * Whether host-sent media may be used as a source: a data URL of the announced kind
 * or a remote https URL. Anything else (javascript:, http:, other data types) is dropped.
 */
export function isSafeMedia(src: string, type: MediaType): boolean {
  return src.startsWith(`data:${type}/`) || src.startsWith('https://')
}
