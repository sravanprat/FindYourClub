import { test, expect } from '@playwright/test';

const BASE = 'https://find-your-club-seven.vercel.app';

test.describe('API Tests', () => {

  test('/api/orchestrate returns club recommendations', async ({ request }) => {
    const res = await request.post(`${BASE}/api/orchestrate`, {
      data: { school: 'Stone Bridge High School', careers: 'Marketing Manager' },
      timeout: 30000
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('clubs');
    expect(Array.isArray(body.clubs.clubs)).toBe(true);
    expect(body.clubs.clubs.length).toBeGreaterThan(0);
    const club = body.clubs.clubs[0];
    expect(club).toHaveProperty('name');
    expect(club).toHaveProperty('priority');
    expect(club).toHaveProperty('why');
  });

  test('/api/orchestrate includes critique agent scores', async ({ request }) => {
    const res = await request.post(`${BASE}/api/orchestrate`, {
      data: { school: 'Stone Bridge High School', careers: 'Software Engineer' },
      timeout: 45000
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.clubs).toHaveProperty('overall_quality');
    expect(body.clubs).toHaveProperty('critique_summary');
    expect(typeof body.clubs.overall_quality).toBe('number');
    expect(body.clubs.overall_quality).toBeGreaterThan(0);
    expect(body.clubs.overall_quality).toBeLessThanOrEqual(10);
    // Each club should have a score and critique from Agent 4
    const club = body.clubs.clubs[0];
    expect(club).toHaveProperty('score');
    expect(club).toHaveProperty('critique');
    expect(typeof club.score).toBe('number');
  });

  test('/api/orchestrate refines with feedback', async ({ request }) => {
    const res = await request.post(`${BASE}/api/orchestrate`, {
      data: {
        school: 'Stone Bridge High School',
        careers: 'Software Engineer',
        feedback: {
          liked: ['Computer Science Club', 'Robotics Club'],
          disliked: ['Drama Club']
        }
      },
      timeout: 30000
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('clubs');
    expect(Array.isArray(body.clubs.clubs)).toBe(true);
    expect(body.clubs.clubs.length).toBeGreaterThan(0);
    // Disliked club should not appear in refined results
    const names = body.clubs.clubs.map(c => c.name.toLowerCase());
    expect(names).not.toContain('drama club');
  });

  test('/api/orchestrate rejects missing fields', async ({ request }) => {
    const res = await request.post(`${BASE}/api/orchestrate`, {
      data: { school: 'Stone Bridge High School' }
    });
    expect(res.status()).toBe(400);
  });

  test('/api/orchestrate rejects GET requests', async ({ request }) => {
    const res = await request.get(`${BASE}/api/orchestrate`);
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
