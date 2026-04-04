import '@testing-library/jest-dom'
import { vi } from 'vitest'

// IndexedDB polyfill for Dexie
import 'fake-indexeddb/auto'

// URL methods not in jsdom
globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
globalThis.URL.revokeObjectURL = vi.fn()
