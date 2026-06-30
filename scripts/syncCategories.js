/**
 * Production-safe category sync.
 *
 * Unlike seedCategories.js / seedAtlas.js (which deleteMany + insertMany and
 * therefore regenerate every category & subcategory _id, orphaning any RFQ
 * that references categoryId/subCategoryId), this script SYNCS by name:
 *
 *   - Category matched by categoryName  -> update title/description/image,
 *     and merge subcategories by name (existing subcat _ids preserved,
 *     new subcats appended). Nothing is deleted.
 *   - Category not present in DB         -> inserted.
 *   - Category in DB but NOT in JSON     -> reported only (never auto-deleted).
 *
 * Connection string is read NON-INTERACTIVELY from (in order):
 *   1. first CLI argument                node scripts/syncCategories.js "<uri>"
 *   2. process.env.DB_CTX / MONGODB_URI / DATABASE_URL
 *
 * Usage (production):
 *   DB_CTX="mongodb+srv://...atlas..." node scripts/syncCategories.js
 *   # or
 *   node scripts/syncCategories.js "mongodb+srv://...atlas..."
 *
 * Usage (local): just `node scripts/syncCategories.js` (uses .env.local).
 */
import '../src/config/env.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import Category from '../src/models/category.schema.js';

const seedDataPath = path.resolve('scripts/categories.json');
const seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));

const norm = s => (s || '').trim().toLowerCase();

const run = async () => {
  let dbUri = process.argv[2] || process.env.DB_CTX || process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!dbUri) {
    console.error('❌ No connection string. Pass it as an argument or set DB_CTX/MONGODB_URI.');
    process.exit(1);
  }
  dbUri = dbUri.trim().replace(/^["']|["']$/g, '');

  try {
    console.log('🔌 Connecting...');
    await mongoose.connect(dbUri, { dbName: 'saralbuy', maxPoolSize: 10, family: 4 });
    console.log(JSON.stringify({ 'Connected DB': mongoose.connection.name, 'Mongo Host': mongoose.connection.host }, null, 2));

    const existing = await Category.find({});
    const byName = new Map(existing.map(c => [norm(c.categoryName), c]));
    const jsonNames = new Set(seedData.map(c => norm(c.categoryName)));

    let inserted = 0, updated = 0, subAdded = 0;

    for (const cat of seedData) {
      const found = byName.get(norm(cat.categoryName));
      if (!found) {
        await Category.create(cat);
        inserted++;
        console.log(`➕ inserted: ${cat.categoryName} (${cat.subCategories.length} subcats)`);
        continue;
      }
      // update scalar fields
      found.title = cat.title ?? found.title;
      found.description = cat.description ?? found.description;
      found.image = cat.image ?? found.image;

      // merge subcategories by name (preserve existing subcat _ids)
      const subByName = new Map(found.subCategories.map(s => [norm(s.name), s]));
      let localAdded = 0;
      for (const sub of cat.subCategories) {
        const existingSub = subByName.get(norm(sub.name));
        if (existingSub) {
          // refresh brands only if JSON provides a non-empty list
          if (Array.isArray(sub.brands) && sub.brands.length) existingSub.brands = sub.brands;
        } else {
          found.subCategories.push({ name: sub.name, brands: sub.brands || [] });
          localAdded++;
        }
      }
      subAdded += localAdded;
      await found.save();
      updated++;
      console.log(`✏️  updated: ${cat.categoryName} (+${localAdded} new subcats)`);
    }

    const orphans = existing.filter(c => !jsonNames.has(norm(c.categoryName)));
    if (orphans.length) {
      console.log('\n⚠️  Categories in DB but NOT in categories.json (left untouched — review manually):');
      orphans.forEach(c => console.log(`   - ${c.categoryName} (${c._id})`));
    }

    console.log(`\n✅ Sync complete. Inserted ${inserted}, updated ${updated}, new subcategories ${subAdded}.`);
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    process.exit(process.exitCode || 0);
  }
};

run();
