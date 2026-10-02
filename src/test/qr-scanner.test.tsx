// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QrScanner from '@/components/players-teams/QrScanner'
import ScanQrModal from '@/components/players-teams/ScanQrModal'

describe('QrScanner', () => {
  const onScan = vi.fn()
  const onError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows unsupported message when BarcodeDetector is not available', () => {
    vi.stubGlobal('BarcodeDetector', undefined)
    render(<QrScanner onScan={onScan} onError={onError} />)
    expect(screen.getByText(/QR scanning requires Chrome 83\+/i)).toBeInTheDocument()
  })

  it('shows camera denied message when permission is denied', async () => {
    vi.stubGlobal('BarcodeDetector', class {})
    const mockGetUserMedia = vi.fn().mockRejectedValue(new Error('Permission denied'))
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: mockGetUserMedia },
    })

    render(<QrScanner onScan={onScan} onError={onError} />)

    await waitFor(() => {
      expect(screen.getByText('Camera access was denied.')).toBeInTheDocument()
    })
    expect(onError).toHaveBeenCalledWith('Camera access denied or unavailable')
  })

  it('shows starting message initially when supported', () => {
    vi.stubGlobal('BarcodeDetector', class {})
    const mockStream = { getTracks: () => [] }
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: mockGetUserMedia },
    })

    render(<QrScanner onScan={onScan} onError={onError} />)
    expect(screen.getByText('Starting camera...')).toBeInTheDocument()
  })

  it('renders video element for camera viewfinder', () => {
    vi.stubGlobal('BarcodeDetector', class {})
    const mockStream = { getTracks: () => [] }
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: mockGetUserMedia },
    })

    render(<QrScanner onScan={onScan} onError={onError} />)
    expect(screen.getByLabelText('Camera viewfinder')).toBeInTheDocument()
  })

  it('calls onError when QR code is not valid JSON', async () => {
    const mockDetect = vi.fn().mockResolvedValue([{ rawValue: 'not-json' }])
    vi.stubGlobal('BarcodeDetector', class {
      detect = mockDetect
    })

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    }
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: mockGetUserMedia },
    })

    render(<QrScanner onScan={onScan} onError={onError} />)

    await waitFor(
      () => {
        expect(onError).toHaveBeenCalledWith('QR code is not a valid Viktorani payload')
      },
      { timeout: 3000 }
    )
  })

  it('calls onError when QR payload is not a recognized type', async () => {
    const mockDetect = vi.fn().mockResolvedValue([{ rawValue: '{"type":"unknown"}' }])
    vi.stubGlobal('BarcodeDetector', class {
      detect = mockDetect
    })

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    }
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: mockGetUserMedia },
    })

    render(<QrScanner onScan={onScan} onError={onError} />)

    await waitFor(
      () => {
        expect(onError).toHaveBeenCalledWith('QR code is not a recognised Viktorani type')
      },
      { timeout: 3000 }
    )
  })
})

// Hoisted so the vi.mock factory below can use it
const mockDb = vi.hoisted(() => ({
  players: {
    where: vi.fn().mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    }),
    add: vi.fn().mockResolvedValue('p1'),
    update: vi.fn().mockResolvedValue(undefined),
  },
  teams: {
    where: vi.fn().mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
      }),
    }),
    add: vi.fn().mockResolvedValue('t1'),
  },
}))

vi.mock('@/db', () => ({ db: mockDb }))

describe('ScanQrModal', () => {
  const onClose = vi.fn()
  const onImported = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('BarcodeDetector', undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders modal with title', () => {
    render(<ScanQrModal open={true} onClose={onClose} onImported={onImported} />)
    expect(screen.getByRole('heading', { name: 'Scan QR code' })).toBeInTheDocument()
  })

  it('shows QR scanner when modal is open', () => {
    render(<ScanQrModal open={true} onClose={onClose} onImported={onImported} />)
    expect(screen.getByText(/QR scanning requires/i)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<ScanQrModal open={false} onClose={onClose} onImported={onImported} />)
    expect(screen.queryByRole('heading', { name: 'Scan QR code' })).not.toBeInTheDocument()
  })

  it('shows processing state', async () => {
    vi.stubGlobal('BarcodeDetector', class {
      detect = vi.fn().mockResolvedValue([
        {
          rawValue: JSON.stringify({
            type: 'player',
            name: 'Alice',
            score: 0,
            teamId: null,
          }),
        },
      ])
    })

    const mockStream = { getTracks: () => [{ stop: vi.fn() }] }
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
    })

    render(<ScanQrModal open={true} onClose={onClose} onImported={onImported} />)

    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })
  })

  it('shows done state after successful import', async () => {
    vi.stubGlobal('BarcodeDetector', class {
      detect = vi.fn().mockResolvedValue([
        {
          rawValue: JSON.stringify({
            type: 'player',
            name: 'Alice',
            score: 0,
            teamId: null,
          }),
        },
      ])
    })

    const mockStream = { getTracks: () => [{ stop: vi.fn() }] }
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
    })

    render(<ScanQrModal open={true} onClose={onClose} onImported={onImported} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Player imported' })).toBeInTheDocument()
    })
  })

  it('shows assign team buttons after player import', async () => {
    vi.stubGlobal('BarcodeDetector', class {
      detect = vi.fn().mockResolvedValue([
        {
          rawValue: JSON.stringify({
            type: 'player',
            name: 'Bob',
            score: 0,
            teamId: null,
          }),
        },
      ])
    })

    const mockStream = { getTracks: () => [{ stop: vi.fn() }] }
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
    })

    render(<ScanQrModal open={true} onClose={onClose} onImported={onImported} />)

    await waitFor(() => {
      expect(screen.getByText('Assign team')).toBeInTheDocument()
      expect(screen.getByText('Skip')).toBeInTheDocument()
    })
  })

  it('shows error state when scan fails', async () => {
    vi.stubGlobal('BarcodeDetector', class {
      detect = vi.fn().mockResolvedValue([{ rawValue: 'invalid' }])
    })

    const mockStream = { getTracks: () => [{ stop: vi.fn() }] }
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
    })

    render(<ScanQrModal open={true} onClose={onClose} onImported={onImported} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Import failed' })).toBeInTheDocument()
    })
  })

  it('allows scanning another QR after done', async () => {
    vi.stubGlobal('BarcodeDetector', class {
      detect = vi.fn().mockResolvedValue([
        {
          rawValue: JSON.stringify({
            type: 'player',
            name: 'Charlie',
            score: 0,
            teamId: null,
          }),
        },
      ])
    })

    const mockStream = { getTracks: () => [{ stop: vi.fn() }] }
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
    })

    render(<ScanQrModal open={true} onClose={onClose} onImported={onImported} />)

    await waitFor(() => {
      expect(screen.getByText('Assign team')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Skip'))
    expect(onClose).toHaveBeenCalled()
  })
})
