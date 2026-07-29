import mongoose from 'mongoose';

const fileUploadSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  filename: { type: String, required: true },
  size: { type: Number },
  // Both optional/unset on older records (pre-dates this field) — retrieval
  // access in file.route.js only tightens beyond "any authenticated user"
  // when category === 'kyc', so absence here doesn't change behavior for
  // any existing file (product images, quote docs, etc. stay as they were).
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  category: { type: String, enum: ['kyc', 'listing', 'quote', 'banner', 'profile', 'other'] },
}, { timestamps: true });

export default mongoose.model('FileUpload', fileUploadSchema);
