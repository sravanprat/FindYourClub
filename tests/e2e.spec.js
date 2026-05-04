import { test, expect } from '@playwright/test';

const MOCK_CLUBS = {
  school_note: 'Stone Bridge High School has a strong STEM and business program.',
  clubs: [
    { name: 'FBLA', priority: 'HIGH', why: 'Builds business and leadership skills directly relevant to marketing.', url: null },
    { name: 'Debate Club', priority: 'HIGH', why: 'Develops persuasion and communication skills essential for marketing.', url: null },
    { name: 'Computer Science Club', priority: 'HIGH', why: 'Digital marketing requires technical literacy.', url: null },
    { name: 'Yearbook', priority: 'MEDIUM', why: 'Hands-on experience with design and storytelling.', url: null },
    { name: 'Key Club', priority: 'MEDIUM', why: 'Community service leadership looks great on applications.', url: null },
  ]
};

// Helper: mock the orchestrate API and navigate through quiz to results
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

// ── WELCOME & QUIZ ─────────────────────────────────────────────

test.describe('Welcome & Quiz', () => {

  test('welcome screen loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero h1')).toBeVisible();
    await expect(page.locator('text=Get Started')).toBeVisible();
  });

  test('Get Started navigates to quiz', async ({ page }) => {
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
    await expect(page.locator('.jobs-grid')).toBeVisible();
  });

  test('career selection leads to school screen', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');
    for (let i = 0; i < 5; i++) {
      await page.locator('.option').first().click();
      await page.click('#nextBtn');
    }
    await page.locator('.job-card').first().click();
    await page.click('#jobsNextBtn');
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

// ── RESULTS (desktop) ──────────────────────────────────────────

test.describe('Results — Desktop', () => {

  test('club cards render with thumb buttons', async ({ page }) => {
    await goToResults(page);
    const cards = page.locator('.club-card');
    await expect(cards).toHaveCount(MOCK_CLUBS.clubs.length);
    await expect(page.locator('.thumb-btn').first()).toBeVisible();
  });

  test('thumbs up highlights button', async ({ page }) => {
    await goToResults(page);
    const upBtn = page.locator('#up_0');
    await upBtn.click();
    await expect(upBtn).toHaveClass(/up/);
  });

  test('thumbs down highlights button', async ({ page }) => {
    await goToResults(page);
    const downBtn = page.locator('#down_0');
    await downBtn.click();
    await expect(downBtn).toHaveClass(/down/);
  });

  test('rating a club shows the refine bar', async ({ page }) => {
    await goToResults(page);
    await expect(page.locator('.refine-bar')).not.toHaveClass(/visible/);
    await page.locator('#up_0').click();
    await expect(page.locator('.refine-bar')).toHaveClass(/visible/);
  });

  test('unrating a club hides the refine bar when no ratings remain', async ({ page }) => {
    await goToResults(page);
    await page.locator('#up_0').click();
    await expect(page.locator('.refine-bar')).toHaveClass(/visible/);
    await page.locator('#up_0').click(); // toggle off
    await expect(page.locator('.refine-bar')).not.toHaveClass(/visible/);
  });

  test('refine bar shows correct rating count', async ({ page }) => {
    await goToResults(page);
    await page.locator('#up_0').click();
    await page.locator('#down_1').click();
    const text = await page.locator('#refineBarText').innerText();
    expect(text).toContain('👍');
    expect(text).toContain('👎');
  });

  test('action bar shows all 3 actions', async ({ page }) => {
    await goToResults(page);
    await expect(page.locator('.action-bar')).toBeVisible();
    const cards = page.locator('.action-card');
    await expect(cards).toHaveCount(3);
  });

  test('infographic modal opens and closes', async ({ page }) => {
    await goToResults(page);
    await page.locator('.action-card').nth(1).click();
    await expect(page.locator('.modal-overlay')).toHaveClass(/open/);
    await page.locator('.modal-close').click();
    await expect(page.locator('.modal-overlay')).not.toHaveClass(/open/);
  });

});

// ── RESULTS (mobile) ──────────────────────────────────────────

test.describe('Results — Mobile (iPhone 14)', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('club cards render on mobile', async ({ page }) => {
    await goToResults(page);
    await expect(page.locator('.club-card').first()).toBeVisible();
  });

  test('thumb buttons are visible and tappable on mobile', async ({ page }) => {
    await goToResults(page);
    const upBtn = page.locator('#up_0');
    await expect(upBtn).toBeVisible();
    await upBtn.click();
    await expect(upBtn).toHaveClass(/up/);
  });

  test('refine bar appears on mobile after rating', async ({ page }) => {
    await goToResults(page);
    await page.locator('#up_0').click();
    await expect(page.locator('.refine-bar')).toHaveClass(/visible/);
    const bar = page.locator('.refine-bar');
    const box = await bar.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(300);
  });

  test('action bar is visible on mobile', async ({ page }) => {
    await goToResults(page);
    await expect(page.locator('.action-bar')).toBeVisible();
  });

  test('infographic modal fits mobile screen', async ({ page }) => {
    await goToResults(page);
    await page.locator('.action-card').nth(1).click();
    const modal = page.locator('.modal-box');
    await expect(modal).toBeVisible();
    const box = await modal.boundingBox();
    expect(box.width).toBeLessThanOrEqual(390);
  });

});
