import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  ImageConfigSchema,
  MAX_IMAGE_SRC_LENGTH,
  MAX_TEXT_WIDGET_LENGTH,
  TextConfigSchema,
} from '@/widgets/content-config'
import { ImageWidget, TextWidget } from '@/widgets/content-widgets'
import { isRenderable, type LayoutBundle } from '@/widgets/layouts'
import { WIDGET_REGISTRY } from '@/widgets/registry'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'

const text = (patch: object = {}) => TextConfigSchema.parse(patch)
const image = (patch: object = {}) => ImageConfigSchema.parse(patch)

describe('TextWidget', () => {
  it("shows the host's text as plain text, sized and aligned", () => {
    render(
      <TextWidget
        data={null}
        config={text({ text: '<b>Last orders</b>', size: 'large', align: 'left' })}
      />
    )
    const p = screen.getByText('<b>Last orders</b>')
    expect(p.querySelector('b')).toBeNull()
    expect(p).toHaveClass('text-5xl', 'text-left')
  })

  it('renders nothing while the text is empty', () => {
    const { container } = render(<TextWidget data={null} config={text({ text: '  ' })} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ImageWidget', () => {
  it('shows the image with its description and no referrer', () => {
    render(
      <ImageWidget
        data={null}
        config={image({ src: 'https://example.com/logo.png', alt: 'Bar logo' })}
      />
    )
    const img = screen.getByRole('img', { name: 'Bar logo' })
    expect(img).toHaveAttribute('src', 'https://example.com/logo.png')
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer')
  })

  it('renders nothing without an address, or with one that slipped past the schema', () => {
    const { container, rerender } = render(<ImageWidget data={null} config={image()} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<ImageWidget data={null} config={{ src: 'javascript:alert(1)', alt: '' }} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('content widget settings', () => {
  it.each(['https://example.com/a.png', 'data:image/png;base64,AAAA', ''])('accepts %j', src => {
    expect(ImageConfigSchema.safeParse({ src }).success).toBe(true)
  })

  it.each([
    'javascript:alert(1)',
    'http://example.com/a.png',
    'data:text/html,<script>alert(1)</script>',
    '//example.com/a.png',
  ])('refuses the image address %j', src => {
    expect(ImageConfigSchema.safeParse({ src }).success).toBe(false)
  })

  it('caps the image address and the text', () => {
    const src = 'https://' + 'a'.repeat(MAX_IMAGE_SRC_LENGTH)
    expect(ImageConfigSchema.safeParse({ src }).success).toBe(false)
    const long = 'a'.repeat(MAX_TEXT_WIDGET_LENGTH + 1)
    expect(TextConfigSchema.safeParse({ text: long }).success).toBe(false)
  })

  it('refuses unknown settings and choices', () => {
    expect(TextConfigSchema.safeParse({ html: '<b>hi</b>' }).success).toBe(false)
    expect(TextConfigSchema.safeParse({ size: 'huge' }).success).toBe(false)
  })

  it('is offered on every surface', () => {
    const all = ['gamemaster', 'player', 'screen', 'scoreboard']
    expect(WIDGET_REGISTRY.text.allowedTargets).toEqual(all)
    expect(WIDGET_REGISTRY.image.allowedTargets).toEqual(all)
  })
})

describe('a layout received with content widgets', () => {
  function bundle(config: Record<string, unknown>): LayoutBundle {
    return {
      layout: {
        id: 'l1',
        gameId: null,
        name: 'Phones',
        target: 'player',
        phase: null,
        theme: { ...DEFAULT_LAYOUT_THEME },
        isActive: true,
        order: 0,
      },
      widgets: [
        {
          id: 'w1',
          layoutId: 'l1',
          type: 'image',
          config,
          grid: { x: 0, y: 0, w: 12, h: 1 },
          breakpoints: {},
          order: 0,
        },
      ],
    }
  }

  it('is used when the image is safe', () => {
    expect(isRenderable(bundle({ src: 'https://example.com/a.png' }), 'player')).toBe(true)
  })

  it('is dropped for the default when an image address is not', () => {
    expect(isRenderable(bundle({ src: 'javascript:alert(1)' }), 'player')).toBe(false)
  })
})
