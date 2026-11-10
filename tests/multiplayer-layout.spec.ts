import { expect, test } from '@playwright/test'

for (const width of [390, 768, 1024, 1440]) {
  test(`multiplayer UI fixtures fit ${width}px; these are not live multiplayer tests`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    for (const view of ['setup', 'lobby', 'race', 'results']) {
      await page.goto(`/tests/fixtures/room-harness.html?view=${view}`)
      await expect(page.getByRole('button').first()).toBeVisible()
      if (view === 'race') await expect(page.getByRole('grid')).toBeVisible()
      const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }))
      expect(size.scroll, `${view} overflows at ${width}px`).toBeLessThanOrEqual(size.width)
      if (width === 390 || width === 1440) {
        await page.evaluate(() => document.fonts.ready)
        await page.screenshot({ path: testInfo.outputPath(`${view}-${width}.png`), fullPage: true })
      }
    }
    expect(errors).toEqual([])
  })
}
