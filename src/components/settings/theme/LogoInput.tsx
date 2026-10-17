import { useState } from 'react'
import { ImageUp, Trash2 } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { MAX_LOGO_LENGTH } from '@/db/snapshot-schema'
import { LOGO_TYPES, downscaleImage } from '@/lib/image'

interface LogoInputProps {
  id: string
  label: string
  hint: string
  value: string | null
  onChange: (value: string | null) => void
}

/** Upload, preview and remove one logo; uploads are shrunk before they are stored. */
export function LogoInput({ id, label, hint, value, onChange }: LogoInputProps) {
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    try {
      const url = await downscaleImage(file)
      if (url.length > MAX_LOGO_LENGTH) throw new Error('That image is too large, even shrunk')
      setError(null)
      onChange(url)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-32 items-center justify-center rounded border bg-surface border-border">
          {value ? (
            <img
              src={value}
              alt={`${label} preview`}
              className="max-h-10 max-w-28 object-contain"
            />
          ) : (
            <span className="text-xs text-muted">None</span>
          )}
        </div>
        <label
          htmlFor={id}
          className="flex cursor-pointer items-center gap-1 rounded border px-3 py-1.5 text-xs border-border"
        >
          <Icon icon={ImageUp} size="sm" />
          Upload
        </label>
        <input
          id={id}
          type="file"
          accept={LOGO_TYPES.join(',')}
          className="sr-only"
          onChange={e => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void upload(file)
          }}
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove ${label}`}
            onClick={() => onChange(null)}
          >
            <Icon icon={Trash2} size="sm" />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted">{hint}</p>
      {error && (
        <p role="alert" className="text-xs text-negative">
          {error}
        </p>
      )}
    </div>
  )
}
