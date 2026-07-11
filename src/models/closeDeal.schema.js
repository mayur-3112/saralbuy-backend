import mongoose from 'mongoose';

const closedDealSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    yourBudget: { type: Number, required: true },
    date: { type: Date, default: Date.now }, // Date of deal closure
    amount: { type: Number, required: true },
    closedAt: { type: Date, default: Date.now },
    initiator: { type: String, default: 'buyer' },

    // SB-011: structured terms both parties agree to at closure (logged, binding)
    agreedTerms: {
      finalPrice: { type: Number },
      quantity: { type: Number },
      deliveryDate: { type: Date },
      paymentTerms: { type: String, default: '' },
      freightTerms: { type: String, default: '' },
      notes: { type: String, default: '' },
    },

    // SB-012: platform margin captured on the finalised deal
    commissionRate: { type: Number, default: 2 }, // percent
    commissionAmount: { type: Number, default: 0 },
    closedDealStatus: {
      type: String,
      enum: ['pending', 'waiting_seller_approval', 'completed', 'rejected'],
      default: 'pending',
    },
    dealStatus: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    sellerRating: {
      type: Number,
      max: 5,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true }
);
closedDealSchema.index({ productId: 1, buyerId: 1, sellerId: 1 }, { unique: true });

export default mongoose.model('ClosedDeal', closedDealSchema);
