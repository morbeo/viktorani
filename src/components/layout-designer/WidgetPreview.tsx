import type { ComponentType } from 'react'
import type { LayoutTarget, WidgetType } from '@/db'
import { WIDGET_REGISTRY } from '@/widgets/registry'
import type { WidgetProps } from '@/widgets/types'
import { canPreview, samplePlayerData, sampleScreenData } from './sample-data'
import type { PreviewSample } from './sample-data'

interface WidgetPreviewProps {
  type: WidgetType
  /** The widget's settings; omitted, its type's defaults. */
  config?: unknown
  target: LayoutTarget
  sample: PreviewSample
  className?: string
}

/**
 * One widget as it would look on `target`, drawn at half size with the designer's sample
 * data. It's a picture only: hidden from screen readers and out of reach of the pointer and
 * keyboard, so whatever holds it keeps its own drag, click and focus behaviour. Renders
 * nothing when the widget can't be previewed or its settings don't fit its schema.
 */
export function WidgetPreview({
  type,
  config,
  target,
  sample,
  className = '',
}: WidgetPreviewProps) {
  if (!canPreview(type, target)) return null
  const def = WIDGET_REGISTRY[type]
  const parsed = def.configSchema.safeParse(config ?? def.defaultConfig)
  if (!parsed.success) return null
  // Registry components are untyped (see `WidgetDefinition`); here they get widget props
  const Component = def.components[target] as ComponentType<WidgetProps<unknown>>
  const data = target === 'player' ? samplePlayerData(sample) : sampleScreenData(sample)

  return (
    <div
      aria-hidden
      inert
      data-widget-preview={type}
      className={`pointer-events-none overflow-hidden ${className}`}
    >
      <div className="flex w-[200%] origin-top-left scale-50 flex-col items-center text-(--color-text)">
        <Component data={data} config={parsed.data} />
      </div>
    </div>
  )
}
