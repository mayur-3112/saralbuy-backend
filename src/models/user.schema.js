import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'; // 32 characters
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return text;
  const textParts = text.split(':');
  if (textParts.length < 2) return text; // fallback for unencrypted old records
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

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
    aadhaarNumber: { 
      type: String, 
      get: decrypt, 
      set: encrypt 
    },
    aadhaarImage: { type: String }, // file path or URL
    isAadhaarVerified: { type: Boolean, default: false },
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
    businessName: {
      type: String,
      default: null,
    },
  },
  { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

userSchema.index({ firstName: 1, lastName: 1, email: 1 });
userSchema.methods.generateAuthToken = function () {
  return jwt.sign({ _id: this._id, email: this.email }, process.env.JWT_SECRET || 'saralbuy-default-secret-key-1234567890', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
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
