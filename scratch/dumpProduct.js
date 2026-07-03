import mongoose from 'mongoose';
import productSchema from '../src/models/product.schema.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

mongoose.connect(process.env.DB_CTX).then(async () => {
  const prods = await productSchema.find().sort({ createdAt: -1 }).limit(5).lean();
  console.log('Total recent products:', prods.length);
  for (const p of prods) {
    console.log('--- PRODUCT ---');
    console.log('ID:', p._id);
    console.log('Title:', p.title);
    console.log('Description:', p.description);
    console.log('Items:', JSON.stringify(p.items, null, 2));
    console.log('isMultiple:', p.isMultiple);
    console.log('isUpload:', p.isUpload);
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
