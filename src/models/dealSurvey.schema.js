import mongoose from 'mongoose';

const dealSurveySchema = new mongoose.Schema({
  dealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' },
  responderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  wasDealClosed: { type: Boolean, required: true },
  finalAmount: { type: Number },
  rating: { type: Number, min: 1, max: 5 },
  experience: { type: String, enum: ['excellent', 'good', 'average', 'poor'] },
  wouldRecommend: { type: Boolean },
  feedback: { type: String },
  issuesFaced: { type: String },
}, { timestamps: true });

export default mongoose.model('DealSurvey', dealSurveySchema);
