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
    // jsdom has no BarcodeDetector, so the scanner sees an unsupported browser
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

// Hoisted so the vi.mock factory below can use them
const { mockDetectPlayerConflict, mockImportPlayerDirect } = vi.hoisted(() => ({
  mockDetectPlayerConflict: vi.fn(),
  mockImportPlayerDirect: vi.fn(),
}))

vi.mock('@/components/players-teams/qrImport', () => ({
  detectPlayerConflict: mockDetectPlayerConflict,
  importPlayerDirect: mockImportPlayerDirect,
  applyPlayerMerge: vi.fn(),
  importTeamQr: vi.fn(),
}))

const PLAYER_QR = JSON.stringify({
  type: 'viktorani/player/v1',
  id: 'p1',
  name: 'Alice',
  labels: [],
})

function stubCamera(rawValue: string) {
  vi.stubGlobal(
    'BarcodeDetector',
    class {
      detect = vi.fn().mockResolvedValue([{ rawValue }])
    }
  )
  const mockStream = { getTracks: () => [{ stop: vi.fn() }] }
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
  })
}

describe('ScanQrModal', () => {
  const onClose = vi.fn()
  const onImported = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockDetectPlayerConflict.mockResolvedValue(null)
    mockImportPlayerDirect.mockResolvedValue('p1')
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

  it('shows processing state while the import runs', async () => {
    mockDetectPlayerConflict.mockReturnValue(new Promise(() => {}))
    stubCamera(PLAYER_QR)
    render(<ScanQrModal open={true} onClose={onClose} onImported={onImported} />)

    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })
  })

  it('offers team assignment after a player import', async () => {
    stubCamera(PLAYER_QR)
    render(<ScanQrModal open={true} onClose={onClose} onImported={onImported} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Player imported' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Assign team' })).toBeInTheDocument()
    expect(onImported).toHaveBeenCalledWith(['p1'])
  })

  it('shows error state when scan fails', async () => {
    stubCamera('invalid')
    render(<ScanQrModal open={true} onClose={onClose} onImported={onImported} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Import failed' })).toBeInTheDocument()
    })
  })

  it('closes when the team assignment is skipped', async () => {
    stubCamera(PLAYER_QR)
    render(<ScanQrModal open={true} onClose={onClose} onImported={onImported} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Skip' }))
    expect(onClose).toHaveBeenCalled()
  })
})
