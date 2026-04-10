import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Settings } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'

describe('Icon', () => {
  it('renders aria-hidden by default', () => {
    const { container } = render(<Icon icon={Settings} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders at 16px for size sm (default)', () => {
    const { container } = render(<Icon icon={Settings} size="sm" />)
    const svg = container.querySelector('svg')
    expect(svg!.getAttribute('width')).toBe('16')
    expect(svg!.getAttribute('height')).toBe('16')
  })

  it('renders at 20px for size md', () => {
    const { container } = render(<Icon icon={Settings} size="md" />)
    const svg = container.querySelector('svg')
    expect(svg!.getAttribute('width')).toBe('20')
    expect(svg!.getAttribute('height')).toBe('20')
  })

  it('passes aria-label when aria-hidden is false', () => {
    render(<Icon icon={Settings} aria-hidden={false} aria-label="settings icon" />)
    expect(screen.getByLabelText('settings icon')).toBeTruthy()
  })

  it('forwards className', () => {
    const { container } = render(<Icon icon={Settings} className="text-red-500" />)
    const svg = container.querySelector('svg')
    expect(svg!.classList.contains('text-red-500')).toBe(true)
  })
})
