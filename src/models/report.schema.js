import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reportType: {
      type: String,
      enum: ['fake_quote', 'spam', 'inappropriate', 'fraud', 'other'],
      required: true,
    },
    // What is being reported — one of these will be set
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reportedProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    reportedBid: { type: mongoose.Schema.Types.ObjectId, ref: 'Bid', default: null },

    description: { type: String, default: '' },

    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'dismissed'],
      default: 'open',
    },

    adminNote: { type: String, default: '' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },

    // Action taken against the bad actor
    actionTaken: {
      type: String,
      enum: ['none', 'warned', 'suspended', 'banned', 'content_removed'],
      default: 'none',
    },
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedBy: 1 });
reportSchema.index({ reportedUser: 1 });

export default mongoose.model('Report', reportSchema);
