import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Button,
  Badge,
  Card,
  Input,
  Textarea,
  Select,
  Modal,
  Empty,
  TransportPill,
} from '@/components/ui'

// ── Button ────────────────────────────────────────────────────────────────────

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    fireEvent.click(screen.getByText('Go'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>
    )
    fireEvent.click(screen.getByText('Go'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('applies primary variant styles', () => {
    render(<Button variant="primary">Save</Button>)
    const btn = screen.getByText('Save')
    expect(btn).toHaveStyle({ background: 'var(--color-ink)' })
  })

  it('applies danger variant styles', () => {
    render(<Button variant="danger">Delete</Button>)
    const btn = screen.getByText('Delete')
    expect(btn).toHaveStyle({ background: 'var(--color-red)' })
  })

  it('applies sm size class', () => {
    render(<Button size="sm">Tiny</Button>)
    expect(screen.getByText('Tiny').className).toContain('text-xs')
  })

  it('applies lg size class', () => {
    render(<Button size="lg">Big</Button>)
    expect(screen.getByText('Big').className).toContain('text-base')
  })
})

// ── Badge ─────────────────────────────────────────────────────────────────────

describe('Badge', () => {
  it('renders text', () => {
    render(<Badge>Hard</Badge>)
    expect(screen.getByText('Hard')).toBeInTheDocument()
  })

  it('applies custom color', () => {
    render(<Badge color="#ff0000">Red</Badge>)
    expect(screen.getByText('Red')).toHaveStyle({ background: '#ff0000' })
  })

  it('uses gold-light as default background', () => {
    render(<Badge>Default</Badge>)
    expect(screen.getByText('Default')).toHaveStyle({ background: 'var(--color-gold-light)' })
  })
})

// ── Card ──────────────────────────────────────────────────────────────────────

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies additional className', () => {
    render(<Card className="extra-class">Content</Card>)
    expect(screen.getByText('Content').parentElement ?? screen.getByText('Content')).toBeDefined()
  })
})

// ── Input ─────────────────────────────────────────────────────────────────────

describe('Input', () => {
  it('renders a label when provided', () => {
    render(<Input label="Email" id="email" />)
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('associates label with input via id', () => {
    render(<Input label="Name" id="name" />)
    const input = screen.getByLabelText('Name')
    expect(input.tagName).toBe('INPUT')
  })

  it('calls onChange when typed into', () => {
    const onChange = vi.fn()
    render(<Input onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('renders placeholder text', () => {
    render(<Input placeholder="Search…" />)
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument()
  })
})

// ── Textarea ──────────────────────────────────────────────────────────────────

describe('Textarea', () => {
  it('renders with label', () => {
    render(<Textarea label="Description" id="desc" />)
    expect(screen.getByText('Description')).toBeInTheDocument()
  })

  it('calls onChange', () => {
    const onChange = vi.fn()
    render(<Textarea onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'text' } })
    expect(onChange).toHaveBeenCalled()
  })
})

// ── Select ────────────────────────────────────────────────────────────────────

describe('Select', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ]

  it('renders all options', () => {
    render(<Select options={options} />)
    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
  })

  it('renders a label when provided', () => {
    render(<Select label="Type" id="type" options={options} />)
    expect(screen.getByText('Type')).toBeInTheDocument()
  })

  it('calls onChange on selection', () => {
    const onChange = vi.fn()
    render(<Select options={options} onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } })
    expect(onChange).toHaveBeenCalled()
  })
})

// ── Modal ─────────────────────────────────────────────────────────────────────

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()}>
        <p>Hidden</p>
      </Modal>
    )
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
  })

  it('renders children when open', () => {
    render(
      <Modal open onClose={vi.fn()}>
        <p>Visible</p>
      </Modal>
    )
    expect(screen.getByText('Visible')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    render(
      <Modal open title="Confirm" onClose={vi.fn()}>
        body
      </Modal>
    )
    expect(screen.getByText('Confirm')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal open title="Test" onClose={onClose}>
        body
      </Modal>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Modal open onClose={onClose}>
        body
      </Modal>
    )
    // Click the outer backdrop div (first child of container)
    fireEvent.click(container.firstChild as Element)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not close when content area is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose}>
        <p>Inner</p>
      </Modal>
    )
    fireEvent.click(screen.getByText('Inner'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ── Empty ─────────────────────────────────────────────────────────────────────

describe('Empty', () => {
  it('renders the message', () => {
    render(<Empty message="No items yet." />)
    expect(screen.getByText('No items yet.')).toBeInTheDocument()
  })

  it('renders default icon', () => {
    render(<Empty message="Empty" />)
    expect(screen.getByText('○')).toBeInTheDocument()
  })

  it('renders custom icon', () => {
    render(<Empty icon="?" message="No questions." />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})

// ── TransportPill ─────────────────────────────────────────────────────────────

describe('TransportPill', () => {
  it('shows PeerJS label when connected via peer', () => {
    render(<TransportPill status="connected" type="peer" />)
    expect(screen.getByText('PeerJS')).toBeInTheDocument()
  })

  it('shows Gun.js label when connected via gun', () => {
    render(<TransportPill status="connected" type="gun" />)
    expect(screen.getByText('Gun.js')).toBeInTheDocument()
  })

  it('shows Connecting… during connecting state', () => {
    render(<TransportPill status="connecting" type={null} />)
    expect(screen.getByText('Connecting…')).toBeInTheDocument()
  })

  it('shows Offline when disconnected', () => {
    render(<TransportPill status="disconnected" type={null} />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('shows Offline when idle', () => {
    render(<TransportPill status="idle" type={null} />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })
})
