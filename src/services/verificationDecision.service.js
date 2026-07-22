import { isValidObjectId } from 'mongoose';
import userSchema from '../models/user.schema.js';

/**
 * Single source of truth for admin verification decisions — previously two
 * separate controllers (admin/auth.controller.js's decideVerification and
 * admin/userVerification.controller.js's adminDecideVerification) applied
 * different rules to the same state transition: one required the current
 * status be 'pending' before deciding, the other allowed setting any status
 * from any prior state with no guard at all. Two admins using the two
 * different screens could produce different, unaudited outcomes for the
 * same supplier.
 *
 * Transition rules (a real, if small, state machine rather than "any value
 * from any state"):
 *   - target 'verified' or 'rejected': current status MUST be 'pending'.
 *   - target 'pending': allowed FROM 'verified' or 'rejected' — a deliberate
 *     "reopen for re-review" action — but not a no-op re-set from 'pending'.
 *   - 'rejected' requires a reason in notes.
 *
 * Returns { statusCode, message, data } on success; throws an object with
 * the same shape (via a plain Error subclass) on validation/not-found
 * failure, so callers can map it straight to ApiResponse.errorResponse.
 */
export class VerificationDecisionError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const VALID_TARGETS = ['verified', 'rejected', 'pending'];

export async function applyVerificationDecision({ userId, targetStatus, notes, decidedBy }) {
  if (!isValidObjectId(userId)) {
    throw new VerificationDecisionError(400, 'Invalid user ID');
  }
  if (!VALID_TARGETS.includes(targetStatus)) {
    throw new VerificationDecisionError(400, "Status must be 'verified', 'rejected', or 'pending'");
  }
  if (targetStatus === 'rejected' && (!notes || !notes.trim())) {
    throw new VerificationDecisionError(400, 'Reject decisions must include a reason in notes');
  }

  const user = await userSchema.findById(userId);
  if (!user) throw new VerificationDecisionError(404, 'User not found');

  const current = user.verificationStatus;
  const isReopen = targetStatus === 'pending';

  if (!isReopen && current !== 'pending') {
    throw new VerificationDecisionError(
      400,
      `Cannot decide — current status is '${current}'. Reopen it first if it needs re-review.`
    );
  }
  if (isReopen && current === 'pending') {
    throw new VerificationDecisionError(400, 'Already pending — nothing to reopen');
  }

  user.verificationStatus = targetStatus;
  user.verificationDecidedAt = new Date();
  user.verificationDecidedBy = decidedBy || null;
  user.verificationMethod = 'manual_admin';
  if (notes !== undefined) user.verificationNotes = notes ? notes.trim() : null;

  await user.save();

  const verbs = { verified: 'approved', rejected: 'rejected', pending: 'reopened for re-review' };
  return {
    statusCode: 200,
    message: `Verification ${verbs[targetStatus]}`,
    data: {
      _id: user._id,
      verificationStatus: user.verificationStatus,
      verificationDecidedAt: user.verificationDecidedAt,
      verificationNotes: user.verificationNotes,
    },
  };
}
