import { describe, it, expect, vi, afterEach } from 'vitest'
import { downscaleImage } from '@/lib/image'

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
