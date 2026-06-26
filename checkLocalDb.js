import 'dotenv/config';
import mongoose from 'mongoose';
import requirementSchema from './src/models/requirement.schema.js';
import productSchema from './src/models/product.schema.js';

mongoose.connect(process.env.DB_CTX).then(async () => {
  const reqs = await requirementSchema.find().lean();
  console.log('Total Requirements:', reqs.length);
  
  const prods = await productSchema.find({ draft: false }).lean();
  console.log('Total Products:', prods.length);

  process.exit(0);
});
