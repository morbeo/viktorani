import { MAX_LOGO_LENGTH } from '@/db/snapshot-schema'

/** Longest edge, in pixels, of an uploaded logo after downscaling. */
export const MAX_LOGO_EDGE = 512

/** Image types a logo upload accepts. SVG is kept as is; the rest are redrawn. */
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']

/** Largest file kept as is: its base64 data URL just fits `MAX_LOGO_LENGTH`. */
const MAX_KEPT_BYTES = Math.floor((MAX_LOGO_LENGTH * 3) / 4)
/** Largest raster file decoded for downscaling, so a huge file can't stall the tab. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const TOO_LARGE = 'That image is too large'

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Read an uploaded logo as a `data:image/` URL, shrunk so its longest edge is at most
 * `maxEdge` pixels.
 *
 * @remarks
 * Raster images are drawn onto a canvas and re-encoded as PNG, which keeps transparency.
 * An image already small enough, or an SVG (which scales by itself and renders through
 * `<img>`, where scripts don't run), is read as is.
 *
 * Sizes are checked before anything is read, so a huge file fails at once.
 *
 * @throws If the file isn't one of {@link LOGO_TYPES}, is too large, or can't be decoded.
 */
export async function downscaleImage(file: File, maxEdge = MAX_LOGO_EDGE): Promise<string> {
  if (!LOGO_TYPES.includes(file.type)) throw new Error('Choose a PNG, JPEG, WebP, GIF or SVG image')
  if (file.type === 'image/svg+xml') {
    if (file.size > MAX_KEPT_BYTES) throw new Error(TOO_LARGE)
    return readAsDataUrl(file)
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(TOO_LARGE)

  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    if (scale === 1) {
      if (file.size > MAX_KEPT_BYTES) throw new Error(TOO_LARGE)
      return readAsDataUrl(file)
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not resize the image')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    bitmap.close()
  }
}
