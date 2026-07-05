import { ApiResponse } from '../../helpers/ApiReponse.js';
import userSchema from '../../models/user.schema.js';
import productSchema from '../../models/product.schema.js';
import bidSchema from '../../models/bid.schema.js';
import productNotificaitonSchema from '../../models/productNotificaiton.schema.js';
import notificationBlastSchema from '../../models/notificationBlast.schema.js';

const ADMIN_SENDER_PLACEHOLDER = '000000000000000000000000'; // 24-char zero ObjectId

async function getTargetUserIds(audience) {
  if (audience === 'all') {
    const users = await userSchema.find({ status: 'active', role: 'user' }, '_id').lean();
    return users.map(u => u._id);
  }
  if (audience === 'buyers') {
    // Users who have at least one non-draft product (RFQ)
    const products = await productSchema.distinct('userId', { draft: { $ne: true } });
    return products;
  }
  if (audience === 'sellers') {
    // Users who have submitted at least one bid/quote
    const sellers = await bidSchema.distinct('sellerId');
    return sellers;
  }
  return [];
}

export const sendBlast = async (req, res) => {
  try {
    const { title, message, audience } = req.body;
    if (!title?.trim() || !message?.trim()) {
      return ApiResponse.errorResponse(res, 400, 'Title and message are required');
    }
    if (!['all', 'buyers', 'sellers'].includes(audience)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid audience');
    }

    const recipientIds = await getTargetUserIds(audience);
    if (recipientIds.length === 0) {
      return ApiResponse.successResponse(res, 200, 'No users found for this audience', { sentCount: 0 });
    }

    // Use a fixed admin sender ObjectId (all-zeros is safe — no real user has this)
    const senderId = req.admin?._id || new (await import('mongoose')).default.Types.ObjectId(ADMIN_SENDER_PLACEHOLDER);

    const docs = recipientIds.map(recipientId => ({
      recipientId,
      senderId,
      type: 'admin_blast',
      title: title.trim(),
      description: message.trim(),
      seen: false,
      metadata: { audience, blastAt: new Date() },
    }));

    // Batch insert — MongoDB handles up to 100k at once, chunk for safety
    const CHUNK = 500;
    for (let i = 0; i < docs.length; i += CHUNK) {
      await productNotificaitonSchema.insertMany(docs.slice(i, i + CHUNK), { ordered: false });
    }

    // Log the blast
    await notificationBlastSchema.create({
      title: title.trim(),
      message: message.trim(),
      audience,
      sentCount: recipientIds.length,
      sentBy: req.admin?._id || null,
    });

    return ApiResponse.successResponse(res, 200, 'Blast sent', { sentCount: recipientIds.length });
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, 'Error sending blast');
  }
};

export const getBlastHistory = async (req, res) => {
  try {
    let { page = 1, limit = 20 } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    const [blasts, total] = await Promise.all([
      notificationBlastSchema.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      notificationBlastSchema.countDocuments(),
    ]);

    return ApiResponse.successResponse(res, 200, 'Blast history fetched', {
      blasts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return ApiResponse.errorResponse(res, 500, 'Error fetching blast history');
  }
};
