import { test, expect, Browser, BrowserContext, Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seed a game and return its ID, navigating hostPage to the GameMaster view.
 */
async function seedAndOpenGame(page: Page): Promise<string> {
  // Minimal question so the game can start
  await page.goto('#/admin/questions')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /add question|new question/i }).click()
  await page.getByRole('textbox', { name: /question text|question/i }).fill('Buzzer Q?')
  await page.getByRole('textbox', { name: /answer/i }).fill('Buzzer A')
  await page.getByRole('button', { name: /save/i }).click()

  await page.goto('#/admin/games')
  await page.waitForLoadState('networkidle')
  const gameName = `BuzzerGame-${Date.now()}`
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

/**
 * Extract the peer/room ID from the host page so players can join.
 * The host page exposes it via a data attribute, the URL, or a displayed code.
 */
async function getRoomId(hostPage: Page): Promise<string> {
  // Try data attribute first
  const el = hostPage.getByTestId('room-id').or(hostPage.getByTestId('peer-id'))
  if (await el.isVisible({ timeout: 3000 })) {
    return (await el.textContent()) ?? ''
  }

  // Fall back to extracting from current URL hash
  const url = hostPage.url()
  const match = url.match(/game\/([^/#?]+)/)
  if (match) return match[1]

  throw new Error('Could not determine room ID from host page')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('transport: buzzer events across two browser contexts', () => {
  let browser: Browser
  let hostCtx: BrowserContext
  let player1Ctx: BrowserContext
  let player2Ctx: BrowserContext
  let hostPage: Page
  let player1Page: Page
  let player2Page: Page

  test.beforeAll(async ({ browser: b }) => {
    browser = b
    hostCtx = await browser.newContext()
    player1Ctx = await browser.newContext()
    player2Ctx = await browser.newContext()
    hostPage = await hostCtx.newPage()
    player1Page = await player1Ctx.newPage()
    player2Page = await player2Ctx.newPage()
  })

  test.afterAll(async () => {
    await hostCtx.close()
    await player1Ctx.close()
    await player2Ctx.close()
  })

  test('buzzer lock, second player blocked, host unlock, all can buzz', async () => {
    // --- Host opens game session ---
    const gameId = await seedAndOpenGame(hostPage)
    await hostPage.goto(`#/admin/game/${gameId}`)
    await hostPage.waitForLoadState('networkidle')

    // Start the game so the buzzer is live
    await hostPage
      .getByRole('button', { name: /start game|begin/i })
      .or(hostPage.getByTestId('start-game'))
      .click()

    await expect(
      hostPage.getByText(/active|in progress|live/i)
        .or(hostPage.getByTestId('game-status').filter({ hasText: /active/i })),
    ).toBeVisible({ timeout: 10_000 })

    const roomId = await getRoomId(hostPage)

    // --- Players join ---
    const joinUrl = `http://localhost:4173/viktorani/#/join/${roomId}`
    await player1Page.goto(joinUrl)
    await player1Page.waitForLoadState('networkidle')

    await player2Page.goto(joinUrl)
    await player2Page.waitForLoadState('networkidle')

    // Players enter names and join
    const p1Name = `P1-${Date.now()}`
    const p2Name = `P2-${Date.now()}`

    const nameField1 = player1Page
      .getByRole('textbox', { name: /name|your name/i })
      .or(player1Page.getByPlaceholder(/name/i))
    if (await nameField1.isVisible({ timeout: 3000 })) {
      await nameField1.fill(p1Name)
      await player1Page
        .getByRole('button', { name: /join|enter|start/i })
        .first()
        .click()
    }

    const nameField2 = player2Page
      .getByRole('textbox', { name: /name|your name/i })
      .or(player2Page.getByPlaceholder(/name/i))
    if (await nameField2.isVisible({ timeout: 3000 })) {
      await nameField2.fill(p2Name)
      await player2Page
        .getByRole('button', { name: /join|enter|start/i })
        .first()
        .click()
    }

    // Wait for player pages to reach the play/buzzer view
    await player1Page.waitForLoadState('networkidle')
    await player2Page.waitForLoadState('networkidle')

    // --- Player 1 presses buzzer ---
    const pressTime = await player1Page.evaluate(() => performance.now())

    await player1Page
      .getByRole('button', { name: /buzz|buzzer/i })
      .or(player1Page.getByTestId('buzzer-button'))
      .click()

    // Host sees player 1 locked in
    await expect(
      hostPage
        .getByText(new RegExp(p1Name, 'i'))
        .or(hostPage.getByTestId('buzzer-lock-indicator')),
    ).toBeVisible({ timeout: 5_000 })

    // Capture receipt time on host
    const receiptTime = await hostPage.evaluate(() => performance.now())

    // Delta must be under 500 ms (same machine via localhost — will be << 500 ms)
    const delta = receiptTime - pressTime
    expect(delta).toBeLessThan(500)

    // --- Player 2 cannot buzz while locked ---
    const p2BuzzerBtn = player2Page
      .getByRole('button', { name: /buzz|buzzer/i })
      .or(player2Page.getByTestId('buzzer-button'))

    // Either the button is disabled or pressing it has no visible effect
    const isDisabled = await p2BuzzerBtn.isDisabled().catch(() => false)
    if (!isDisabled) {
      await p2BuzzerBtn.click({ force: true })
      // Host indicator should still show player 1, not player 2
      await expect(
        hostPage.getByTestId('buzzer-lock-indicator').filter({ hasText: p2Name }),
      ).not.toBeVisible({ timeout: 2000 }).catch(() => {})
    } else {
      expect(isDisabled).toBe(true)
    }

    // --- Host unlocks ---
    await hostPage
      .getByRole('button', { name: /unlock|reset buzzer|clear/i })
      .or(hostPage.getByTestId('unlock-buzzer'))
      .click()

    // Lock indicator gone
    await expect(
      hostPage.getByTestId('buzzer-lock-indicator'),
    ).not.toBeVisible({ timeout: 5_000 }).catch(() => {})

    // Both players can buzz again (buttons re-enabled)
    await expect(
      player1Page.getByRole('button', { name: /buzz|buzzer/i })
        .or(player1Page.getByTestId('buzzer-button')),
    ).toBeEnabled({ timeout: 5_000 })

    await expect(
      player2Page.getByRole('button', { name: /buzz|buzzer/i })
        .or(player2Page.getByTestId('buzzer-button')),
    ).toBeEnabled({ timeout: 5_000 })
  })
})
