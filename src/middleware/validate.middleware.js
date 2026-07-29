import { ApiResponse } from '../helpers/ApiReponse.js';

/**
 * M3.T3 (Implementation Master Plan) — Zod adoption, scoped to the 3
 * highest-risk endpoints named in the plan (updateProfile, bid creation,
 * RFQ posting), not a platform-wide rollout yet.
 *
 * Deliberately validation-only: on success, req.body is left completely
 * untouched (NOT replaced with the parsed/coerced result). Every one of
 * these routes is multipart/form-data (file uploads alongside fields), so
 * body values arrive as strings, and the existing controllers/services
 * already have their own string-comparison logic (e.g. `draft === 'true'`)
 * that a coerced boolean would silently break. This layer only rejects
 * malformed input early with a clear 400 — it does not change what the
 * controller receives, so there is zero behavior change for valid input.
 */
export const validateBody = schema => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const message = firstIssue
      ? `${firstIssue.path.join('.') || 'body'}: ${firstIssue.message}`
      : 'Invalid request body';
    return ApiResponse.errorResponse(res, 400, message);
  }
  next();
};
