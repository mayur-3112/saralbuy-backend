import mongoose from 'mongoose';

const productNotificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClosedDeal',
    },
    roomId: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      enum: ['new_bid', 'deal_request', 'deal_accepted', 'deal_rejected', 'chat_rating'],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    seen: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

productNotificationSchema.index({ createdAt: 1 },{expireAfterSeconds: 30 * 24 * 60 * 60});

productNotificationSchema.index({ recipientId: 1, seen: 1 });
productNotificationSchema.index({ productId: 1 });

export default mongoose.model('ProductNotification', productNotificationSchema);
