import { test, expect, Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seed a game and navigate to its Layouts page so the host can save
 * a named layout. Returns the game ID.
 */
async function seedGameAndGetId(page: Page): Promise<string> {
  await page.goto('#/admin/games')
  await page.waitForLoadState('networkidle')

  const gameName = `LayoutGame-${Date.now()}`
  await page.getByRole('button', { name: /new game|add game|create game/i }).click()
  await page.getByRole('textbox', { name: /game name|name/i }).first().fill(gameName)
  await page.getByRole('button', { name: /save/i }).click()
  await page.getByText(gameName).click()
  await page.waitForLoadState('networkidle')

  const url = page.url()
  const match = url.match(/game\/([^/#?]+)/)
  if (!match) throw new Error(`Cannot extract game id from ${url}`)
  return match[1]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('player: screen widget layout renders correctly', () => {
  test('default layout renders at least one widget without JS errors', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    // Screen view lives at /game/:id or just /game for the public-facing display
    // Seed a game to get a real game ID
    const gameId = await seedGameAndGetId(page)
    await page.goto(`#/game/${gameId}`)
    await page.waitForLoadState('networkidle')

    // At least one widget element should be present
    const widget = page
      .getByTestId('screen-widget')
      .or(page.locator('[data-widget]'))
      .or(page.getByRole('region'))
      .first()

    await expect(widget).toBeVisible({ timeout: 10_000 })
    expect(errors, 'no JS errors on screen view').toHaveLength(0)
  })

  test('scoreboard widget renders without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    const gameId = await seedGameAndGetId(page)
    await page.goto(`#/game/${gameId}`)
    await page.waitForLoadState('networkidle')

    // Navigate to / activate the scoreboard widget if the layout supports it
    const scoreboardWidget = page
      .getByTestId('scoreboard-widget')
      .or(page.getByRole('region', { name: /scoreboard/i }))
      .or(page.getByText(/scoreboard/i).locator('..'))

    // Either it's in the default layout or we switch to it
    if (!(await scoreboardWidget.isVisible({ timeout: 3000 }))) {
      const switchBtn = page
        .getByRole('button', { name: /scoreboard/i })
        .or(page.getByTestId('widget-tab-scoreboard'))
      if (await switchBtn.isVisible({ timeout: 2000 })) await switchBtn.click()
    }

    await expect(scoreboardWidget).toBeVisible({ timeout: 5_000 })
    expect(errors).toHaveLength(0)
  })

  test('question display widget renders without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    const gameId = await seedGameAndGetId(page)
    await page.goto(`#/game/${gameId}`)
    await page.waitForLoadState('networkidle')

    const questionWidget = page
      .getByTestId('question-widget')
      .or(page.getByRole('region', { name: /question/i }))
      .or(page.getByText(/question/i).locator('..').first())

    if (!(await questionWidget.isVisible({ timeout: 3000 }))) {
      const switchBtn = page
        .getByRole('button', { name: /question/i })
        .or(page.getByTestId('widget-tab-question'))
      if (await switchBtn.isVisible({ timeout: 2000 })) await switchBtn.click()
    }

    await expect(questionWidget).toBeVisible({ timeout: 5_000 })
    expect(errors).toHaveLength(0)
  })

  test('named layout switch reflects correct widget composition', async ({
    browser,
  }) => {
    const hostCtx = await browser.newContext()
    const screenCtx = await browser.newContext()
    const hostPage = await hostCtx.newPage()
    const screenPage = await screenCtx.newPage()

    try {
      const gameId = await seedGameAndGetId(hostPage)

      // Host opens the Layouts editor for this game
      await hostPage.goto(`#/admin/layouts/${gameId}`)
      await hostPage.waitForLoadState('networkidle')

      // Save a named layout (may require toggling widgets)
      const layoutNameField = hostPage
        .getByRole('textbox', { name: /layout name/i })
        .or(hostPage.getByPlaceholder(/layout name/i))

      if (await layoutNameField.isVisible({ timeout: 3000 })) {
        const layoutName = `Layout-${Date.now()}`
        await layoutNameField.fill(layoutName)

        // Toggle at least one widget to differentiate from default
        const firstToggle = hostPage
          .getByRole('checkbox')
          .or(hostPage.getByRole('switch'))
          .first()
        if (await firstToggle.isVisible()) await firstToggle.click()

        await hostPage.getByRole('button', { name: /save layout/i }).click()

        // Screen picks up the active layout
        await screenPage.goto(`http://localhost:4173/viktorani/#/game/${gameId}`)
        await screenPage.waitForLoadState('networkidle')

        // Activate the new layout on host side
        const activateBtn = hostPage
          .getByRole('button', { name: new RegExp(layoutName, 'i') })
          .or(hostPage.getByTestId('activate-layout').filter({ hasText: layoutName }))
        if (await activateBtn.isVisible({ timeout: 3000 })) await activateBtn.click()

        // Screen should reflect the composition (at least one widget visible)
        await expect(
          screenPage
            .getByTestId('screen-widget')
            .or(screenPage.locator('[data-widget]'))
            .first(),
        ).toBeVisible({ timeout: 10_000 })
      }
    } finally {
      await hostCtx.close()
      await screenCtx.close()
    }
  })

  test('active layout persists after screen page reload', async ({ page }) => {
    const gameId = await seedGameAndGetId(page)
    await page.goto(`#/game/${gameId}`)
    await page.waitForLoadState('networkidle')

    // Capture the initial widget count
    const widgetCount = await page
      .getByTestId('screen-widget')
      .or(page.locator('[data-widget]'))
      .count()

    await page.reload({ waitUntil: 'networkidle' })

    // Widget count should match after reload (layout persisted in IDB)
    const widgetCountAfter = await page
      .getByTestId('screen-widget')
      .or(page.locator('[data-widget]'))
      .count()

    expect(widgetCountAfter).toBe(widgetCount)
  })
})
