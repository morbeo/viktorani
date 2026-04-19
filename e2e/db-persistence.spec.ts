import { test, expect, Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// IDB helpers (run in-browser via page.evaluate)
// ---------------------------------------------------------------------------

interface IdbRecord {
  id?: unknown
  name?: string
  archivedAt?: unknown
  [key: string]: unknown
}

/**
 * Open the 'viktorani' IndexedDB and return all records from a named store.
 */
async function readIdbStore(page: Page, storeName: string): Promise<IdbRecord[]> {
  return page.evaluate(
    ({ storeName }) =>
      new Promise<IdbRecord[]>((resolve, reject) => {
        const req = indexedDB.open('viktorani')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(storeName)) {
            db.close()
            resolve([])
            return
          }
          const tx = db.transaction(storeName, 'readonly')
          const store = tx.objectStore(storeName)
          const all = store.getAll()
          all.onsuccess = () => {
            db.close()
            resolve(all.result as IdbRecord[])
          }
          all.onerror = () => {
            db.close()
            reject(all.error)
          }
        }
      }),
    { storeName },
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('db: data survives page reload', () => {
  test('player record survives hard reload — UI and IDB match', async ({ page }) => {
    const playerName = `Persist-Player-${Date.now()}`

    await page.goto('#/admin/players-teams')
    await page.waitForLoadState('networkidle')

    // Create player via UI
    await page.getByRole('button', { name: /add player/i }).click()
    await page.getByRole('textbox', { name: /player name/i }).fill(playerName)
    await page.getByRole('button', { name: /save/i }).click()

    await expect(page.getByText(playerName)).toBeVisible()

    // Hard reload
    await page.reload({ waitUntil: 'networkidle' })

    // UI still shows the player
    await expect(page.getByText(playerName)).toBeVisible()

    // IDB contains the record
    const records = await readIdbStore(page, 'players')
    const match = records.find((r) => r.name === playerName)
    expect(match, `player "${playerName}" not found in IDB players store`).toBeTruthy()
    expect(match!.name).toBe(playerName)
  })

  test('team record survives hard reload — UI and IDB match', async ({ page }) => {
    const teamName = `Persist-Team-${Date.now()}`

    await page.goto('#/admin/players-teams')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /add team/i }).click()
    await page.getByRole('textbox', { name: /team name/i }).fill(teamName)
    await page.getByRole('button', { name: /save/i }).click()

    await expect(page.getByText(teamName)).toBeVisible()

    await page.reload({ waitUntil: 'networkidle' })

    await expect(page.getByText(teamName)).toBeVisible()

    const records = await readIdbStore(page, 'teams')
    const match = records.find((r) => r.name === teamName)
    expect(match, `team "${teamName}" not found in IDB teams store`).toBeTruthy()
    expect(match!.name).toBe(teamName)
  })

  test('label record survives hard reload — UI and IDB match', async ({ page }) => {
    const labelName = `Persist-Label-${Date.now()}`

    await page.goto('#/admin/players-teams')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /manage labels/i }).click()
    await page.getByRole('textbox', { name: /label name/i }).fill(labelName)
    await page.getByRole('button', { name: /add label/i }).click()

    await expect(page.getByText(labelName)).toBeVisible()

    await page.reload({ waitUntil: 'networkidle' })

    await expect(page.getByText(labelName)).toBeVisible()

    // Labels may live in a 'labels' or 'playerLabels' store
    const fromLabels = await readIdbStore(page, 'labels')
    const fromPlayerLabels = await readIdbStore(page, 'playerLabels')
    const allLabels = [...fromLabels, ...fromPlayerLabels]
    const match = allLabels.find((r) => r.name === labelName)
    expect(
      match,
      `label "${labelName}" not found in IDB labels/playerLabels store`,
    ).toBeTruthy()
  })

  test('IDB record fields match the UI state after reload', async ({ page }) => {
    const playerName = `Fields-Player-${Date.now()}`

    await page.goto('#/admin/players-teams')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /add player/i }).click()
    await page.getByRole('textbox', { name: /player name/i }).fill(playerName)
    await page.getByRole('button', { name: /save/i }).click()

    await page.reload({ waitUntil: 'networkidle' })

    const records = await readIdbStore(page, 'players')
    const record = records.find((r) => r.name === playerName)

    expect(record).toBeTruthy()
    // Must have a stable id
    expect(record!.id ?? record!.uuid ?? record!._id).toBeTruthy()
    // Must not be archived
    expect(record!.archivedAt ?? null).toBeNull()
  })
})
