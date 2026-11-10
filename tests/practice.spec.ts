import { expect, test } from '@playwright/test'
import { DIGITS, sameUnit } from '../src/features/sudoku/engine'

function solve(input: number[]): number[] {
  const board = [...input]
  function visit(): boolean {
    const i = board.indexOf(0)
    if (i === -1) return true
    for (const digit of DIGITS) {
      if (board.some((n, j) => n === digit && sameUnit(i, j))) continue
      board[i] = digit
      if (visit()) return true
    }
    board[i] = 0
    return false
  }
  if (!visit()) throw new Error('The generated board is not solvable')
  return board
}

test('guest can use notes, erase, undo, pause, restart, solve and persist a best', async ({ page }) => {
  await page.goto('/practice')
  const board = page.getByRole('grid', { name: 'Sudoku puzzle' })
  await expect(board).toBeVisible()
  const cells = board.getByRole('button')
  const clues = await cells.evaluateAll((elements) => elements.map((e) => Number(e.textContent?.trim() || 0)))
  const solution = solve(clues)
  const empty = clues.indexOf(0)
  await cells.nth(empty).click()
  await page.keyboard.press('n')
  await page.keyboard.press('3')
  await expect(cells.nth(empty)).toHaveAccessibleName(/notes 3/)
  await page.keyboard.press('n')
  const wrong = solution[empty] % 9 + 1
  await page.keyboard.press(String(wrong))
  await expect(cells.nth(empty)).toHaveAccessibleName(/incorrect/)
  await page.getByRole('button', { name: /Undo/ }).click()
  await expect(cells.nth(empty)).toHaveAccessibleName(/notes 3/)
  await page.getByRole('button', { name: /Erase/ }).click()
  await expect(cells.nth(empty)).toHaveAccessibleName(/empty$/)
  const fixed = clues.findIndex(Boolean)
  await cells.nth(fixed).click()
  await page.keyboard.press('9')
  await expect(cells.nth(fixed)).toHaveAccessibleName(new RegExp(`${clues[fixed]}, fixed clue`))
  await page.getByRole('button', { name: 'Pause game' }).click()
  const pausedTime = await page.getByRole('timer').textContent()
  await expect(page.getByRole('button', { name: 'RESUME GAME', exact: true })).toBeVisible()
  await page.waitForTimeout(1150)
  await expect(page.getByRole('timer')).toHaveText(pausedTime!)
  await page.getByRole('button', { name: 'RESUME GAME', exact: true }).click()
  await page.getByRole('button', { name: 'RESTART PUZZLE' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'RESTART', exact: true }).click()
  for (let i = 0; i < 81; i++) {
    if (clues[i]) continue
    await cells.nth(i).click()
    await page.keyboard.press(String(solution[i]))
  }
  await expect(page.getByRole('dialog')).toContainText('GRID COMPLETE. WELL PLAYED.')
  await expect(page.getByRole('dialog')).toContainText('Your result is recorded')
  await page.getByRole('button', { name: 'VIEW BOARD' }).click()
  await expect(page.getByLabel('Puzzle progress')).toHaveAttribute('value', String(clues.filter((n) => n === 0).length))
  await page.reload()
  await expect(page.locator('.best-panel')).toContainText('1 PUZZLE COMPLETED')
  await expect(page.locator('.best-panel')).not.toContainText('SET YOUR FIRST')
})

test('difficulty, new puzzle confirmation, hint assistance and route pause work', async ({ page }) => {
  await page.goto('/practice')
  await expect(page.getByRole('grid')).toBeVisible()
  await page.getByLabel('NEXT PUZZLE DIFFICULTY').selectOption('hard')
  await page.getByRole('button', { name: 'NEW PUZZLE', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('new hard puzzle')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'NEW PUZZLE', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'NEW PUZZLE' }).click()
  await expect(page.locator('.practice-stats h2')).toHaveText('HARD PUZZLE')
  await page.getByRole('button', { name: 'GET A HINT' }).click()
  await expect(page.locator('.mini-stats > div').nth(1)).toContainText('1')
  await page.getByRole('link', { name: 'ALL MODES' }).click()
  await page.getByRole('link', { name: 'START PRACTICING' }).click()
  await expect(page.getByRole('button', { name: 'RESUME GAME', exact: true })).toBeVisible()
})

for (const width of [390, 768, 1024, 1440]) {
  test(`all public screens fit ${width}px and load assets without browser errors`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    for (const path of ['/', '/play', '/practice', '/how-to-play', '/features', '/login', '/register', '/missing']) {
      await page.goto(path)
      await expect(page.locator('h1')).toBeVisible()
      if (path === '/practice') await expect(page.getByRole('grid')).toBeVisible()
      const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }))
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width)
      const brokenImages = await page.locator('img').evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src))
      expect(brokenImages).toEqual([])
      if ((width === 390 || width === 1440) && (path === '/' || path === '/practice')) {
        await page.evaluate(() => document.fonts.ready)
        await page.screenshot({ path: testInfo.outputPath(`${path === '/' ? 'landing' : 'practice'}-${width}.png`), fullPage: true })
      }
    }
    expect(errors).toEqual([])
  })
}

test('mobile navigation and real registration fields work without submitting credentials', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'How to Play' }).click()
  await expect(page).toHaveURL('/how-to-play')
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toHaveCount(0)
  await page.goto('/register')
  await expect(page.getByLabel('USERNAME')).toBeEnabled()
  await expect(page.getByLabel('EMAIL ADDRESS')).toBeEnabled()
  await expect(page.getByLabel('CONFIRM PASSWORD')).toBeEnabled()
  await expect(page.getByRole('button', { name: 'CREATE ACCOUNT', exact: true })).toBeEnabled()
  await page.getByRole('link', { name: 'PLAY AS A GUEST' }).click()
  await expect(page.getByRole('grid')).toBeVisible()
})
