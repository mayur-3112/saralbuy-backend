import '../src/config/env.js';
import mongoCtx from '../src/config/db.config.js';
import Product from '../src/models/product.schema.js';
import Requirement from '../src/models/requirement.schema.js';
import Bid from '../src/models/bid.schema.js';
import ClosedDeal from '../src/models/closeDeal.schema.js';
import Cart from '../src/models/cart.schema.js';
import mongoose from 'mongoose';

const run = async () => {
  try {
    const dbUri = process.env.DB_CTX || process.env.MONGODB_URI || process.env.DATABASE_URL;
    console.log(`🔌 Connecting to MongoDB database at: ${dbUri ? dbUri.split('@').pop() : 'default uri'}...`);
    await mongoCtx();

    console.log('🧹 Clearing Product (RFQ Posts) collection...');
    const prodResult = await Product.deleteMany({});
    console.log(`Deleted ${prodResult.deletedCount} products/RFQs.`);

    console.log('🧹 Clearing Requirement collection...');
    const reqResult = await Requirement.deleteMany({});
    console.log(`Deleted ${reqResult.deletedCount} requirements.`);

    console.log('🧹 Clearing Bid collection...');
    const bidResult = await Bid.deleteMany({});
    console.log(`Deleted ${bidResult.deletedCount} bids.`);

    console.log('🧹 Clearing ClosedDeal collection...');
    const dealResult = await ClosedDeal.deleteMany({});
    console.log(`Deleted ${dealResult.deletedCount} closed deals.`);

    console.log('🧹 Clearing Cart collection...');
    const cartResult = await Cart.deleteMany({});
    console.log(`Deleted ${cartResult.deletedCount} carts.`);

    console.log('✅ Cleanup completed successfully!');
  } catch (err) {
    console.error('❌ Failed to clear RFQs:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();
