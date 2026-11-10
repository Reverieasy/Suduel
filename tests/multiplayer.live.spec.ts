import { expect as baseExpect, test, type Page } from '@playwright/test'
import { DIGITS, sameUnit } from '../src/features/sudoku/engine'
import type { RoomSnapshot } from '../src/features/multiplayer/types'

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
  test.describe.configure({ mode: 'default' })
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

  test('Battle skills, recovery, best-of-three and series rematch', async ({ browser, baseURL }) => {
    test.setTimeout(360000)
    const contextA = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } })
    const contextB = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } })
    const a = await contextA.newPage(), b = await contextB.newPage()
    async function fill(page: Page, clues: number[], solution: number[], from = 0, until = 81) {
      for (let i = from; i < until; i++) {
        if (clues[i]) continue
        const grid = page.getByRole('grid'), cell = grid.getByRole('button').nth(i)
        await expect(grid).toHaveAttribute('aria-disabled','false')
        await cell.click(); await page.keyboard.press(String(solution[i])); await expect(cell).toHaveText(String(solution[i]))
      }
    }
    async function cast(page: Page, skill: string): Promise<RoomSnapshot> {
      const [response] = await Promise.all([
        page.waitForResponse((response) => response.url().includes('/rpc/suduel_command') && response.request().postDataJSON()?.p_command === 'cast'),
        page.getByRole('button', { name: new RegExp(`^Cast ${skill}\\.`) }).click(),
      ])
      expect(response.ok()).toBe(true)
      return await response.json() as RoomSnapshot
    }
    const read = (page: Page) => page.getByRole('grid').getByRole('button').evaluateAll((nodes) => nodes.map((node) => Number(node.textContent?.trim() || 0)))
    try {
      await Promise.all([login(a,accountA),login(b,accountB)])
      await a.goto('/rooms/new?mode=battle'); await a.getByRole('button', { name: 'CREATE ROOM', exact: true }).click()
      await expect(a).toHaveURL(/\/room\/[A-F0-9]{8}$/); await b.goto(new URL(a.url()).pathname)
      await expect(a.getByRole('heading', { name: 'PLAYERS / 2 OF 2' })).toBeVisible()
      await Promise.all([a.getByRole('button', { name: 'I’M READY' }).click(),b.getByRole('button', { name: 'I’M READY' }).click()])
      await a.getByRole('button', { name: 'START MATCH', exact: true }).click()
      await expect(a.getByRole('grid')).toBeVisible(); await expect(b.getByRole('grid')).toBeVisible()
      const clues = await read(a), solution = solve(clues)
      expect(await read(b)).toEqual(clues)
      await Promise.all([fill(a,clues,solution,0,27),fill(b,clues,solution,0,27)])
      await expect(a.getByLabel('Your energy', { exact: true })).toHaveText('5 / 5')
      await expect(b.getByLabel('Your energy', { exact: true })).toHaveText('5 / 5')
      const shield = await cast(b,'shield')
      expect(shield.battle!.effects.some((e) => e.skill === 'shield')).toBe(true)
      const blocked = await cast(a,'fog')
      expect(blocked.action?.blocked).toBe(true)
      await expect(b.locator('.battle-announcements')).toContainText('ATTACK BLOCKED')
      expect(blocked.battle!.effects.some((e) => e.skill === 'fog')).toBe(false)
      const frozen = await cast(a,'freeze')
      const freeze = frozen.battle!.effects.find((e) => e.skill === 'freeze')!
      expect(Date.parse(freeze.expires_at)-Date.parse(freeze.starts_at)).toBe(1500)
      await expect(b.getByRole('grid')).toHaveAttribute('aria-disabled','true')
      await expect(b.getByRole('grid')).toHaveAttribute('aria-disabled','false')
      await expect(b.getByText('FREEZE IMMUNITY', { exact: true })).toBeVisible()
      const scrambled = await cast(a,'scramble'), permutation = scrambled.battle!.effects.find((e) => e.skill === 'scramble')!.keypad!
      await expect(b.locator('.number-pad button').first()).toHaveText(String(permutation[0]))
      expect(await b.locator('.number-pad button').allTextContents()).toEqual(permutation.map(String))
      const fogged = await cast(b,'fog'), fog = fogged.battle!.effects.find((e) => e.skill === 'fog')!
      expect(fog.region).toBeGreaterThanOrEqual(0); expect(fog.region).toBeLessThanOrEqual(8)
      await expect(a.getByRole('button', { name: /concealed by Fog/ })).toHaveCount(9)
      await a.reload(); await expect(a.getByRole('grid')).toBeVisible()
      await expect(a.getByLabel('Your energy', { exact: true })).toHaveText('0 / 5')
      await expect(a.locator('.visual-impact')).toHaveCount(0)
      await expect(a.locator('[data-effect=fog]')).toHaveCount(0)
      await expect(b.locator('.number-pad button').first()).toHaveText('1')
      await fill(a,clues,solution,27)
      await expect(a.getByRole('heading', { name: 'ROUND WON!' })).toBeVisible()
      await expect(b.getByRole('heading', { name: 'RIVAL TAKES THE ROUND' })).toBeVisible()
      await Promise.all([a.getByRole('button', { name: 'READY FOR NEXT ROUND' }).click(),b.getByRole('button', { name: 'READY FOR NEXT ROUND' }).click()])
      await a.getByRole('button', { name: 'START NEXT ROUND' }).click()
      await expect(a.getByRole('grid')).toBeVisible(); await expect(b.getByRole('grid')).toBeVisible()
      await expect(a.getByLabel('Your energy', { exact: true })).toHaveText('0 / 5')
      await expect(b.getByLabel('Your energy', { exact: true })).toHaveText('0 / 5')
      const fresh = await read(a); expect(fresh).not.toEqual(clues)
      await fill(a,fresh,solve(fresh))
      await expect(a.getByRole('heading', { name: 'YOU WIN!' })).toBeVisible()
      await expect(b.getByRole('heading', { name: 'NEXT TIME IS YOURS.' })).toBeVisible()
      await expect(a.locator('.result-score')).toContainText('2')
      await a.getByRole('button', { name: 'REQUEST REMATCH' }).click()
      await b.getByRole('button', { name: 'ACCEPT REMATCH' }).click()
      await expect(a.getByRole('grid')).toBeVisible()
      await expect(a.getByLabel('Your energy', { exact: true })).toHaveText('0 / 5')
      await a.getByRole('button', { name: 'FORFEIT SERIES' }).click()
      await a.getByRole('dialog').getByRole('button', { name: 'FORFEIT', exact: true }).click()
      await expect(b.getByRole('heading', { name: 'YOU WIN!' })).toBeVisible()
    } finally { await contextA.close(); await contextB.close() }
  })
})
