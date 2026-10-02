/** Settings categories, in tab order. Each is a route: `/admin/settings/<id>`. */
export const SETTINGS_CATEGORIES = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'general', label: 'General' },
  { id: 'sound', label: 'Sound & notifications' },
  { id: 'timers', label: 'Timers' },
  { id: 'game-defaults', label: 'Game defaults' },
  { id: 'library', label: 'Library' },
  { id: 'data', label: 'Data' },
] as const

export type SettingsCategoryId = (typeof SETTINGS_CATEGORIES)[number]['id']
