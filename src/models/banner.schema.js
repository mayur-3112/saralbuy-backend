import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
  imageUrl: { type: String, default: null, required: true },
  linkUrl: { type: String, default: null, required: true },
  domain:{type:String},
  endPoint:{type:String},
  title: { type: String, default: null, required: true, trim: true },
  buttonText: { type: String, default: null, required: true, trim: true },
});
export default mongoose.model('Banner', bannerSchema);
