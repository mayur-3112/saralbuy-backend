/**
 * Server-side identity masking — used anywhere a buyer's identity is returned
 * to a seller (or vice versa) before a deal has closed. Mirrors the masking
 * already applied client-side in ProductListingCard.jsx / UserProfile.jsx, but
 * enforced at the API layer so it can't be bypassed by calling the endpoint
 * directly (which is exactly how the original bug was exploitable).
 */

export function maskName(name) {
  if (!name) return 'Hidden';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return name.length <= 1 ? name : name[0] + '*'.repeat(name.length - 1);
  }
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first[0]}${'*'.repeat(Math.max(first.length - 1, 0))} ${last[0]}${'*'.repeat(Math.max(last.length - 1, 0))}`;
}

/** First token before a comma — city/area granularity only, never a street address. */
export function cityOnly(location) {
  if (!location) return null;
  return location.split(',')[0].trim();
}

/**
 * Build a safe, masked view of a user document for display to the other
 * party in a bid BEFORE any deal has closed. Never includes password, phone,
 * email, exact address, or verification/business-document internals.
 */
export function maskedPartyView(userDoc) {
  if (!userDoc) return null;
  const fullName = [userDoc.firstName, userDoc.lastName].filter(Boolean).join(' ');
  return {
    _id: userDoc._id,
    firstName: maskName(fullName) || undefined,
    profileImage: userDoc.profileImage,
    currentLocation: cityOnly(userDoc.currentLocation || userDoc.address),
    verificationStatus: userDoc.verificationStatus,
  };
}

/** Fields that must never leave the server, full stop, for anyone. */
export const SENSITIVE_USER_FIELDS =
  '-password -gstin -pan -gstinDocumentUrl -panDocumentUrl -verificationNotes -verificationDecidedBy -verificationSubmittedAt -verificationMethod -__v';
