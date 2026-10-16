import { z } from 'zod'
import { isSafeImageSrc } from '@/db/snapshot-schema'

/**
 * Settings of the text and image widgets. They travel to players and screens in `LAYOUT`
 * and are checked against these schemas on receipt, before anything renders.
 */

/** Longest text in a text widget. */
export const MAX_TEXT_WIDGET_LENGTH = 1000
/**
 * Longest image address. Leaves room in a `LAYOUT` (`MAX_LAYOUT_EVENT_LENGTH`) for an inlined
 * image in several phase layouts; bigger images belong at an https:// address.
 */
export const MAX_IMAGE_SRC_LENGTH = 400_000
/** Longest image description. */
export const MAX_IMAGE_ALT_LENGTH = 200

export const TextConfigSchema = z.strictObject({
  text: z
    .string()
    .max(MAX_TEXT_WIDGET_LENGTH)
    .meta({ description: 'Text', multiline: true })
    .default(''),
  size: z.enum(['small', 'medium', 'large']).meta({ description: 'Size' }).default('medium'),
  align: z.enum(['left', 'center', 'right']).meta({ description: 'Alignment' }).default('center'),
})
export type TextConfig = z.infer<typeof TextConfigSchema>

export const ImageConfigSchema = z.strictObject({
  src: z
    .string()
    .max(MAX_IMAGE_SRC_LENGTH)
    .refine(src => src === '' || isSafeImageSrc(src), {
      error: 'image must be a data:image/ or https:// URL',
    })
    .meta({ description: 'Image address (https:// or data:image/)' })
    .default(''),
  alt: z
    .string()
    .max(MAX_IMAGE_ALT_LENGTH)
    .meta({ description: 'Description for screen readers' })
    .default(''),
})
export type ImageConfig = z.infer<typeof ImageConfigSchema>
