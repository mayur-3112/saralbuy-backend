import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/secrets.js';

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
