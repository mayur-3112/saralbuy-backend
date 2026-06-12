import '../src/config/env.js';
import mongoCtx from '../src/config/db.config.js';
import Category from '../src/models/category.schema.js';
import mongoose from 'mongoose';

const seedData = [
  {
    categoryName: 'Building Materials',
    title: 'High-quality building materials for construction',
    description: 'Find premium cement, TMT steel bars, bricks, sand, and other essential construction materials.',
    image: '/image/Category/industrialImage.png',
    subCategories: [
      {
        name: 'Cement',
        brands: ['UltraTech', 'ACC', 'Ambuja', 'Birla Gold', 'JK Super'],
      },
      {
        name: 'TMT Steel Bars',
        brands: ['Tata Tiscon', 'JSW NeoSteel', 'SAIL', 'Jindal Panther', 'Vizag Steel'],
      },
      {
        name: 'Bricks & Blocks',
        brands: ['Red Clay Bricks', 'Fly Ash Bricks', 'AAC Blocks', 'Concrete Blocks'],
      },
    ],
  },
  {
    categoryName: 'Electrical & Lights',
    title: 'B2B electrical supplies and industrial lighting',
    description: 'Wires, cables, switchgears, MCBs, and industrial LED lighting solutions.',
    image: '/image/Category/electronicsImage.png',
    subCategories: [
      {
        name: 'Wires & Cables',
        brands: ['Polycab', 'Havells', 'Finolex', 'KEI', 'RR Kabel'],
      },
      {
        name: 'Switchgear & MCBs',
        brands: ['Legrand', 'Schneider Electric', 'L&T', 'Siemens', 'ABB'],
      },
      {
        name: 'LED Lighting',
        brands: ['Philips', 'Syska', 'Wipro', 'Crompton', 'Halonix'],
      },
    ],
  },
  {
    categoryName: 'Plumbing & Sanitary',
    title: 'Industrial pipes, fittings, and bathroom fixtures',
    description: 'A wide range of PVC/CPVC pipes, plumbing fittings, faucets, and sanitaryware.',
    image: '/image/Category/industrialImage.png',
    subCategories: [
      {
        name: 'Pipes & Fittings',
        brands: ['Astral', 'Ashirvad', 'Prince Pipes', 'Supreme', 'Finolex Pipes'],
      },
      {
        name: 'Faucets & Taps',
        brands: ['Jaquar', 'Kohler', 'Hindware', 'Cera', 'Parryware'],
      },
    ],
  },
  {
    categoryName: 'Paints & Waterproofing',
    title: 'Wall paints, primers, and construction chemicals',
    description: 'High-durability exterior/interior paints and waterproofing compounds.',
    image: '/image/Category/industrialImage.png',
    subCategories: [
      {
        name: 'Wall Paints',
        brands: ['Asian Paints', 'Berger', 'Nerolac', 'Dulux', 'Indigo'],
      },
      {
        name: 'Waterproofing',
        brands: ['Dr. Fixit', 'Fosroc', 'Sika', 'Roff'],
      },
    ],
  },
];

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
