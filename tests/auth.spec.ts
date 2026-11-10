import { expect, test } from '@playwright/test'

test('unverified guests are redirected to login with the invitation preserved', async ({ page }) => {
  await page.goto('/room/A1B2C3D4')
  await expect(page).toHaveURL(/\/login\?next=%2Froom%2FA1B2C3D4/)
  await expect(page.getByRole('heading', { name: 'WELCOME BACK' })).toBeVisible()
  await page.getByRole('link', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL(/\/register\?next=%2Froom%2FA1B2C3D4/)
})

test('registration rejects mismatching passwords locally', async ({ page }) => {
  let signups = 0
  page.on('request', (request) => { if (request.url().includes('/auth/v1/signup')) signups++ })
  await page.goto('/register')
  await page.getByLabel('USERNAME').fill('TestPlayer')
  await page.getByLabel('EMAIL ADDRESS').fill(`${crypto.randomUUID()}@test.example`)
  await page.getByLabel('PASSWORD', { exact: true }).fill('ValidPassword42')
  await page.getByLabel('CONFIRM PASSWORD').fill('DifferentPassword42')
  await page.getByRole('button', { name: 'CREATE ACCOUNT', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('do not match')
  expect(signups).toBe(0)
})

test('password recovery and callback routes expose usable states', async ({ page }) => {
  await page.goto('/forgot-password')
  await expect(page.getByRole('heading', { name: 'FORGOT PASSWORD?' })).toBeVisible()
  await expect(page.getByLabel('EMAIL ADDRESS')).toBeEnabled()
  await page.goto('/reset-password')
  await expect(page.getByRole('status')).toContainText('Open the reset link')
  await expect(page.getByRole('button', { name: 'UPDATE PASSWORD' })).toBeDisabled()
  await page.goto('/auth/callback?error_description=This%20link%20expired')
  await expect(page.getByText('This link expired')).toBeVisible()
})
