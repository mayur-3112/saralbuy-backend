import mongoose from 'mongoose';

const dealSurveySchema = new mongoose.Schema(
  {
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClosedDeal',
      required: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['buyer', 'seller'],
      required: true,
    },
    overallRating: { type: Number, min: 1, max: 5, required: true },
    communicationRating: { type: Number, min: 1, max: 5 },
    accuracyRating: { type: Number, min: 1, max: 5 },
    deliveryRating: { type: Number, min: 1, max: 5 },
    valueRating: { type: Number, min: 1, max: 5 },
    review: { type: String, default: '', trim: true, maxlength: 1000 },
    wouldRecommend: { type: Boolean, default: null },
  },
  { timestamps: true }
);

dealSurveySchema.index({ dealId: 1, submittedBy: 1 }, { unique: true });
dealSurveySchema.index({ role: 1, createdAt: -1 });

export default mongoose.model('DealSurvey', dealSurveySchema);
