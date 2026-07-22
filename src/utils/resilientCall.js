/**
 * A thin wrapper around the built-in `fetch` for outbound calls to
 * third-party services (SMS provider, ImageKit) — adds a timeout (native
 * `fetch` has none) and a small number of retries with backoff for
 * transient failures.
 *
 * Without this, a slow/hanging third-party API stalls the whole
 * user-facing request indefinitely instead of failing fast — the exact
 * failure mode flagged in the architecture review for OTP delivery.
 *
 * Deliberately does NOT change what happens on failure — callers keep
 * their own try/catch and fallback logic (e.g. user.controller.js's
 * factorSendOtp already falls back to a dummy OTP session on any fetch
 * error); this just makes "failure" arrive in seconds instead of never.
 */
export async function resilientFetch(url, options = {}, { timeoutMs = 8000, retries = 1 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return response;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      // Don't retry a request we deliberately aborted for timeout on the
      // FINAL attempt — only retry if attempts remain.
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Generic timeout for any Promise-returning call that isn't a raw `fetch`
 * (e.g. an SDK client method like ImageKit's `files.upload()`, which has no
 * built-in timeout of its own) — same underlying problem as resilientFetch,
 * different shape of call site.
 */
export function withTimeout(promise, timeoutMs, timeoutMessage = 'Operation timed out') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
