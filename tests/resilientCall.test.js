import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resilientFetch, withTimeout } from '../src/utils/resilientCall.js';

describe('resilientFetch', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns the response on success, on the first attempt', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const res = await resilientFetch('https://example.com');
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries once on failure, then succeeds', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const res = await resilientFetch('https://example.com', {}, { retries: 1, timeoutMs: 1000 });
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('gives up and throws after exhausting retries', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('provider is down'));
    await expect(
      resilientFetch('https://example.com', {}, { retries: 2, timeoutMs: 1000 })
    ).rejects.toThrow('provider is down');
    expect(global.fetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('aborts a hanging request instead of waiting forever', async () => {
    global.fetch = vi.fn(
      (_url, { signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );

    await expect(
      resilientFetch('https://example.com', {}, { retries: 0, timeoutMs: 50 })
    ).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('withTimeout', () => {
  it('resolves normally when the wrapped promise finishes in time', async () => {
    const result = await withTimeout(Promise.resolve('done'), 1000);
    expect(result).toBe('done');
  });

  it('rejects with the timeout message when the wrapped promise hangs', async () => {
    const neverResolves = new Promise(() => {});
    await expect(withTimeout(neverResolves, 50, 'took too long')).rejects.toThrow(
      'took too long'
    );
  });
});
