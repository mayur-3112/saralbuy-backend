import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ApiResponse } from '../helpers/ApiReponse.js';

// Keyed by phone number (the actual abuse surface — SMS-bombing/brute-forcing
// one number) rather than IP, so it can't be trivially bypassed with a
// rotating IP/proxy; falls back to IP (via the library's IPv6-safe helper)
// if the number is missing/malformed so the limiter still applies.
const phoneKey = req => {
  const raw = req.body?.pNo;
  if (typeof raw !== 'string' || !raw.trim()) return ipKeyGenerator(req.ip);
  return raw.startsWith('+') ? raw : `+91${raw}`;
};

const otpLimitHandler = (req, res) =>
  ApiResponse.errorResponse(res, 429, 'Too many attempts. Please try again later.');

// 3 OTP sends per phone number per 10 minutes — enough for legitimate retries
// (didn't receive it, fat-fingered send), tight enough to block SMS-bombing.
export const sendOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  keyGenerator: phoneKey,
  standardHeaders: true,
  legacyHeaders: false,
  handler: otpLimitHandler,
});

// 5 verify attempts per phone number per 10 minutes — a 6-digit OTP only has
// 900,000 combinations, so without a cap it's brute-forceable inside its own
// 5-minute validity window.
export const verifyOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: phoneKey,
  standardHeaders: true,
  legacyHeaders: false,
  handler: otpLimitHandler,
});

// Same abuse surface as OTP, different key: admin login is password-based
// (not one-time-code), so the target is the account's email rather than a
// phone number — keyed by email, falling back to IP if it's missing/malformed
// so the limiter still applies to malformed requests.
const emailKey = req => {
  const raw = req.body?.email;
  if (typeof raw !== 'string' || !raw.trim()) return ipKeyGenerator(req.ip);
  return raw.trim().toLowerCase();
};

// 5 attempts per email per 10 minutes — this is the highest-privilege
// account in the system (admin) and, unlike OTP, was previously unthrottled
// entirely.
export const adminLoginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: emailKey,
  standardHeaders: true,
  legacyHeaders: false,
  handler: otpLimitHandler,
});
