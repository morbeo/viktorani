import { describe, it, expect, vi, afterEach } from 'vitest'
import { MAX_LOGO_LENGTH } from '@/db/snapshot-schema'
import { MAX_UPLOAD_BYTES, downscaleImage } from '@/lib/image'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('downscaleImage', () => {
  it('refuses files that are not images', async () => {
    await expect(downscaleImage(new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow(
      /PNG, JPEG/
    )
  })

  it('refuses a file too large to keep or decode before reading it', async () => {
    const bitmap = vi.fn()
    vi.stubGlobal('createImageBitmap', bitmap)
    const sized = (type: string, size: number) => {
      const file = new File(['x'], 'big', { type })
      Object.defineProperty(file, 'size', { value: size })
      return file
    }
    await expect(downscaleImage(sized('image/svg+xml', MAX_LOGO_LENGTH))).rejects.toThrow(
      /too large/
    )
    await expect(downscaleImage(sized('image/png', MAX_UPLOAD_BYTES + 1))).rejects.toThrow(
      /too large/
    )
    expect(bitmap).not.toHaveBeenCalled()
  })

  it('keeps an SVG as is', async () => {
    const url = await downscaleImage(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }))
    expect(url).toMatch(/^data:image\/svg\+xml/)
  })

  it('keeps an image that is already small enough', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 200, height: 100, close: vi.fn() }))
    )
    const url = await downscaleImage(new File(['x'], 'a.png', { type: 'image/png' }))
    expect(url).toMatch(/^data:image\/png/)
  })

  it('redraws a large image at most 512 px on its longest edge', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 2000, height: 1000, close: vi.fn() }))
    )
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,X')

    await expect(downscaleImage(new File(['x'], 'a.png', { type: 'image/png' }))).resolves.toBe(
      'data:image/png;base64,X'
    )
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 512, 256)
  })
})
