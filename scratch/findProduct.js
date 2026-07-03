import mongoose from 'mongoose';
import productSchema from '../src/models/product.schema.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

mongoose.connect(process.env.DB_CTX).then(async () => {
  const allProds = await productSchema.find().lean();
  console.log('Total products in database:', allProds.length);
  
  const match = allProds.find(p => p._id.toString().toLowerCase().endsWith('d1fe42'));
  if (match) {
    console.log('--- FOUND PRODUCT ---');
    console.log('ID:', match._id);
    console.log('Title:', match.title);
    console.log('Description:', match.description);
    console.log('Items:', JSON.stringify(match.items, null, 2));
    console.log('isMultiple:', match.isMultiple);
    console.log('isUpload:', match.isUpload);
  } else {
    console.log('No product ends with d1fe42.');
    // Let's print the last 5 products to see what we have
    console.log('Recent 5 products:');
    allProds.slice(-5).forEach(p => {
      console.log(`- ID: ${p._id}, Title: "${p.title}", Items count: ${p.items?.length || 0}`);
    });
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
