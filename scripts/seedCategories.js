import '../src/config/env.js';
import mongoCtx from '../src/config/db.config.js';
import Category from '../src/models/category.schema.js';
import mongoose from 'mongoose';

import fs from 'fs';
import path from 'path';

const seedDataPath = path.resolve('scripts/categories.json');
const seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));

const run = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoCtx();

    console.log('🧹 Clearing existing categories...');
    const deleteResult = await Category.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} categories.`);

    console.log('🌱 Seeding B2B categories...');
    const inserted = await Category.insertMany(seedData);
    console.log(`Successfully seeded ${inserted.length} parent categories!`);

    inserted.forEach(cat => {
      console.log(`- ${cat.categoryName} (${cat.subCategories.length} subcategories)`);
    });
  } catch (err) {
    console.error('❌ Failed to seed categories:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();
