import 'dotenv/config';
import mongoose from 'mongoose';
import requirementSchema from './src/models/requirement.schema.js';
import productSchema from './src/models/product.schema.js';
import userSchema from './src/models/user.schema.js';
import categorySchema from './src/models/category.schema.js';

mongoose.connect(process.env.DB_CTX).then(async () => {
  const reqs = await requirementSchema.find().lean();
  console.log('Requirements found:', reqs.length);
  
  if (reqs.length > 0) {
    const populated = await requirementSchema
      .find({ _id: reqs[0]._id })
      .populate({
        path: 'productId',
        populate: { path: 'categoryId', select: '-subCategories' },
      })
      .lean();
    console.log('Populated requirement:', JSON.stringify(populated, null, 2));
  }

  process.exit(0);
});
