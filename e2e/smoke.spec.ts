import { test, expect } from '@playwright/test'

test('app loads and title contains Viktorani', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Viktorani/i)
})
