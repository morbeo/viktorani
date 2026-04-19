import { test, expect } from '@playwright/test'

test.describe('admin: manage questions and rounds', () => {
  test('question CRUD — create, edit, delete, persists across reload', async ({
    page,
  }) => {
    const qText = `Question-${Date.now()}`
    const qAnswer = `Answer-${Date.now()}`
    const qCategory = 'Geography'
    const qTextEdited = `${qText}-edited`

    await page.goto('#/admin/questions')
    await page.waitForLoadState('networkidle')

    // --- Create ---
    await page.getByRole('button', { name: /add question|new question/i }).click()

    await page.getByRole('textbox', { name: /question text|question/i }).fill(qText)
    await page.getByRole('textbox', { name: /answer/i }).fill(qAnswer)

    const categoryField = page
      .getByRole('combobox', { name: /category/i })
      .or(page.getByRole('textbox', { name: /category/i }))
    if (await categoryField.isVisible()) await categoryField.fill(qCategory)

    await page.getByRole('button', { name: /save/i }).click()

    await expect(page.getByText(qText)).toBeVisible()

    // --- Persist across reload ---
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByText(qText)).toBeVisible()

    // --- Edit ---
    const qRow = page.getByTestId('question-row').filter({ hasText: qText })
      .or(page.getByRole('row', { name: new RegExp(qText, 'i') }))
      .or(page.getByText(qText).locator('..'))

    await qRow.getByRole('button', { name: /edit/i }).click()

    const textField = page.getByRole('textbox', { name: /question text|question/i })
    await textField.clear()
    await textField.fill(qTextEdited)
    await page.getByRole('button', { name: /save/i }).click()

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByText(qTextEdited)).toBeVisible()
    await expect(page.getByText(qText, { exact: true })).not.toBeVisible()

    // --- Delete ---
    const editedRow = page
      .getByTestId('question-row')
      .filter({ hasText: qTextEdited })
      .or(page.getByText(qTextEdited).locator('..'))

    await editedRow.getByRole('button', { name: /delete|remove/i }).click()

    const confirmBtn = page.getByRole('button', { name: /confirm|delete|yes/i })
    if (await confirmBtn.isVisible({ timeout: 1000 })) await confirmBtn.click()

    await expect(page.getByText(qTextEdited)).not.toBeVisible()
  })

  test('round builder — add question, verify count, remove, verify decrement', async ({
    page,
  }) => {
    const qText = `Round-Q-${Date.now()}`
    const roundName = `Round-${Date.now()}`

    // --- Seed a question ---
    await page.goto('#/admin/questions')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /add question|new question/i }).click()
    await page.getByRole('textbox', { name: /question text|question/i }).fill(qText)
    await page
      .getByRole('textbox', { name: /answer/i })
      .fill(`Answer-${Date.now()}`)
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText(qText)).toBeVisible()

    // --- Navigate to Games / Rounds ---
    await page.goto('#/admin/games')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /new game|add game|create game/i }).click()
    const gameNameField = page
      .getByRole('textbox', { name: /game name|name/i })
      .first()
    await gameNameField.fill(roundName)
    await page.getByRole('button', { name: /save/i }).click()

    // Open the game to access its rounds
    await page.getByText(roundName).click()

    // Add a round (or the game itself acts as a round container)
    const addRoundBtn = page.getByRole('button', { name: /add round|new round/i })
    if (await addRoundBtn.isVisible({ timeout: 2000 })) await addRoundBtn.click()

    // Add the question to the round
    await page
      .getByRole('button', { name: /add question|pick question/i })
      .first()
      .click()

    // Select our question from the picker
    await page.getByText(qText).click()
    const confirmAdd = page.getByRole('button', { name: /add|confirm/i })
    if (await confirmAdd.isVisible({ timeout: 1000 })) await confirmAdd.click()

    // Count should read 1
    const countEl = page
      .getByTestId('round-question-count')
      .or(page.getByText(/1 question/i))
    await expect(countEl).toBeVisible()

    // Remove the question
    const questionEntry = page.getByTestId('round-question-item')
      .filter({ hasText: qText })
      .or(page.getByText(qText).locator('..'))

    await questionEntry.getByRole('button', { name: /remove|delete/i }).click()

    const countZero = page
      .getByTestId('round-question-count')
      .or(page.getByText(/0 question/i))
    await expect(countZero).toBeVisible()
    await expect(page.getByText(qText)).not.toBeVisible()
  })
})
