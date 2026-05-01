import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'https://find-your-club-seven.vercel.app',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
  },
  reporter: [['html', { open: 'never' }], ['list']],
});
