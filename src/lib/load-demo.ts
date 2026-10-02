/**
 * Add the demo data (sample questions, rounds, teams and a ready-to-run game) and return
 * the demo game's name. The seed module is loaded on demand. Loading twice adds nothing.
 */
export async function loadDemo(): Promise<string> {
  const { seedDemo, DEMO_GAME_NAME } = await import('@/db/demo')
  await seedDemo()
  return DEMO_GAME_NAME
}
