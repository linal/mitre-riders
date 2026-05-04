import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub firebase auth so the client module imports cleanly.
vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: null }),
}));

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://example.test');
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('api client', () => {
  it('builds an absolute URL from VITE_API_BASE_URL', async () => {
    const { apiUrl } = await import('../../src/shared/api/client');
    expect(apiUrl('/api/clubs')).toBe('https://example.test/api/clubs');
    expect(apiUrl('api/clubs')).toBe('https://example.test/api/clubs');
  });

  it('throws ApiError with parsed body on non-2xx responses', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Response(JSON.stringify({ message: 'nope' }), {
          status: 422,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const { api, ApiError } = await import('../../src/shared/api/client');
    await expect(api.get('/api/something')).rejects.toBeInstanceOf(ApiError);
    await expect(api.get('/api/something')).rejects.toMatchObject({
      status: 422,
      message: 'nope',
    });
  });

  it('serialises JSON bodies and sets content-type', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    const { api } = await import('../../src/shared/api/client');
    await api.post('/api/x', { hello: 'world' });
    const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBe('{"hello":"world"}');
    expect((init as { headers: Record<string, string> }).headers['Content-Type']).toBe(
      'application/json',
    );
  });
});
