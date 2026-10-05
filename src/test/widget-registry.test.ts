import { describe, it, expect } from 'vitest'
import { WIDGET_REGISTRY } from '@/widgets/registry'

describe('WIDGET_REGISTRY', () => {
  it.each(Object.entries(WIDGET_REGISTRY))(
    '%s has a component for every target it declares',
    (_type, def) => {
      for (const target of def.allowedTargets) {
        expect(def.components[target]).toBeDefined()
      }
    }
  )

  it.each(Object.entries(WIDGET_REGISTRY))(
    '%s has no component for a target it does not declare',
    (_type, def) => {
      for (const target of Object.keys(def.components) as (keyof typeof def.components)[]) {
        expect(def.allowedTargets).toContain(target)
      }
    }
  )

  it.each(Object.entries(WIDGET_REGISTRY))(
    '%s defaultConfig matches its own schema',
    (_type, def) => {
      expect(def.configSchema.parse({})).toEqual(def.defaultConfig)
    }
  )

  it.each(Object.entries(WIDGET_REGISTRY))(
    '%s registry key matches its own type field',
    (type, def) => {
      expect(def.type).toBe(type)
    }
  )
})
