import 'dotenv/config';
import mongoose from 'mongoose';
import requirementSchema from './src/models/requirement.schema.js';
import productSchema from './src/models/product.schema.js';
import userSchema from './src/models/user.schema.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const reqs = await requirementSchema.find().sort({createdAt: -1}).limit(5).lean();
  console.log('Last 5 requirements:', JSON.stringify(reqs, null, 2));
  
  const prods = await productSchema.find({ draft: false }).sort({createdAt: -1}).limit(5).lean();
  console.log('\nLast 5 products:', JSON.stringify(prods, null, 2));

  process.exit(0);
});
