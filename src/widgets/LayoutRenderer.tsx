import type { ComponentType, CSSProperties } from 'react'
import type { LayoutBreakpoint, LayoutTarget, LayoutTheme } from '@/db'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useIsDark } from '@/hooks/useAppTheme'
import { resolveRect } from '@/lib/layout-grid'
import { layoutVars } from '@/lib/theme'
import type { LayoutBundle } from './layouts'
import { WIDGET_REGISTRY } from './registry'
import type { SurfaceData, WidgetProps } from './types'

interface LayoutRendererProps<T extends LayoutTarget> {
  bundle: LayoutBundle
  target: T
  /** The surface's live game state, handed to every widget as `data`. */
  data: SurfaceData[T]
  /** Device class whose placement overrides apply; `null` uses the base grid. */
  breakpoint?: LayoutBreakpoint | null
  /** Root element and classes, so a surface can make the renderer its page. */
  as?: 'div' | 'main'
  className?: string
  /** Base colours etc.; the layout's theme overrides them. */
  style?: CSSProperties
  /** Whether the surface shows its dark palette; defaults to this device's light or dark mode. */
  dark?: boolean
  /** A logo to show when the layout has none of its own, such as the theme's wordmark. */
  logo?: string | null
  /** Classes for each widget's grid cell. */
  cellClassName?: string
}

/**
 * Inline overrides for a layout's theme; only what it sets, so the rest inherits from the
 * game or app theme (ADR 0022).
 */
function themeStyle(theme: LayoutTheme, target: LayoutTarget, dark: boolean): CSSProperties {
  const style: Record<string, string | number> = layoutVars(theme, target, dark)
  if (style['--color-bg']) style.background = 'var(--color-bg)'
  if (theme.fontScale !== 1) style.zoom = theme.fontScale
  return style as CSSProperties
}

/**
 * Renders a layout's widgets on its 12-column grid, with live data from the surface.
 *
 * @remarks
 * Widgets go in `order` (their reading order) and each is placed at its rect for
 * `breakpoint`. A widget whose type has no component for `target`, or whose config doesn't
 * match its type's schema, is left out rather than breaking the page; `resolveLayout`
 * already prefers layouts where that can't happen. A cell whose widget renders nothing is
 * hidden (`empty:hidden`), and rows have no gap of their own, so empty rows collapse:
 * spacing between widgets belongs in `cellClassName`. Placement and theme overrides depend
 * on stored numbers, so they are inline styles.
 */
export function LayoutRenderer<T extends LayoutTarget>({
  bundle,
  target,
  data,
  breakpoint = null,
  as: Root = 'div',
  className = '',
  style,
  cellClassName = '',
  dark,
  logo = null,
}: LayoutRendererProps<T>) {
  const [{ theme: mode }] = useAppSettings()
  const deviceDark = useIsDark(mode)
  const { layout, widgets } = bundle
  const sorted = [...widgets].sort((a, b) => a.order - b.order)

  return (
    <Root
      className={`relative grid grid-cols-12 content-start ${className}`}
      style={{ ...style, ...themeStyle(layout.theme, target, dark ?? deviceDark) }}
      data-layout-id={layout.id}
    >
      {(layout.theme.logo ?? logo) && (
        <img
          src={layout.theme.logo ?? logo ?? undefined}
          alt=""
          className="absolute top-4 left-4 max-h-16 max-w-48"
        />
      )}
      {sorted.map(widget => {
        const def = WIDGET_REGISTRY[widget.type]
        // Registry components are untyped (see `WidgetDefinition`); here they get widget props
        const Component = def.components[target] as
          ComponentType<WidgetProps<SurfaceData[T]>> | undefined
        const config = def.configSchema.safeParse(widget.config)
        if (!Component || !config.success) return null
        const { x, y, w, h } = resolveRect(widget, breakpoint)
        return (
          <div
            key={widget.id}
            className={`min-w-0 empty:hidden ${cellClassName}`}
            style={{ gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${h}` }}
            data-widget={widget.type}
          >
            <Component data={data} config={config.data} />
          </div>
        )
      })}
    </Root>
  )
}
