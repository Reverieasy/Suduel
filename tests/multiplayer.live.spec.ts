import { expect as baseExpect, test, type Page } from '@playwright/test'
import { DIGITS, sameUnit } from '../src/features/sudoku/engine'

const accountA = { email: process.env.SUDUEL_QA_EMAIL_A, password: process.env.SUDUEL_QA_PASSWORD_A }
const expect = baseExpect.configure({ timeout: 15000 })
const accountB = { email: process.env.SUDUEL_QA_EMAIL_B, password: process.env.SUDUEL_QA_PASSWORD_B }
const configured = !!accountA.email && !!accountA.password && !!accountB.email && !!accountB.password
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

function solve(input: number[]): number[] {
  const board = [...input]
  function visit(): boolean {
    const index = board.indexOf(0)
    if (index < 0) return true
    for (const digit of DIGITS) {
      if (board.some((n, i) => n === digit && sameUnit(index, i))) continue
      board[index] = digit
      if (visit()) return true
    }
    board[index] = 0
    return false
  }
  if (!visit()) throw new Error('The server puzzle has no valid solution')
  return board
}

async function login(page: Page, account: typeof accountA) {
  await page.goto('/login')
  await page.getByLabel('EMAIL ADDRESS').fill(account.email!)
  await page.getByLabel('PASSWORD', { exact: true }).fill(account.password!)
  await page.getByRole('button', { name: 'LOG IN', exact: true }).click()
  await expect(page).toHaveURL('/play')
}

test.describe('LIVE Supabase: two pre-verified real accounts', () => {
  test.skip(!configured, 'User manually verifies two accounts, then supplies credentials through process environment.')
  test('private race, progress privacy, completion, rematch and recovery', async ({ browser, baseURL }) => {
    test.setTimeout(180000)
    const contextA = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } })
    const contextB = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } })
    const a = await contextA.newPage(), b = await contextB.newPage()
    try {
      await Promise.all([login(a, accountA), login(b, accountB)])
      await a.goto('/rooms/new')
      await a.getByRole('button', { name: 'CREATE ROOM', exact: true }).click()
      await expect(a).toHaveURL(/\/room\/[A-F0-9]{8}$/)
      const path = new URL(a.url()).pathname
      await b.goto(path)
      await expect(a.getByRole('heading', { name: 'PLAYERS / 2 OF 2' })).toBeVisible()
      await Promise.all([a.getByRole('button', { name: 'I’M READY' }).click(), b.getByRole('button', { name: 'I’M READY' }).click()])
      await expect(a.getByRole('button', { name: 'START MATCH', exact: true })).toBeEnabled()
      await a.getByRole('button', { name: 'START MATCH', exact: true }).click()
      const gridA = a.getByRole('grid'), gridB = b.getByRole('grid')
      await expect(gridA).toBeVisible(); await expect(gridB).toBeVisible()
      const cluesA = await gridA.getByRole('button').evaluateAll((nodes) => nodes.map((node) => Number(node.textContent?.trim() || 0)))
      const cluesB = await gridB.getByRole('button').evaluateAll((nodes) => nodes.map((node) => Number(node.textContent?.trim() || 0)))
      expect(cluesA).toEqual(cluesB)
      await expect(gridA).toHaveAttribute('aria-disabled', 'false')
      await expect(gridB).toHaveAttribute('aria-disabled', 'false')
      const solution = solve(cluesA), first = cluesA.indexOf(0)
      await gridA.getByRole('button').nth(first).click(); await a.keyboard.press(String(solution[first]))
      await expect(gridA.getByRole('button').nth(first)).toHaveText(String(solution[first]))
      await expect(b.locator('.opponent-compact strong')).not.toHaveText('0%')
      // The opponent-facing board contains only immutable clues, no private entries.
      expect(await b.locator('.opponent-board > span').nth(first).textContent()).toBe('')
      await a.reload()
      await expect(a.getByRole('grid').getByRole('button').nth(first)).toHaveText(String(solution[first]))
      await contextB.setOffline(true)
      await expect(b.getByText('RECONNECTING · CLOCK CONTINUES')).toBeVisible()
      await contextB.setOffline(false)
      await expect(b.locator('.room-connection')).not.toContainText('RECONNECTING')
      for (let i = 0; i < 81; i++) {
        if (cluesA[i] || i === first) continue
        await expect(a.getByRole('grid')).toHaveAttribute('aria-disabled', 'false')
        const cell = a.getByRole('grid').getByRole('button').nth(i)
        await cell.click(); await a.keyboard.press(String(solution[i])); await expect(cell).toHaveText(String(solution[i]))
      }
      await expect(a.getByRole('heading', { name: 'YOU WIN!' })).toBeVisible()
      await expect(b.getByRole('heading', { name: 'NEXT TIME IS YOURS.' })).toBeVisible()
      await a.getByRole('button', { name: 'REQUEST REMATCH' }).click()
      await expect(b.getByRole('button', { name: 'ACCEPT REMATCH' })).toBeVisible()
      await b.getByRole('button', { name: 'ACCEPT REMATCH' }).click()
      await expect(a.getByRole('grid')).toBeVisible(); await expect(b.getByRole('grid')).toBeVisible()
      const fresh = await a.getByRole('grid').getByRole('button').evaluateAll((nodes) => nodes.map((node) => Number(node.textContent?.trim() || 0)))
      expect(fresh).not.toEqual(cluesA)
      await a.getByRole('button', { name: 'FORFEIT MATCH' }).click()
      await a.getByRole('dialog').getByRole('button', { name: 'FORFEIT', exact: true }).click()
      await expect(b.getByRole('heading', { name: 'YOU WIN!' })).toBeVisible()
      await a.goto('/profile')
      await expect.poll(() => a.locator('.match-history li').count()).toBeGreaterThanOrEqual(2)
    } finally { await contextA.close(); await contextB.close() }
  })
})
