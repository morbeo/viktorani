import { useEffect, useRef, useState } from 'react'
import { isPlayerQrPayload, isTeamQrPayload } from '@/types/players-teams'
import type { QrPayload } from '@/types/players-teams'

interface Props {
  onScan: (payload: QrPayload) => void
  onError?: (msg: string) => void
}

/**
 * Camera-based QR scanner using the browser-native BarcodeDetector API.
 * Supported in Chrome 83+, Edge 83+, Safari 17+.
 * Falls back to a clear error for unsupported browsers.
 */
export default function QrScanner({ onScan, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const supported = 'BarcodeDetector' in window
  const [status, setStatus] = useState<'starting' | 'scanning' | 'unsupported' | 'denied'>(
    supported ? 'starting' : 'unsupported'
  )
  const stopRef = useRef(false)

  useEffect(() => {
    if (!supported) return
    stopRef.current = false

    let stream: MediaStream | null = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detector: any
    const video = videoRef.current

    async function start() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (stopRef.current) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        if (video) {
          video.srcObject = stream
          await video.play()
        }
        setStatus('scanning')
        scan()
      } catch {
        setStatus('denied')
        onError?.('Camera access denied or unavailable')
      }
    }

    async function scan() {
      if (stopRef.current || !video) return
      try {
        const barcodes = await detector.detect(video)
        if (barcodes.length > 0) {
          const raw = barcodes[0].rawValue as string
          let parsed: unknown
          try {
            parsed = JSON.parse(raw)
          } catch {
            onError?.('QR code is not a valid Viktorani payload')
            requestAnimationFrame(scan)
            return
          }
          if (isPlayerQrPayload(parsed) || isTeamQrPayload(parsed)) {
            onScan(parsed)
            return
          } else {
            onError?.('QR code is not a recognised Viktorani type')
          }
        }
      } catch {
        // BarcodeDetector throws when the video frame isn't ready yet — ignore
      }
      if (!stopRef.current) requestAnimationFrame(scan)
    }

    start()

    return () => {
      stopRef.current = true
      stream?.getTracks().forEach(t => t.stop())
      if (video) video.srcObject = null
    }
  }, [onScan, onError, supported])

  if (status === 'unsupported') {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-8 text-center px-4"
        style={{ color: 'var(--color-muted)' }}
      >
        <span className="text-3xl opacity-40">⊘</span>
        <p className="text-sm">QR scanning requires Chrome 83+, Edge 83+, or Safari 17+.</p>
        <p className="text-xs">Use Chrome or update your browser to enable the camera scanner.</p>
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-8 text-center px-4"
        style={{ color: 'var(--color-muted)' }}
      >
        <span className="text-3xl opacity-40">⊘</span>
        <p className="text-sm">Camera access was denied.</p>
        <p className="text-xs">Allow camera permission in your browser settings and try again.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative rounded-lg overflow-hidden"
        style={{ background: '#000', aspectRatio: '1 / 1', width: '100%' }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-cover"
          aria-label="Camera viewfinder"
        />
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden
        >
          <div
            className="w-40 h-40 rounded-lg"
            style={{
              border: '2px solid rgba(255,255,255,0.6)',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
            }}
          />
        </div>
      </div>
      <p className="text-xs text-center" style={{ color: 'var(--color-muted)' }}>
        {status === 'starting' ? 'Starting camera...' : 'Point at a Viktorani QR code'}
      </p>
    </div>
  )
}
