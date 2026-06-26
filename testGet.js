import 'dotenv/config';
import mongoose from 'mongoose';
import requirementSchema from './src/models/requirement.schema.js';
import productSchema from './src/models/product.schema.js';

mongoose.connect('mongodb://127.0.0.1:27017/saralbuy').then(async () => {
  try {
    const p = await productSchema.create({
      title: 'Test',
      description: 'Test',
      minimumBudget: 100,
      userId: new mongoose.Types.ObjectId(),
      draft: false,
      isMultiple: true,
      categoryId: new mongoose.Types.ObjectId()
    });
    const r = await requirementSchema.create([{
      productId: p._id,
      buyerId: p.userId,
      sellers: []
    }]);
    
    // Simulate getBuyerRequirements
    const requirements = await requirementSchema
        .find({ buyerId: p.userId, isDelete: false })
        .populate({
          path: 'productId',
          populate: { path: 'categoryId', select: '-subCategories' },
        })
        .populate('buyerId')
        .populate({
          path: 'sellers.sellerId',
          select: '-password -__v',
        })
        .sort({ createdAt: -1 })
        .lean();
        
    console.log('Requirements found:', requirements.length);
    console.log(JSON.stringify(requirements, null, 2));
    
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
});
