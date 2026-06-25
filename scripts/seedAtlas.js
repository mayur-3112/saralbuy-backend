import '../src/config/env.js';
import mongoose from 'mongoose';
import readline from 'readline';
import Category from '../src/models/category.schema.js';

import fs from 'fs';
import path from 'path';

const seedDataPath = path.resolve('scripts/categories.json');
const seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const baseUri = "mongodb+srv://mayur311agarwal_db_user:<db_password>@saralbuy.sg6bjtn.mongodb.net/?appName=Saralbuy";

rl.question('🔑 Enter MongoDB Atlas password for mayur311agarwal_db_user: ', async (password) => {
  rl.close();
  
  if (!password) {
    console.error("❌ Password cannot be empty!");
    process.exit(1);
  }

  // Construct connection string
  const connectionString = baseUri.replace('<db_password>', encodeURIComponent(password));
  
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await mongoose.connect(connectionString, {
      dbName: 'saralbuy',
      maxPoolSize: 10,
      family: 4,
    });
    console.log('✅ Connected successfully!');

    console.log('🧹 Clearing existing categories on Cloud DB...');
    const deleteResult = await Category.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} categories.`);

    console.log('🌱 Seeding B2B categories...');
    const inserted = await Category.insertMany(seedData);
    console.log(`Successfully seeded ${inserted.length} parent categories to MongoDB Atlas!`);

    inserted.forEach(cat => {
      console.log(`- ${cat.categoryName} (${cat.subCategories.length} subcategories)`);
    });

  } catch (err) {
    console.error('❌ Database seeding failed:', err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
});
