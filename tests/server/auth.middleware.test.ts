import { describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

vi.mock('firebase-admin', () => ({
  default: {
    apps: [{}],
    auth: () => ({ verifyIdToken: vi.fn() }),
    credential: { cert: vi.fn(), applicationDefault: vi.fn() },
    initializeApp: vi.fn(),
  },
}));

import { requireAdmin } from '../../src-server/middleware/auth';

function makeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('requireAdmin middleware', () => {
  it('passes when serviceAuth is set (cron path)', () => {
    const next = vi.fn();
    const res = makeRes();
    // Cast through unknown because we're stubbing only what we use.
    requireAdmin(
      { serviceAuth: true } as unknown as Parameters<typeof requireAdmin>[0],
      res as unknown as Parameters<typeof requireAdmin>[1],
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('passes when the user has admin: true', () => {
    const next = vi.fn();
    const res = makeRes();
    requireAdmin(
      { user: { uid: 'u1', admin: true } } as unknown as Parameters<typeof requireAdmin>[0],
      res as unknown as Parameters<typeof requireAdmin>[1],
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects with 403 when user is signed in but not admin', () => {
    const next = vi.fn();
    const res = makeRes();
    requireAdmin(
      { user: { uid: 'u2' } } as unknown as Parameters<typeof requireAdmin>[0],
      res as unknown as Parameters<typeof requireAdmin>[1],
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ error: expect.stringMatching(/admin/i) });
  });

  it('rejects with 403 when no user is attached', () => {
    const next = vi.fn();
    const res = makeRes();
    requireAdmin(
      {} as unknown as Parameters<typeof requireAdmin>[0],
      res as unknown as Parameters<typeof requireAdmin>[1],
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
