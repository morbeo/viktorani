import { useSyncExternalStore } from 'react'
import { getSettings, setSettings, subscribeSettings } from '@/lib/app-settings'

/** The app settings and a setter that merges a patch; re-renders on any change. */
export function useAppSettings() {
  const settings = useSyncExternalStore(subscribeSettings, getSettings)
  return [settings, setSettings] as const
}
