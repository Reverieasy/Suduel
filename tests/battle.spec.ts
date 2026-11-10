import { expect, test } from '@playwright/test'
import type { RoomSnapshot } from '../src/features/multiplayer/types'

for (const width of [390,768,1024,1440]) test(`Battle UI fixtures fit ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 })
  const errors: string[] = []; page.on('pageerror',(error) => errors.push(error.message))
  for (const view of ['battle','fog','freeze','scramble','shield','intermission','battle-results']) {
    await page.goto(`/tests/fixtures/room-harness.html?view=${view}`)
    await expect(page.getByRole('button').first()).toBeVisible()
    if (!['intermission','battle-results'].includes(view)) await expect(page.getByRole('region', { name: 'Battle skills' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    if ([390,1440].includes(width) && ['battle','fog','intermission'].includes(view)) { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: testInfo.outputPath(`${view}-${width}.png`), fullPage: true }) }
  }
  expect(errors).toEqual([])
})

test('Fog conceals exactly the assigned region, expires, and preserves keyboard focus', async ({ page }) => {
  await page.goto('/tests/fixtures/room-harness.html?view=fog&ttl=1800')
  const concealed = page.getByRole('button', { name: /concealed by Fog/ })
  await expect(concealed).toHaveCount(9)
  expect(await concealed.allTextContents()).toEqual(Array(9).fill(''))
  await page.getByRole('grid', { name: 'Sudoku puzzle', exact: true }).getByRole('button').nth(0).focus()
  await expect(page.locator('[data-effect=fog]')).toHaveCount(0)
  await expect(concealed).toHaveCount(0)
  await expect(page.getByRole('grid', { name: 'Sudoku puzzle', exact: true }).getByRole('button').nth(0)).toBeFocused()
})

test('Freeze disables entry only while valid; the same grid resumes without reset', async ({ page }) => {
  await page.goto('/tests/fixtures/room-harness.html?view=freeze&ttl=1600')
  const grid = page.getByRole('grid', { name: 'Sudoku puzzle', exact: true }), cell = grid.getByRole('button').nth(0)
  await expect(grid).toHaveAttribute('aria-disabled','true')
  await cell.focus(); await page.keyboard.press('1')
  await expect(page.getByTestId('last-command')).toBeEmpty()
  await expect(grid).toHaveAttribute('aria-disabled','false')
  await expect(cell).toBeFocused(); await page.keyboard.press('1')
  await expect(page.getByTestId('last-command')).toContainText('"digit":1')
  await expect(page.locator('[data-effect=freeze]')).toHaveCount(0)
})

test('Scramble changes board digits, preserves the keypad, translates input and restores clues', async ({ page }) => {
  await page.goto('/tests/fixtures/room-harness.html?view=scramble&ttl=4500')
  const buttons = page.locator('.number-pad button'), grid=page.getByRole('grid',{name:'Sudoku puzzle',exact:true})
  expect(await buttons.allTextContents()).toEqual(['1','2','3','4','5','6','7','8','9'])
  await expect(grid.getByRole('button').nth(1)).toHaveText('8') // Canonical clue 2 maps to 8.
  await buttons.first().click(); await expect(page.getByTestId('last-command')).toContainText('"digit":9')
  await grid.getByRole('button').nth(0).focus(); await page.keyboard.press('4')
  await expect(page.getByTestId('last-command')).toContainText('"digit":6')
  await page.keyboard.press('n'); await page.keyboard.press('4')
  await expect(grid.getByRole('button').nth(0)).toHaveAccessibleName(/notes 4/)
  await expect(page.locator('[data-effect=scramble]')).toHaveCount(0)
  await expect(grid.getByRole('button').nth(1)).toHaveText('2')
  await expect(grid.getByRole('button').nth(0)).toHaveAccessibleName(/notes 6/)
  await page.keyboard.press('n'); await page.keyboard.press('4')
  await expect(page.getByTestId('last-command')).toContainText('"digit":4')
})

test('Accepted events render distinct cues, wrong feedback clears, and reduced motion disables shake', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tests/fixtures/room-harness.html?view=battle')
  const grid = page.getByRole('grid', { name: 'Sudoku puzzle', exact: true }); await grid.getByRole('button').nth(0).focus()
  await page.getByRole('button', { name: 'Fixture incoming hit' }).click()
  await expect(page.locator('.visual-impact')).toHaveCount(1)
  await expect(page.locator('.light-shake')).toHaveCSS('animation-duration','0.18s')
  await page.getByRole('button', { name: 'Fixture accepted cast' }).click()
  await expect(page.locator('.projectile-freeze img')).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.getByRole('button', { name: 'Fixture combo' }).click()
  await expect(page.locator('.unit-sweep')).toHaveCount(2)
  await expect(page.locator('.battle-announcements')).toContainText('COMBO')
  await page.getByRole('button', { name: 'Fixture wrong number' }).click()
  await expect(grid.locator('.invalid')).toHaveCount(1)
  await expect(grid.locator('.invalid')).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Fixture incoming hit' }).click()
  await expect(page.locator('.light-shake')).toHaveCount(0)
  await expect(page.locator('.visual-impact').last()).toHaveCSS('animation-name','none')
  await expect(page.locator('.impact-particles')).toHaveCount(0)
})

test('Audio decodes local assets after interaction, preferences persist, and mute stops playback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tests/fixtures/room-harness.html?view=battle')
  await page.getByRole('button', { name: 'Fixture sound settings' }).click()
  const sheet = await page.getByRole('dialog').boundingBox()
  expect(sheet!.width).toBe(390); expect(Math.round(sheet!.y+sheet!.height)).toBe(844)
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => entry.name.endsWith('.wav')).length)).toBe(30)
  const decoded = await page.evaluate(async () => {
    const context = new AudioContext()
    // Fetch URLs from the actual preloaded registry to validate the browser codec path.
    const urls = performance.getEntriesByType('resource').filter((entry) => entry.name.endsWith('.wav')).map((entry) => entry.name)
    const durations = await Promise.all(urls.map(async (url) => (await context.decodeAudioData(await fetch(url).then((r) => r.arrayBuffer()))).duration))
    await context.close(); return durations
  })
  expect(decoded).toHaveLength(30); expect(decoded.every((n) => n > 0)).toBe(true)
  await page.getByLabel('Countdown sounds', { exact: true }).uncheck()
  await page.getByLabel('Reduce motion', { exact: true }).check()
  await page.getByLabel('Game sound', { exact: true }).uncheck()
  await expect(page.getByRole('button', { name: 'PREVIEW SOUND' })).toBeDisabled()
  await page.reload(); await page.getByRole('button', { name: 'Fixture sound settings' }).click()
  await expect(page.getByLabel('Game sound', { exact: true })).not.toBeChecked()
  await expect(page.getByLabel('Countdown sounds', { exact: true })).not.toBeChecked()
  await expect(page.getByLabel('Reduce motion', { exact: true })).toBeChecked()
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion','true')
})

test('Timer urgency follows authoritative time and waits at zero for a server result', async ({ page }) => {
  await page.goto('/tests/fixtures/room-harness.html?view=battle&remaining=30500')
  await expect(page.locator('.race-clock')).toHaveClass(/timer-normal/)
  await expect(page.locator('.race-clock')).toHaveClass(/timer-warning/)
  await page.goto('/tests/fixtures/room-harness.html?view=battle&remaining=10500')
  await expect(page.locator('.race-clock')).toHaveClass(/timer-danger/)
  await expect(page.locator('.race-clock')).toContainText('10 SECONDS LEFT')
  await page.goto('/tests/fixtures/room-harness.html?view=battle&remaining=5500')
  await expect(page.locator('.race-clock')).toHaveClass(/timer-critical/)
  await page.goto('/tests/fixtures/room-harness.html?view=battle&remaining=100')
  await expect(page.getByRole('grid', { name: 'Sudoku puzzle', exact: true })).toHaveAttribute('aria-disabled','true')
  await expect(page.locator('.race-clock')).toContainText('SERVER IS CONFIRMING')
  await expect(page.getByRole('heading', { name: 'YOU WIN!' })).toHaveCount(0)
})

test('Room confirmation submits the current match ID and renders the authoritative series winner', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let current: RoomSnapshot | null = null
  let forfeited: Record<string,unknown> | null = null
  await page.route('**/rest/v1/rpc/suduel_command', async (route) => {
    const body = route.request().postDataJSON() as { p_command: string; p_payload: Record<string,unknown>; p_action_id: string }
    current ??= await page.evaluate(() => (window as unknown as { __suduelFixtureSnapshot: RoomSnapshot }).__suduelFixtureSnapshot)
    if (body.p_command === 'move') {
      // Realtime may already have supplied a newer board; keep the private rejection cue.
      await route.fulfill({ json: { ...current, cursor: current.cursor-1, action: { id: body.p_action_id, cell: body.p_payload.cell, rejected: true, message: 'Conflicting number.' } } })
      return
    }
    if (body.p_command === 'forfeit') {
      forfeited = body.p_payload
      current.match!.status = 'finished'; current.match!.outcome = 'forfeit'; current.match!.completed_at = new Date().toISOString(); current.match!.winner_id = current.players[1].user_id
      current.battle!.series.status = 'finished'; current.battle!.series.winner_id = current.players[1].user_id; current.battle!.series.outcome = 'forfeit'
    }
    current.server_now = new Date().toISOString(); current.cursor++
    await route.fulfill({ json: current })
  })
  await page.goto('/tests/fixtures/room-harness.html?view=room-page')
  await expect(page.getByRole('grid', { name: 'Sudoku puzzle', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.getByRole('button', { name: 'Match menu', exact: true }).click()
  await page.getByRole('button', { name: 'SKILL GUIDE', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('ATTACK ARSENAL')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('grid', { name: 'Sudoku puzzle', exact: true }).getByRole('button').nth(0).focus()
  await page.keyboard.press('9')
  await expect(page.getByRole('grid', { name: 'Sudoku puzzle', exact: true }).locator('.invalid')).toHaveCount(1)
  await expect(page.getByRole('grid', { name: 'Sudoku puzzle', exact: true }).locator('.invalid')).toHaveCount(0)
  await page.getByRole('button', { name: 'Leave Battle series', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'FORFEIT', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'NEXT TIME IS YOURS.' })).toBeVisible()
  expect(forfeited).toMatchObject({ code: 'A1B2C3D4', match_id: expect.any(String) })
  expect(forfeited!.match_id).toBe(current!.match!.id)
})
