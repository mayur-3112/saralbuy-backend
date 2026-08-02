import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/secrets.js';
import { encryptField, decryptField } from '../utils/fieldEncryption.js';

// const addressSchema = new mongoose.Schema({
//   addressLine: { type: String, },
//   city:        { type: String, },
//   state:       { type: String, },
//   pincode:     { type: String, },
//   country:     { type: String, }
// }, { _id: false });

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, unique: true, trim: true, sparse: true, lowercase: true },
    phone: { type: String, required: true },
    password: { type: String },
    address: { type: String, default: null, trim: true },
    profileImage: { type: String, default: null },
    currentLocation: String,
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    // Updated when the user's last socket connection actually drops (after
    // the presence grace window) — backs the "Last seen" label shown once
    // a user goes offline.
    lastSeenAt: {
      type: Date,
      default: null,
    },
    businessName: {
      type: String,
      default: null,
    },

    // Primary account role the user acts as (a single account can be both).
    accountRole: {
      type: String,
      enum: ['buyer', 'supplier'],
      default: 'buyer',
    },
    organizationName: { type: String, default: null, trim: true },
    procurementRole: { type: String, default: null, trim: true },
    supplierCategories: { type: String, default: null },

    // Primary & Additional Supply Categories for Homepage Directory Showcase
    primaryCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    secondaryCategoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    supplierHeadline: { type: String, default: null, trim: true },

    // Supplier "Organisation Details" — profile/storefront-style fields.
    // All optional at the schema level (existing users without them just
    // read as null; no migration needed).
    roleInCompany: { type: String, default: null, trim: true },
    website: { type: String, default: null, trim: true },
    businessDescription: { type: String, default: null },
    accomplishments: { type: String, default: null },
    topProblemsSolved: { type: String, default: null },
    // Founding year — displayed profile-side as "since <year>" and used to
    // derive years-in-business, so it never goes stale like a raw count would.
    businessSince: { type: Number, default: null },

    // Business-facing contact info, opt-in and separate from the personal
    // `phone`/`address` fields — a supplier can choose to publish a store
    // number/location for walk-in buyers without exposing their personal
    // phone or home address, which stay private until a deal closes.
    businessPhone: { type: String, default: null, trim: true },
    storeAddress: { type: String, default: null, trim: true },

    // Business verification (post-Aadhaar model).
    // Uppercased on save via pre-hook below. Stored encrypted at rest when
    // FIELD_ENCRYPTION_KEY is configured (see utils/fieldEncryption.js) —
    // trim/uppercase apply first, then the custom set/get pair encrypts on
    // write and transparently decrypts on every read (direct property
    // access and toJSON/toObject, since getters:true is set below), so no
    // controller code needed to change. Existing plaintext records (or any
    // written while unconfigured) read back unchanged — no migration
    // required to ship this; a backfill for old records is a follow-up.
    gstin: { type: String, default: null, trim: true, uppercase: true, set: encryptField, get: decryptField },
    pan:   { type: String, default: null, trim: true, uppercase: true, set: encryptField, get: decryptField },
    // Document uploads (ImageKit URLs) — supplier proves what they claim.
    gstinDocumentUrl: { type: String, default: null },
    panDocumentUrl:   { type: String, default: null },

    // The single source of truth for "is this supplier trustworthy for a buyer?"
    //   pending    - submitted docs, waiting on admin
    //   verified   - admin approved OR future API auto-approved
    //   rejected   - admin rejected with a note
    //   unverified - never submitted anything
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified',
      index: true,
    },
    verificationSubmittedAt: { type: Date, default: null },
    verificationDecidedAt:   { type: Date, default: null },
    verificationDecidedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verificationMethod: {
      // How was this verification performed? Kept forward-compatible so we can
      // swap in a paid GSTIN API later without a migration.
      type: String,
      enum: ['manual_admin', 'gstin_api', null],
      default: null,
    },
    verificationNotes: { type: String, default: null, trim: true },

    // DPDP-style erasure request. A user requests deletion; an admin fulfills
    // it by anonymizing the record (see admin/dataErasure.controller.js).
    // Not an instant hard-delete: this account's _id is referenced by other
    // users' Bid/ClosedDeal/Chat records, and cascading-deleting those would
    // corrupt other people's transaction history. Anonymization (scrubbing
    // PII, keeping the _id and non-personal records intact) is the standard,
    // safer pattern for this exact situation.
    deletionRequestedAt: { type: Date, default: null },
    deletionCompletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

userSchema.index({ firstName: 1, lastName: 1, email: 1 });
userSchema.index({ gstin: 1 }, { sparse: true }); // fast lookup + duplicate-GST detection
// phone is the OTP-login lookup key — queried on every single send-otp/
// verify-otp call — and had no index at all (not even non-unique), meaning
// a full collection scan on the hottest query path in the app. Not marked
// unique here: that's a data-integrity decision (would need to verify no
// duplicate phones already exist in production first) separate from this
// performance fix.
userSchema.index({ phone: 1 });

// Convenient virtual for frontend: shows a green "Verified Supplier" badge
// only when the admin has affirmatively approved. Any other state = no badge.
userSchema.virtual('isVerifiedSupplier').get(function () {
  return this.verificationStatus === 'verified';
});

// Regex-only shape check on GSTIN. Deep validation happens at admin review time.
// Mongoose 9 dropped `next`-callback middleware — hooks are promise-based now, so
// a `function(next)` hook throws "next is not a function" and blocks every save
// (i.e. every OTP login). Use an async hook and throw to reject.
userSchema.pre('save', async function () {
  if (this.gstin && this.isModified('gstin')) {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(this.gstin)) {
      throw new Error('Invalid GSTIN format');
    }
  }
  if (this.pan && this.isModified('pan')) {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(this.pan)) {
      throw new Error('Invalid PAN format');
    }
  }
});
userSchema.methods.generateAuthToken = function () {
  return jwt.sign({ _id: this._id, email: this.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});
userSchema.methods.hashPassword = async function (password) {
  return bcrypt.hash(password, 10);
};
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};
export default mongoose.model('User', userSchema);
