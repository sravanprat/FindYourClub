import { test, expect } from '@playwright/test';

const MOCK_CLUBS = {
  school_note: 'Stone Bridge High School has a strong STEM and business program.',
  overall_quality: 8.7,
  critique_summary: 'Strong lineup with excellent alignment to both the school\'s STEM offerings and a marketing career path.',
  clubs: [
    { name: 'FBLA', priority: 'HIGH', why: 'Builds business and leadership skills directly relevant to marketing.', url: null, score: 9.2, critique: 'Exceptional fit — business fundamentals directly transfer to marketing roles.' },
    { name: 'Debate Club', priority: 'HIGH', why: 'Develops persuasion and communication skills essential for marketing.', url: null, score: 8.5, critique: 'Strong communication development; persuasion is core to marketing.' },
    { name: 'Computer Science Club', priority: 'HIGH', why: 'Digital marketing requires technical literacy.', url: null, score: 8.1, critique: 'Good fit for digital marketing track; builds technical fluency.' },
    { name: 'Yearbook', priority: 'MEDIUM', why: 'Hands-on experience with design and storytelling.', url: null, score: 7.4, critique: 'Solid creative experience; storytelling is valuable in content marketing.' },
    { name: 'Key Club', priority: 'MEDIUM', why: 'Community service leadership looks great on applications.', url: null, score: 6.8, critique: 'Moderate fit; leadership experience is useful but less career-specific.' },
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

// ── CRITIQUE AGENT ─────────────────────────────────────────────

test.describe('Critique Agent — Desktop', () => {

  test('critique banner renders with overall quality score', async ({ page }) => {
    await goToResults(page);
    await expect(page.locator('.critique-banner')).toBeVisible();
    const bannerText = await page.locator('.critique-banner').innerText();
    expect(bannerText).toContain('8.7');
  });

  test('critique banner shows summary text', async ({ page }) => {
    await goToResults(page);
    const bannerText = await page.locator('.critique-banner-text').innerText();
    expect(bannerText.length).toBeGreaterThan(10);
  });

  test('score badges render on club cards', async ({ page }) => {
    await goToResults(page);
    const badges = page.locator('.score-badge');
    // One badge per club + one in the critique banner
    await expect(badges).toHaveCount(MOCK_CLUBS.clubs.length + 1);
  });

  test('high-scoring club shows green badge', async ({ page }) => {
    await goToResults(page);
    // First club has score 9.2 → score-high
    const firstBadge = page.locator('.club-card').first().locator('.score-badge');
    await expect(firstBadge).toHaveClass(/score-high/);
    const text = await firstBadge.innerText();
    expect(text).toContain('9.2');
  });

  test('club critique text renders below each card', async ({ page }) => {
    await goToResults(page);
    const critiques = page.locator('.club-critique');
    await expect(critiques).toHaveCount(MOCK_CLUBS.clubs.length);
    const firstText = await critiques.first().innerText();
    expect(firstText.length).toBeGreaterThan(5);
  });

  test('clubs without scores render without badge', async ({ page }) => {
    await page.route('**/api/orchestrate', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clubs: {
            school_note: 'Test school.',
            clubs: [
              { name: 'Test Club', priority: 'HIGH', why: 'Good fit.', url: null }
            ]
          },
          searchLinks: []
        })
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
    // No score in data → no badge inside club card
    const cardBadges = page.locator('.club-card .score-badge');
    await expect(cardBadges).toHaveCount(0);
  });

});

// ── CRITIQUE AGENT (mobile) ────────────────────────────────────

test.describe('Critique Agent — Mobile (iPhone 14)', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('critique banner is visible on mobile', async ({ page }) => {
    await goToResults(page);
    await expect(page.locator('.critique-banner')).toBeVisible();
  });

  test('score badges are visible on mobile club cards', async ({ page }) => {
    await goToResults(page);
    const firstBadge = page.locator('.club-card').first().locator('.score-badge');
    await expect(firstBadge).toBeVisible();
  });

  test('club critique text is visible on mobile', async ({ page }) => {
    await goToResults(page);
    await expect(page.locator('.club-critique').first()).toBeVisible();
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
