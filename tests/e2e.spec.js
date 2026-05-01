import { test, expect } from '@playwright/test';

test.describe('End-to-End Quiz Flow', () => {

  test('welcome screen loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero h1')).toBeVisible();
    await expect(page.locator('text=Get Started')).toBeVisible();
  });

  test('Get Started button navigates to quiz', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');
    await expect(page.locator('.question-card')).toBeVisible();
  });

  test('quiz completes all 5 questions', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');

    for (let i = 0; i < 5; i++) {
      await expect(page.locator('.question-card')).toBeVisible();
      await page.locator('.option').first().click();
      await page.click('#nextBtn');
    }

    // Should reach career selection screen
    await expect(page.locator('.jobs-grid')).toBeVisible();
  });

  test('career selection and school search', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');

    // Answer all questions
    for (let i = 0; i < 5; i++) {
      await page.locator('.option').first().click();
      await page.click('#nextBtn');
    }

    // Select first career
    await page.locator('.job-card').first().click();
    await page.click('#jobsNextBtn');

    // Should reach school search screen
    await expect(page.locator('#schoolInput')).toBeVisible();
  });

  test('school search returns results', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');

    for (let i = 0; i < 5; i++) {
      await page.locator('.option').first().click();
      await page.click('#nextBtn');
    }

    await page.locator('.job-card').first().click();
    await page.click('#jobsNextBtn');

    await page.fill('#schoolInput', 'Stone Bridge');
    await page.waitForSelector('.school-dropdown.open', { timeout: 5000 });
    await expect(page.locator('.school-option').first()).toBeVisible();
  });

});
