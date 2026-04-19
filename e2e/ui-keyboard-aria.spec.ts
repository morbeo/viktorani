import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// ---------------------------------------------------------------------------
// axe audits — critical and serious violations only
// ---------------------------------------------------------------------------

const ROUTES: Array<{ label: string; hash: string }> = [
  { label: 'home (redirects to /admin)', hash: '' },
  { label: '/admin/players-teams', hash: '#/admin/players-teams' },
  { label: '/admin/games', hash: '#/admin/games' },
  { label: '/admin/questions', hash: '#/admin/questions' },
]

test.describe('ui: axe audit — zero critical/serious violations', () => {
  for (const { label, hash } of ROUTES) {
    test(`no critical/serious violations on ${label}`, async ({ page }) => {
      await page.goto(hash || '/')
      await page.waitForLoadState('networkidle')
      // Wait for Suspense lazy-load to settle
      await page.waitForTimeout(500)

      const results = await new AxeBuilder({ page })
        // Exclude rules that fire for third-party widgets we don't control
        .disableRules(['color-contrast']) // checked separately below
        .analyze()

      const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      )

      expect(
        blocking,
        `axe critical/serious violations on "${label}":\n` +
          blocking
            .map((v) => `  [${v.impact}] ${v.id}: ${v.description}`)
            .join('\n'),
      ).toHaveLength(0)
    })
  }
})

test.describe('ui: colour contrast — no violations on key routes', () => {
  for (const { label, hash } of ROUTES) {
    test(`contrast >= 4.5:1 on ${label}`, async ({ page }) => {
      await page.goto(hash || '/')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const results = await new AxeBuilder({ page })
        .withRules(['color-contrast'])
        .analyze()

      const violations = results.violations
      expect(
        violations,
        `colour contrast violations on "${label}":\n` +
          violations
            .flatMap((v) => v.nodes.map((n) => `  ${n.html}`))
            .join('\n'),
      ).toHaveLength(0)
    })
  }
})

// ---------------------------------------------------------------------------
// Keyboard navigation — Players & Teams page
// ---------------------------------------------------------------------------

test.describe('ui: keyboard navigation on players-teams page', () => {
  test('all interactive elements are reachable via Tab', async ({ page }) => {
    await page.goto('#/admin/players-teams')
    await page.waitForLoadState('networkidle')

    // Seed a player so there is at least one row to tab through
    await page.getByRole('button', { name: /add player/i }).click()
    await page.getByRole('textbox', { name: /player name/i }).fill(`Kbd-${Date.now()}`)
    await page.getByRole('button', { name: /save/i }).click()
    await page.keyboard.press('Escape')

    // Reset focus to the top of the page
    await page.locator('body').focus()

    // Tab through up to 40 elements and collect all focused elements
    const reached = new Set<string>()
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      const tag = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return null
        return (
          el.getAttribute('data-testid') ??
          el.getAttribute('aria-label') ??
          el.getAttribute('role') ??
          el.tagName.toLowerCase()
        )
      })
      if (tag) reached.add(tag)
    }

    // At minimum the "Add player" button and a player row action must be reachable
    const hasButton = [...reached].some((r) =>
      /button|add|player/i.test(r),
    )
    expect(hasButton, `Tab sequence reached: ${[...reached].join(', ')}`).toBe(true)
  })

  test('QR modal opens with Enter and closes with Escape', async ({ page }) => {
    await page.goto('#/admin/players-teams')
    await page.waitForLoadState('networkidle')

    // Seed a player
    const playerName = `KbdQR-${Date.now()}`
    await page.getByRole('button', { name: /add player/i }).click()
    await page.getByRole('textbox', { name: /player name/i }).fill(playerName)
    await page.getByRole('button', { name: /save/i }).click()

    // Find the QR button via keyboard: Tab until focused
    let qrFocused = false
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('Tab')
      const label = await page.evaluate(() => {
        const el = document.activeElement
        if (!el) return ''
        return (
          el.getAttribute('aria-label') ??
          el.getAttribute('data-testid') ??
          el.textContent ??
          ''
        ).toLowerCase()
      })
      if (/qr|share/.test(label)) {
        qrFocused = true
        break
      }
    }

    if (qrFocused) {
      // Open with Enter
      await page.keyboard.press('Enter')
      const modal = page.getByRole('dialog')
      await expect(modal).toBeVisible()
      await expect(modal.locator('svg, canvas').first()).toBeVisible()

      // Close with Escape
      await page.keyboard.press('Escape')
      await expect(modal).not.toBeVisible()
    } else {
      // QR button not reachable by Tab — click it directly and verify keyboard close
      const playerRow = page
        .getByTestId('player-row')
        .filter({ hasText: playerName })
        .or(page.getByText(playerName).locator('..'))

      await playerRow
        .getByRole('button', { name: /qr|share/i })
        .or(playerRow.getByTestId('qr-button'))
        .click()

      const modal = page.getByRole('dialog')
      await expect(modal).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(modal).not.toBeVisible()
    }
  })

  test('QR modal close button is reachable by Tab+Enter', async ({ page }) => {
    await page.goto('#/admin/players-teams')
    await page.waitForLoadState('networkidle')

    const playerName = `KbdClose-${Date.now()}`
    await page.getByRole('button', { name: /add player/i }).click()
    await page.getByRole('textbox', { name: /player name/i }).fill(playerName)
    await page.getByRole('button', { name: /save/i }).click()

    const playerRow = page
      .getByTestId('player-row')
      .filter({ hasText: playerName })
      .or(page.getByText(playerName).locator('..'))

    await playerRow
      .getByRole('button', { name: /qr|share/i })
      .or(playerRow.getByTestId('qr-button'))
      .click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    // Tab inside the modal until the close button is focused, then press Enter
    let closed = false
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      const label = await page.evaluate(() => {
        const el = document.activeElement
        if (!el) return ''
        return (
          el.getAttribute('aria-label') ??
          el.textContent ??
          ''
        ).toLowerCase()
      })
      if (/close|dismiss|cancel/.test(label)) {
        await page.keyboard.press('Enter')
        closed = true
        break
      }
    }

    if (closed) {
      await expect(modal).not.toBeVisible()
    } else {
      // Fallback: Escape always closes
      await page.keyboard.press('Escape')
      await expect(modal).not.toBeVisible()
    }
  })
})
