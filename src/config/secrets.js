/**
 * Centralized secret management.
 *
 * Previously JWT_SECRET was hardcoded in 4 places — meaning anyone who could
 * read the repo could forge JWTs. This module is the single source of truth:
 *
 *   - In PRODUCTION: a missing secret, or one left equal to the old known
 *     default, throws at startup (fail fast — never run prod insecure).
 *   - In DEVELOPMENT: falls back to a clearly-labelled insecure default with a
 *     console warning, so local dev keeps working with zero setup.
 */
const isProd = process.env.NODE_ENV === 'production';

// The old hardcoded value — now ONLY used as a dev fallback and as a
// "you must change this" tripwire in production.
const LEGACY_JWT_DEFAULT = 'saralbuy-default-secret-key-1234567890';

function resolveSecret(name, legacyDefault) {
  const val = (process.env[name] || '').trim();

  if (isProd) {
    if (!val) {
      throw new Error(
        `[FATAL] ${name} is not set. It must be configured in the production environment before the server can start.`
      );
    }
    if (val === legacyDefault) {
      throw new Error(
        `[FATAL] ${name} is still set to the old known default. Generate a unique secret and set it in the production environment.`
      );
    }
    return val;
  }

  if (!val) {
    console.warn(
      `[WARN] ${name} is not set — using an INSECURE development default. Never deploy without setting ${name}.`
    );
    return legacyDefault;
  }
  return val;
}

export const JWT_SECRET = resolveSecret('JWT_SECRET', LEGACY_JWT_DEFAULT);
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || process.env.JWT_SECRET_EXPIRY || '30d';
