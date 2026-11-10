import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium'), trace: 'retain-on-failure' },
  webServer: { command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev -- --host 127.0.0.1 --strictPort`, url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
})
