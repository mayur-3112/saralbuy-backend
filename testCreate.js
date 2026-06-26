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
    console.log('Created product:', p._id);
    
    const r = await requirementSchema.create([{
      productId: p._id,
      buyerId: p.userId,
      sellers: []
    }]);
    console.log('Created requirement:', r);
    
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
});
