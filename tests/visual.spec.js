import { test, expect } from '@playwright/test';

const MOCK_CLUBS = {
  school_note: 'Stone Bridge High School has strong STEM and business programs.',
  clubs: [
    { name: 'FBLA', priority: 'HIGH', why: 'Builds business and leadership skills.', url: null },
    { name: 'Debate Club', priority: 'HIGH', why: 'Develops communication and persuasion.', url: null },
    { name: 'Computer Science Club', priority: 'HIGH', why: 'Technical skills for digital marketing.', url: null },
    { name: 'Yearbook', priority: 'MEDIUM', why: 'Hands-on design and storytelling.', url: null },
    { name: 'Key Club', priority: 'MEDIUM', why: 'Community service leadership.', url: null },
  ]
};

async function goToResults(page) {
  await page.route('**/api/orchestrate', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ clubs: MOCK_CLUBS, searchLinks: [] })
    });
  });
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
  await page.locator('.school-option').first().click();
  await page.click('#schoolNextBtn');
  await page.waitForSelector('.club-card', { timeout: 15000 });
}

// ── DESKTOP ───────────────────────────────────────────────────

test.describe('Visual — Desktop (1280×800)', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('welcome screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero')).toBeVisible();
    await page.screenshot({ path: 'screenshots/desktop-welcome.png', fullPage: true });
  });

  test('quiz screen', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');
    await expect(page.locator('.question-card')).toBeVisible();
    await page.screenshot({ path: 'screenshots/desktop-quiz.png', fullPage: true });
  });

  test('careers screen', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');
    for (let i = 0; i < 5; i++) {
      await page.locator('.option').first().click();
      await page.click('#nextBtn');
    }
    await expect(page.locator('.jobs-grid')).toBeVisible();
    await page.screenshot({ path: 'screenshots/desktop-careers.png', fullPage: true });
  });

  test('results screen with clubs', async ({ page }) => {
    await goToResults(page);
    await page.screenshot({ path: 'screenshots/desktop-results.png', fullPage: true });
  });

  test('results screen with refine bar active', async ({ page }) => {
    await goToResults(page);
    await page.locator('#up_0').click();
    await page.locator('#down_1').click();
    await expect(page.locator('.refine-bar')).toHaveClass(/visible/);
    await page.screenshot({ path: 'screenshots/desktop-results-refine.png', fullPage: true });
  });

  test('infographic modal', async ({ page }) => {
    await goToResults(page);
    await page.locator('.action-card').nth(1).click();
    await expect(page.locator('.modal-overlay')).toHaveClass(/open/);
    await page.screenshot({ path: 'screenshots/desktop-infographic.png', fullPage: true });
  });

});

// ── MOBILE ────────────────────────────────────────────────────

test.describe('Visual — Mobile (390×844, iPhone 14)', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('welcome screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero')).toBeVisible();
    await page.screenshot({ path: 'screenshots/mobile-welcome.png', fullPage: true });
  });

  test('quiz screen', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');
    await expect(page.locator('.question-card')).toBeVisible();
    await page.screenshot({ path: 'screenshots/mobile-quiz.png', fullPage: true });
  });

  test('careers screen', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');
    for (let i = 0; i < 5; i++) {
      await page.locator('.option').first().click();
      await page.click('#nextBtn');
    }
    await expect(page.locator('.jobs-grid')).toBeVisible();
    await page.screenshot({ path: 'screenshots/mobile-careers.png', fullPage: true });
  });

  test('results screen with clubs', async ({ page }) => {
    await goToResults(page);
    await page.screenshot({ path: 'screenshots/mobile-results.png', fullPage: true });
  });

  test('results screen with refine bar active', async ({ page }) => {
    await goToResults(page);
    await page.locator('#up_0').click();
    await page.locator('#down_1').click();
    await expect(page.locator('.refine-bar')).toHaveClass(/visible/);
    await page.screenshot({ path: 'screenshots/mobile-results-refine.png', fullPage: true });
  });

  test('infographic modal on mobile', async ({ page }) => {
    await goToResults(page);
    await page.locator('.action-card').nth(1).click();
    await expect(page.locator('.modal-overlay')).toHaveClass(/open/);
    await page.screenshot({ path: 'screenshots/mobile-infographic.png', fullPage: true });
  });

});
