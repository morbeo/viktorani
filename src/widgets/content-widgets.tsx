import { isSafeImageSrc } from '@/db/snapshot-schema'
import type { ImageConfig, TextConfig } from './content-config'
import type { WidgetProps } from './types'

/**
 * Widgets that show what the host typed into their settings rather than game data, so the
 * same component serves every surface (settings in `content-config.ts`).
 */

const TEXT_SIZE: Record<TextConfig['size'], string> = {
  small: 'text-base',
  medium: 'text-2xl',
  large: 'text-5xl font-semibold',
}

const TEXT_ALIGN: Record<TextConfig['align'], string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

/** The host's own text, as plain text. Renders nothing while it is empty. */
export function TextWidget({ config }: WidgetProps<unknown, TextConfig>) {
  if (!config.text.trim()) return null
  return (
    <p
      className={`whitespace-pre-wrap break-words text-(--color-text) ${TEXT_SIZE[config.size]} ${TEXT_ALIGN[config.align]}`}
    >
      {config.text}
    </p>
  )
}

/** An image the host chose, scaled to fit its cell. Renders nothing until it has an address. */
export function ImageWidget({ config }: WidgetProps<unknown, ImageConfig>) {
  // The schema already refuses other sources; checked again so nothing else reaches `src`
  if (!config.src || !isSafeImageSrc(config.src)) return null
  return (
    <img
      src={config.src}
      alt={config.alt}
      referrerPolicy="no-referrer"
      className="mx-auto max-h-[60vh] max-w-full object-contain"
    />
  )
}
