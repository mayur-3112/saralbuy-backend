import mongoose from 'mongoose';

const notificationBlastSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    audience: {
      type: String,
      enum: ['all', 'buyers', 'sellers'],
      required: true,
    },
    sentCount: { type: Number, default: 0 },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('NotificationBlast', notificationBlastSchema);
