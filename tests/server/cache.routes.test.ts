import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bcpa-cache-test-'));
process.env.NODE_ENV = 'test';
process.env.CACHE_DIR = tmpRoot;
process.env.LOG_LEVEL = 'error';
process.env.CACHE_BUILD_TOKEN = 'b'.repeat(32);

vi.mock('firebase-admin', () => ({
  default: {
    apps: [{}],
    auth: () => ({ verifyIdToken: vi.fn() }),
    credential: { cert: vi.fn(), applicationDefault: vi.fn() },
    initializeApp: vi.fn(),
  },
}));
vi.mock('../../src-server/middleware/auth', () => ({
  verifyToken: (req: unknown, _res: unknown, next: () => void) => {
    (req as { user?: unknown }).user = { uid: 'test-user' };
    next();
  },
}));

vi.mock('../../src-server/services/racerScraper', () => ({
  scrapeRacer: vi.fn(async (personId: string) => ({
    raceCount: 3,
    points: 25,
    roadAndTrackPoints: 25,
    cyclocrossPoints: 0,
    roadAndTrackRaceCount: 3,
    cyclocrossRaceCount: 0,
    category: '3rd',
    name: `Test Rider ${personId}`,
    club: 'Test Club',
    clubId: '999',
    regionalPoints: 20,
    nationalPoints: 5,
    roadRegionalPoints: 20,
    roadNationalPoints: 5,
    cxRegionalPoints: 0,
    cxNationalPoints: 0,
    _diagnostics: {
      html_length: 1234,
      page_title: 'Points',
      cloudflare_seen: false,
      cloudflare_resolved: false,
      name_extracted: true,
      club_extracted: true,
      category_extracted: true,
      parse: { warnings: [] },
    },
  })),
}));

let app: import('express').Express;
let request: typeof import('supertest');

beforeAll(async () => {
  ({ default: request } = await import('supertest'));
  const { createApp } = await import('../../src-server/app');
  app = createApp();
}, 30_000);

beforeEach(async () => {
  const { _resetForTests } = await import('../../src-server/services/racersStore');
  _resetForTests();
  // Clear any leftover cache files between tests.
  for (const f of fs.readdirSync(tmpRoot)) {
    const full = path.join(tmpRoot, f);
    if (fs.statSync(full).isFile()) fs.unlinkSync(full);
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('cache routes', () => {
  it('GET /api/cache/:year returns 0 files for a fresh year', async () => {
    const res = await request(app).get('/api/cache/2025');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 0, files: [] });
  });

  it('GET /api/cache/:year rejects an invalid year', async () => {
    const res = await request(app).get('/api/cache/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  it('POST /api/build-cache builds, then GET lists, then DELETE clears', async () => {
    await request(app).post('/api/racers/add').send({ bc: '12345' });
    await request(app).post('/api/racers/add').send({ bc: '67890' });

    const build = await request(app).post('/api/build-cache').send({ year: '2025' });
    expect(build.status).toBe(200);
    expect(build.body).toMatchObject({ success: true, totalRacers: 2, cached: 2, failed: 0 });

    const list = await request(app).get('/api/cache/2025');
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(2);

    const del = await request(app).delete('/api/cache/2025');
    expect(del.status).toBe(200);
    expect(del.body.removedFiles).toBe(2);

    const after = await request(app).get('/api/cache/2025');
    expect(after.body.count).toBe(0);
  });

  it('GET /api/all-race-data returns cached entries plus empty placeholders', async () => {
    await request(app).post('/api/racers/add').send({ bc: '11111' });
    await request(app).post('/api/racers/add').send({ bc: '22222' });
    await request(app)
      .post('/api/build-cache')
      .send({ year: '2025', racerId: '11111' });

    const res = await request(app).get('/api/all-race-data?year=2025');
    expect(res.status).toBe(200);
    expect(res.body['11111']).toMatchObject({ name: 'Test Rider 11111', points: 25 });
    expect(res.body['22222']).toMatchObject({ error: 'No cached data available' });
  });
});
