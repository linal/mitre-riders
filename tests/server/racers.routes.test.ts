import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Point everything at a throwaway temp directory BEFORE any module imports
// so the cache/env module reads the right value.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bcpa-test-'));
process.env.NODE_ENV = 'test';
process.env.CACHE_DIR = tmpRoot;
process.env.LOG_LEVEL = 'error';
process.env.CACHE_BUILD_TOKEN = 'a'.repeat(32);

// Avoid loading firebase-admin (slow + needs credentials) entirely.
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
    (req as { user?: unknown }).user = { uid: 'test-user', admin: true };
    next();
  },
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
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
  // Reset on-disk racers file.
  const racersFile = path.join(tmpRoot, 'racers', 'racers.json');
  if (fs.existsSync(racersFile)) fs.unlinkSync(racersFile);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('racers routes', () => {
  it('GET /api/racers returns an empty list initially', async () => {
    const res = await request(app).get('/api/racers');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/racers/add adds a racer', async () => {
    const res = await request(app).post('/api/racers/add').send({ bc: '12345' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, bc: '12345', count: 1 });

    const list = await request(app).get('/api/racers');
    expect(list.body).toEqual([{ bc: '12345' }]);
  });

  it('POST /api/racers/add rejects duplicates', async () => {
    await request(app).post('/api/racers/add').send({ bc: '12345' });
    const res = await request(app).post('/api/racers/add').send({ bc: '12345' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('POST /api/racers/add validates the body', async () => {
    const res = await request(app).post('/api/racers/add').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  it('DELETE /api/racers/:bc removes a racer', async () => {
    await request(app).post('/api/racers/add').send({ bc: '99999' });
    const del = await request(app).delete('/api/racers/99999');
    expect(del.status).toBe(200);
    expect(del.body).toMatchObject({ success: true, bc: '99999', count: 0 });
  });

  it('DELETE /api/racers/:bc returns 404 for unknown ids', async () => {
    const del = await request(app).delete('/api/racers/00000');
    expect(del.status).toBe(404);
  });
});
