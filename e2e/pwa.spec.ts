import { test, expect } from '@playwright/test'

// Routes the app declares (all behind HashRouter)
const ROUTES = ['/', '#/admin', '#/admin/questions', '#/admin/games', '#/join']

test.describe('pwa: shell loads on all routes', () => {
  for (const route of ROUTES) {
    test(`renders without crash: ${route}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (err) => errors.push(err.message))

      await page.goto(route)
      // App mounts a root element; absence of it means a blank-page crash
      await expect(page.locator('#root')).not.toBeEmpty()
      expect(errors, `console errors on ${route}`).toHaveLength(0)
    })
  }
})

test.describe('pwa: manifest', () => {
  test('manifest.webmanifest is served with required fields', async ({
    page,
    request,
  }) => {
    await page.goto('/')

    // Resolve manifest URL from the link element
    const manifestHref = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href')
    expect(manifestHref).toBeTruthy()

    const manifestUrl = new URL(manifestHref!, page.url()).toString()
    const response = await request.get(manifestUrl)
    expect(response.ok()).toBe(true)

    const manifest = await response.json()
    expect(manifest).toHaveProperty('name')
    expect(manifest).toHaveProperty('start_url')
    expect(Array.isArray(manifest.icons) && manifest.icons.length > 0).toBe(true)
  })
})

test.describe('pwa: service worker', () => {
  test('service worker is active after first reload', async ({ page }) => {
    // First visit registers the SW
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Reload to let the SW take control
    await page.reload({ waitUntil: 'networkidle' })

    const swActive = await page.evaluate(async () => {
      if (!navigator.serviceWorker) return false
      const reg = await navigator.serviceWorker.getRegistration()
      return !!(reg?.active)
    })

    expect(swActive).toBe(true)
  })

  test('app shell renders while offline after first load', async ({ page, context }) => {
    // Prime the SW cache
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.reload({ waitUntil: 'networkidle' })

    // Go offline
    await context.setOffline(true)

    await page.reload({ waitUntil: 'domcontentloaded' })

    // Root should still render — served from SW cache
    await expect(page.locator('#root')).not.toBeEmpty()

    // Restore
    await context.setOffline(false)
  })
})
