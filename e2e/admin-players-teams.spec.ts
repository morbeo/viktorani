import { test, expect } from '@playwright/test'

test.describe('admin: manage players and teams', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('#/admin/players-teams')
    await page.waitForLoadState('networkidle')
  })

  test('create a label and verify it appears in the list', async ({ page }) => {
    const labelName = `Label-${Date.now()}`

    // Open the manage-labels UI (button or tab named "Labels")
    await page.getByRole('button', { name: /manage labels/i }).click()
    await page.getByRole('textbox', { name: /label name/i }).fill(labelName)
    await page.getByRole('button', { name: /add label/i }).click()

    await expect(page.getByText(labelName)).toBeVisible()
  })

  test('create a player, assign label, verify chip in list', async ({ page }) => {
    const playerName = `Player-${Date.now()}`
    const labelName = `Label-${Date.now()}`

    // Create label first
    await page.getByRole('button', { name: /manage labels/i }).click()
    await page.getByRole('textbox', { name: /label name/i }).fill(labelName)
    await page.getByRole('button', { name: /add label/i }).click()
    // Close/dismiss labels panel if needed
    const closeBtn = page.getByRole('button', { name: /close/i })
    if (await closeBtn.isVisible()) await closeBtn.click()

    // Create player
    await page.getByRole('button', { name: /add player/i }).click()
    await page.getByRole('textbox', { name: /player name/i }).fill(playerName)

    // Assign label in the form
    await page.getByRole('option', { name: labelName }).click().catch(() => {
      // label picker may be a checkbox or chip — try checkbox fallback
      return page.getByLabel(labelName).check()
    })

    await page.getByRole('button', { name: /save/i }).click()

    // Player row appears with the label chip
    const playerRow = page.getByRole('row', { name: new RegExp(playerName, 'i') })
      .or(page.getByTestId('player-row').filter({ hasText: playerName }))
    await expect(playerRow).toBeVisible()
    await expect(playerRow.getByText(labelName)).toBeVisible()
  })

  test('create a team and verify contrast warning for low-contrast colour', async ({
    page,
  }) => {
    const teamName = `Team-${Date.now()}`

    await page.getByRole('button', { name: /add team/i }).click()
    await page.getByRole('textbox', { name: /team name/i }).fill(teamName)

    // Pick a low-contrast combination: white text on white/very-light bg
    const bgInput = page
      .getByLabel(/background/i)
      .or(page.getByTestId('team-bg-color'))
    const fgInput = page
      .getByLabel(/text colour|foreground|text color/i)
      .or(page.getByTestId('team-fg-color'))

    if (await bgInput.isVisible()) {
      await bgInput.fill('#ffffff')
      await fgInput.fill('#ffffff')
    }

    // Contrast warning should appear
    await expect(
      page.getByText(/contrast/i).or(page.getByRole('alert')),
    ).toBeVisible()

    await page.getByRole('button', { name: /cancel|close/i }).click()
  })

  test('assign player to team via BulkActionBar and verify membership', async ({
    page,
  }) => {
    const playerName = `BulkPlayer-${Date.now()}`
    const teamName = `BulkTeam-${Date.now()}`

    // Create team
    await page.getByRole('button', { name: /add team/i }).click()
    await page.getByRole('textbox', { name: /team name/i }).fill(teamName)
    await page.getByRole('button', { name: /save/i }).click()

    // Create player
    await page.getByRole('button', { name: /add player/i }).click()
    await page.getByRole('textbox', { name: /player name/i }).fill(playerName)
    await page.getByRole('button', { name: /save/i }).click()

    // Select the player row checkbox
    const playerRow = page
      .getByTestId('player-row')
      .filter({ hasText: playerName })
      .or(page.getByRole('row', { name: new RegExp(playerName, 'i') }))
    await playerRow.getByRole('checkbox').check()

    // Bulk action: assign team
    await page
      .getByRole('button', { name: /assign team/i })
      .or(page.getByTestId('bulk-assign-team'))
      .click()

    await page.getByRole('option', { name: new RegExp(teamName, 'i') }).click()
    await page.getByRole('button', { name: /apply|confirm/i }).click().catch(() => {})

    // Verify team name appears on the player row
    await expect(playerRow.getByText(teamName)).toBeVisible()
  })

  test('archive a player and verify they disappear from the active list', async ({
    page,
  }) => {
    const playerName = `Archive-${Date.now()}`

    await page.getByRole('button', { name: /add player/i }).click()
    await page.getByRole('textbox', { name: /player name/i }).fill(playerName)
    await page.getByRole('button', { name: /save/i }).click()

    const playerRow = page
      .getByTestId('player-row')
      .filter({ hasText: playerName })
      .or(page.getByRole('row', { name: new RegExp(playerName, 'i') }))
    await expect(playerRow).toBeVisible()

    // Open context menu / actions and archive
    await playerRow.getByRole('button', { name: /actions|more|archive/i }).click()
    const archiveBtn = page.getByRole('menuitem', { name: /archive/i })
      .or(page.getByRole('button', { name: /archive/i }))
    await archiveBtn.click()

    // Confirm if prompted
    const confirmBtn = page.getByRole('button', { name: /confirm|yes/i })
    if (await confirmBtn.isVisible({ timeout: 1000 })) await confirmBtn.click()

    await expect(playerRow).not.toBeVisible()
  })

  test('player QR modal renders an SVG or canvas element', async ({ page }) => {
    const playerName = `QR-Player-${Date.now()}`

    await page.getByRole('button', { name: /add player/i }).click()
    await page.getByRole('textbox', { name: /player name/i }).fill(playerName)
    await page.getByRole('button', { name: /save/i }).click()

    const playerRow = page
      .getByTestId('player-row')
      .filter({ hasText: playerName })
      .or(page.getByRole('row', { name: new RegExp(playerName, 'i') }))

    // Open QR modal
    await playerRow
      .getByRole('button', { name: /qr|share/i })
      .or(playerRow.getByTestId('qr-button'))
      .click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    // QR code is rendered as SVG (qrcode.react default) or canvas
    await expect(modal.locator('svg, canvas').first()).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()
  })

  test('team QR modal renders an SVG or canvas element', async ({ page }) => {
    const teamName = `QR-Team-${Date.now()}`

    await page.getByRole('button', { name: /add team/i }).click()
    await page.getByRole('textbox', { name: /team name/i }).fill(teamName)
    await page.getByRole('button', { name: /save/i }).click()

    const teamRow = page
      .getByTestId('team-row')
      .filter({ hasText: teamName })
      .or(page.getByRole('row', { name: new RegExp(teamName, 'i') }))

    await teamRow
      .getByRole('button', { name: /qr|share/i })
      .or(teamRow.getByTestId('qr-button'))
      .click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    await expect(modal.locator('svg, canvas').first()).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()
  })

  test('label filter chips cycle neutral -> include -> exclude', async ({ page }) => {
    const labelName = `Filter-Label-${Date.now()}`

    // Create a label to filter by
    await page.getByRole('button', { name: /manage labels/i }).click()
    await page.getByRole('textbox', { name: /label name/i }).fill(labelName)
    await page.getByRole('button', { name: /add label/i }).click()
    const closeBtn = page.getByRole('button', { name: /close/i })
    if (await closeBtn.isVisible()) await closeBtn.click()

    // The chip should start neutral
    const chip = page
      .getByTestId('label-filter-chip')
      .filter({ hasText: labelName })
      .or(page.getByRole('button', { name: new RegExp(labelName, 'i') }))

    // Click once: include
    await chip.click()
    await expect(chip).toHaveAttribute(
      'data-state',
      /include|active|selected/,
    ).catch(() =>
      // fallback: assert an aria-pressed or class change
      expect(chip).toHaveClass(/include|active|selected/),
    )

    // Click again: exclude
    await chip.click()
    await expect(chip).toHaveAttribute('data-state', /exclude/).catch(() =>
      expect(chip).toHaveClass(/exclude/),
    )

    // Click again: back to neutral
    await chip.click()
    await expect(chip).not.toHaveClass(/include|active|exclude/)
  })
})
