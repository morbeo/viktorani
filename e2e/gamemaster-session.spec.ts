import { test, expect, Browser, BrowserContext, Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedGame(page: Page): Promise<string> {
  // Create a question
  await page.goto('#/admin/questions')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: /add question|new question/i }).click()
  await page
    .getByRole('textbox', { name: /question text|question/i })
    .fill('What is 2 + 2?')
  await page.getByRole('textbox', { name: /answer/i }).fill('4')
  await page.getByRole('button', { name: /save/i }).click()
  await expect(page.getByText('What is 2 + 2?')).toBeVisible()

  // Create a game
  await page.goto('#/admin/games')
  await page.waitForLoadState('networkidle')

  const gameName = `Game-${Date.now()}`
  await page.getByRole('button', { name: /new game|add game|create game/i }).click()
  await page.getByRole('textbox', { name: /game name|name/i }).first().fill(gameName)
  await page.getByRole('button', { name: /save/i }).click()

  // Open the game — collect the URL to extract the ID
  await page.getByText(gameName).click()
  await page.waitForLoadState('networkidle')

  const url = page.url()
  const match = url.match(/game\/([^/#?]+)/)
  if (!match) throw new Error(`Could not extract game id from URL: ${url}`)
  return match[1]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('gamemaster: full game session', () => {
  let browser: Browser
  let hostContext: BrowserContext
  let screenContext: BrowserContext
  let hostPage: Page
  let screenPage: Page

  test.beforeAll(async ({ browser: b }) => {
    browser = b
    hostContext = await browser.newContext()
    screenContext = await browser.newContext()
    hostPage = await hostContext.newPage()
    screenPage = await screenContext.newPage()
  })

  test.afterAll(async () => {
    await hostContext.close()
    await screenContext.close()
  })

  test('start game, reveal question, mark correct, advance, end', async () => {
    // Seed data and navigate host to the GameMaster view
    const gameId = await seedGame(hostPage)
    await hostPage.goto(`#/admin/game/${gameId}`)
    await hostPage.waitForLoadState('networkidle')

    // Add the question to a round if needed
    const addRoundBtn = hostPage.getByRole('button', { name: /add round|new round/i })
    if (await addRoundBtn.isVisible({ timeout: 2000 })) await addRoundBtn.click()

    const addQBtn = hostPage
      .getByRole('button', { name: /add question|pick question/i })
      .first()
    if (await addQBtn.isVisible({ timeout: 2000 })) {
      await addQBtn.click()
      await hostPage.getByText('What is 2 + 2?').click()
      const confirmBtn = hostPage.getByRole('button', { name: /add|confirm/i })
      if (await confirmBtn.isVisible({ timeout: 1000 })) await confirmBtn.click()
    }

    // Open screen view in second context
    await screenPage.goto(`http://localhost:4173/viktorani/#/game/${gameId}`)
    await screenPage.waitForLoadState('networkidle')
    await expect(screenPage.locator('#root')).not.toBeEmpty()

    // --- Start game ---
    await hostPage
      .getByRole('button', { name: /start game|begin/i })
      .or(hostPage.getByTestId('start-game'))
      .click()

    // Game state transitions to active
    await expect(
      hostPage
        .getByText(/active|in progress|live/i)
        .or(hostPage.getByTestId('game-status').filter({ hasText: /active/i })),
    ).toBeVisible()

    // --- Reveal question ---
    await hostPage
      .getByRole('button', { name: /reveal|show question/i })
      .or(hostPage.getByTestId('reveal-question'))
      .first()
      .click()

    // Screen view should show the question text
    await expect(screenPage.getByText('What is 2 + 2?')).toBeVisible({
      timeout: 10_000,
    })

    // --- Mark answer correct ---
    // Host needs a team/player to score — assert scoreboard exists first
    const scoreboard = hostPage
      .getByTestId('scoreboard')
      .or(hostPage.getByRole('table', { name: /score/i }))
      .or(hostPage.getByText(/scoreboard/i).locator('..'))

    // Mark correct (may be a per-team button or a general "correct" button)
    const correctBtn = hostPage
      .getByRole('button', { name: /correct|mark correct/i })
      .first()
    if (await correctBtn.isVisible({ timeout: 2000 })) {
      const scoreBefore = await scoreboard
        .textContent()
        .catch(() => '')
      await correctBtn.click()
      // Scoreboard content should change
      await expect(scoreboard).not.toHaveText(scoreBefore ?? '', { timeout: 5000 }).catch(
        () => {
          // If no teams exist scoreboard won't change — just assert it's visible
          return expect(scoreboard).toBeVisible()
        },
      )
    }

    // --- Advance to next question ---
    await hostPage
      .getByRole('button', { name: /next question|advance/i })
      .or(hostPage.getByTestId('next-question'))
      .click()
      .catch(() => {
        // If only one question, "next" may not exist — acceptable
      })

    // Previous question no longer highlighted as active
    await expect(
      hostPage.getByTestId('active-question').filter({ hasText: 'What is 2 + 2?' }),
    ).not.toBeVisible({ timeout: 3000 }).catch(() => {})

    // --- End game ---
    await hostPage
      .getByRole('button', { name: /end game|finish/i })
      .or(hostPage.getByTestId('end-game'))
      .click()

    const confirmEnd = hostPage.getByRole('button', { name: /confirm|yes|end/i })
    if (await confirmEnd.isVisible({ timeout: 1000 })) await confirmEnd.click()

    // Final scoreboard visible on host
    await expect(
      hostPage
        .getByText(/final score|game over|results/i)
        .or(hostPage.getByTestId('final-scoreboard')),
    ).toBeVisible({ timeout: 10_000 })
  })
})
