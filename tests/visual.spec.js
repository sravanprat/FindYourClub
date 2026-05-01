import { test, expect } from '@playwright/test';

test.describe('Visual Screenshots', () => {

  test('welcome screen screenshot', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero')).toBeVisible();
    await page.screenshot({ path: 'screenshots/welcome.png', fullPage: true });
  });

  test('quiz screen screenshot', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');
    await expect(page.locator('.question-card')).toBeVisible();
    await page.screenshot({ path: 'screenshots/quiz.png', fullPage: true });
  });

  test('career screen screenshot', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');

    for (let i = 0; i < 5; i++) {
      await page.locator('.option').first().click();
      await page.click('#nextBtn');
    }

    await expect(page.locator('.jobs-grid')).toBeVisible();
    await page.screenshot({ path: 'screenshots/careers.png', fullPage: true });
  });

  test('mobile welcome screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
    await page.goto('/');
    await expect(page.locator('.hero')).toBeVisible();
    await page.screenshot({ path: 'screenshots/mobile-welcome.png', fullPage: true });
  });

  test('mobile quiz screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.click('text=Get Started');
    await expect(page.locator('.question-card')).toBeVisible();
    await page.screenshot({ path: 'screenshots/mobile-quiz.png', fullPage: true });
  });

});
