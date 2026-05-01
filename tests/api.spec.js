import { test, expect } from '@playwright/test';

const BASE = 'https://find-your-club-seven.vercel.app';

test.describe('API Tests', () => {

  test('/api/clubs returns club recommendations', async ({ request }) => {
    const res = await request.post(`${BASE}/api/clubs`, {
      data: {
        school: 'Stone Bridge High School',
        prompt: `A high school freshman at "Stone Bridge High School" is interested in becoming a Marketing Manager.
Recommend the TOP 5 clubs ranked by importance. Format as JSON only:
{"school_note":"note","clubs":[{"name":"Club","priority":"HIGH","why":"reason","url":null}]}`
      }
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('text');
    expect(body.text.length).toBeGreaterThan(0);
  });

  test('/api/clubs rejects missing prompt', async ({ request }) => {
    const res = await request.post(`${BASE}/api/clubs`, {
      data: { school: 'Stone Bridge High School' }
    });
    expect(res.status()).toBe(400);
  });

  test('/api/clubs rejects GET requests', async ({ request }) => {
    const res = await request.get(`${BASE}/api/clubs`);
    expect(res.status()).toBe(405);
  });

  test('/api/podcast returns a script', async ({ request }) => {
    const res = await request.post(`${BASE}/api/podcast`, {
      data: {
        school: 'Stone Bridge High School',
        careers: 'Marketing Manager',
        clubs: [
          { name: 'FBLA', priority: 'HIGH', why: 'Builds business skills' },
          { name: 'Debate Club', priority: 'HIGH', why: 'Builds communication skills' },
          { name: 'Key Club', priority: 'MEDIUM', why: 'Community service leadership' }
        ]
      }
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('script');
    expect(body.script.length).toBeGreaterThan(100);
  });

  test('/api/podcast rejects missing data', async ({ request }) => {
    const res = await request.post(`${BASE}/api/podcast`, {
      data: { school: 'Stone Bridge High School' }
    });
    expect(res.status()).toBe(400);
  });

});
