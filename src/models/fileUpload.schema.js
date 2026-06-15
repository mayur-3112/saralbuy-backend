import mongoose from 'mongoose';

const fileUploadSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  filename: { type: String, required: true },
  size: { type: Number },
}, { timestamps: true });

export default mongoose.model('FileUpload', fileUploadSchema);
