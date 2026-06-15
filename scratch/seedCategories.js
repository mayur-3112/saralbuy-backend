import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import Category from '../src/models/category.schema.js';

const CATEGORIES = [
  {
    categoryName: 'Cement and Concrete',
    title: 'Cement, RMC & Concrete Products',
    description: 'All types of cement, ready-mix concrete, and precast products for construction.',
    image: '/image/Category/buildingMaterials.png',
    subCategories: [
      { name: 'Cement', brands: [] },
      { name: 'RMC', brands: [] },
      { name: 'Dry Mix Mortars', brands: [] },
      { name: 'Precast Concrete Products', brands: [] },
    ],
  },
  {
    categoryName: 'Steel and Structural Materials',
    title: 'TMT Bars, Structural Steel & Metal Products',
    description: 'Steel bars, sections, mesh, and structural metal materials for construction.',
    image: '/image/Category/industrialImage.png',
    subCategories: [
      { name: 'TMT Bars', brands: [] },
      { name: 'Structural Steel', brands: [] },
      { name: 'Steel Sections', brands: [] },
      { name: 'MS Products', brands: [] },
      { name: 'GI Products', brands: [] },
      { name: 'Wire Rods', brands: [] },
      { name: 'Steel Mesh', brands: [] },
    ],
  },
  {
    categoryName: 'Construction Chemicals, Waterproofing, Paints, Surface Finishes',
    title: 'Waterproofing, Paints & Surface Coatings',
    description: 'Waterproofing systems, paints, adhesives, sealants, and surface finishing products.',
    image: '/image/Category/paintsWaterproofing.png',
    subCategories: [
      { name: 'Waterproofing Systems', brands: [] },
      { name: 'Admixtures', brands: [] },
      { name: 'Tile Adhesives', brands: [] },
      { name: 'Grouts', brands: [] },
      { name: 'Repair Mortars', brands: [] },
      { name: 'Sealants', brands: [] },
      { name: 'Epoxy Systems', brands: [] },
      { name: 'Protective Coatings', brands: [] },
      { name: 'Decorative Paints', brands: [] },
      { name: 'Industrial Coatings', brands: [] },
      { name: 'Primers', brands: [] },
      { name: 'Putty', brands: [] },
      { name: 'Textures', brands: [] },
      { name: 'Specialty Finishes', brands: [] },
    ],
  },
  {
    categoryName: 'Tiles, Stones & Flooring',
    title: 'Ceramic Tiles, Marble, Granite & Flooring Solutions',
    description: 'All types of tiles, natural stones, and flooring materials.',
    image: '/image/Category/flooringTiles.png',
    subCategories: [
      { name: 'Ceramic Tiles', brands: [] },
      { name: 'Vitrified Tiles', brands: [] },
      { name: 'Marble', brands: [] },
      { name: 'Granite', brands: [] },
      { name: 'Quartz', brands: [] },
      { name: 'Natural Stone', brands: [] },
      { name: 'Wooden Flooring', brands: [] },
      { name: 'Vinyl Flooring', brands: [] },
      { name: 'Epoxy Flooring', brands: [] },
    ],
  },
  {
    categoryName: 'Plumbing & Sanitary',
    title: 'Pipes, Fittings, Sanitaryware & Bathroom Products',
    description: 'Plumbing pipes, fittings, valves, sanitaryware, and bathroom accessories.',
    image: '/image/Category/plumbingSanitary.png',
    subCategories: [
      { name: 'CPVC Pipes', brands: [] },
      { name: 'UPVC Pipes', brands: [] },
      { name: 'SWR Pipes', brands: [] },
      { name: 'HDPE Pipes', brands: [] },
      { name: 'GI Pipes', brands: [] },
      { name: 'Valves', brands: [] },
      { name: 'Plumbing Accessories', brands: [] },
      { name: 'Toilets', brands: [] },
      { name: 'Basins', brands: [] },
      { name: 'Faucets', brands: [] },
      { name: 'Showers', brands: [] },
      { name: 'Bathroom Accessories', brands: [] },
    ],
  },
  {
    categoryName: 'Electrical, Lighting, Solar, Energy Products',
    title: 'Wires, Switches, Lighting & Solar Energy Solutions',
    description: 'Electrical wiring, switches, lighting, solar panels, and energy products.',
    image: '/image/Category/electricalLights.png',
    subCategories: [
      { name: 'Wires', brands: [] },
      { name: 'Cables', brands: [] },
      { name: 'Switches', brands: [] },
      { name: 'MCBs', brands: [] },
      { name: 'Distribution Boards', brands: [] },
      { name: 'Panels', brands: [] },
      { name: 'Lighting Products', brands: [] },
      { name: 'Solar Panels', brands: [] },
      { name: 'Inverters', brands: [] },
      { name: 'Batteries', brands: [] },
      { name: 'Solar Water Heaters', brands: [] },
      { name: 'EV Chargers', brands: [] },
    ],
  },
  {
    categoryName: 'Glass, Aluminium, Facade',
    title: 'Architectural Glass, Aluminium & Facade Systems',
    description: 'Glass products, aluminium sections, ACP sheets, and facade solutions.',
    image: '/image/Category/electronicsImage.png',
    subCategories: [
      { name: 'Architectural Glass', brands: [] },
      { name: 'Toughened Glass', brands: [] },
      { name: 'Aluminium Sections', brands: [] },
      { name: 'ACP Sheets', brands: [] },
      { name: 'Facade Systems', brands: [] },
    ],
  },
  {
    categoryName: 'Plywood, Hardware',
    title: 'Doors, Windows, Plywood & Decorative Materials',
    description: 'Wooden and steel doors, windows, plywood, laminates, and hardware fittings.',
    image: '/image/Category/interiorFurniture.png',
    subCategories: [
      { name: 'Wooden Doors', brands: [] },
      { name: 'Steel Doors', brands: [] },
      { name: 'Fire Doors', brands: [] },
      { name: 'uPVC Windows', brands: [] },
      { name: 'Aluminium Windows', brands: [] },
      { name: 'Locks', brands: [] },
      { name: 'Hinges', brands: [] },
      { name: 'Architectural Hardware', brands: [] },
      { name: 'Plywood', brands: [] },
      { name: 'MDF', brands: [] },
      { name: 'HDF', brands: [] },
      { name: 'Particle Boards', brands: [] },
      { name: 'Block Boards', brands: [] },
      { name: 'Veneers', brands: [] },
      { name: 'Laminates', brands: [] },
      { name: 'Decorative Panels', brands: [] },
      { name: 'Wall Cladding', brands: [] },
      { name: 'Wallpapers', brands: [] },
    ],
  },
  {
    categoryName: 'Industrial Tools',
    title: 'Hand Tools, Power Tools & Construction Equipment',
    description: 'Tools and equipment for construction, welding, and industrial use.',
    image: '/image/Category/hardwareTools.png',
    subCategories: [
      { name: 'Hand Tools', brands: [] },
      { name: 'Power Tools', brands: [] },
      { name: 'Construction Equipment', brands: [] },
      { name: 'Welding Equipment', brands: [] },
      { name: 'Generators', brands: [] },
      { name: 'Compressors', brands: [] },
    ],
  },
  {
    categoryName: 'Others',
    title: 'Sand, Aggregates, Roofing, HVAC, Safety & More',
    description: 'Sand, aggregates, roofing, HVAC, fire safety, security systems, landscaping, and other construction materials.',
    image: '/image/Category/safetyEquipment.png',
    subCategories: [
      { name: 'M-Sand', brands: [] },
      { name: 'P-Sand', brands: [] },
      { name: 'Aggregates/Jelly', brands: [] },
      { name: 'Quarry Products', brands: [] },
      { name: 'Water Tanks', brands: [] },
      { name: 'Pumps', brands: [] },
      { name: 'Sewage Treatment Equipment', brands: [] },
      { name: 'Water Treatment Systems', brands: [] },
      { name: 'Roofing Sheets', brands: [] },
      { name: 'Metal Roof Systems', brands: [] },
      { name: 'Polycarbonate Sheets', brands: [] },
      { name: 'False Ceiling Materials', brands: [] },
      { name: 'Insulation Materials', brands: [] },
      { name: 'Chillers', brands: [] },
      { name: 'Ducting', brands: [] },
      { name: 'Ventilation Equipment', brands: [] },
      { name: 'Industrial Cooling Systems', brands: [] },
      { name: 'Fire Extinguishers', brands: [] },
      { name: 'Sprinklers', brands: [] },
      { name: 'Fire Alarm Systems', brands: [] },
      { name: 'PPE', brands: [] },
      { name: 'CCTV', brands: [] },
      { name: 'Access Control Systems', brands: [] },
      { name: 'Elevators', brands: [] },
      { name: 'Escalators', brands: [] },
      { name: 'Scaffolding', brands: [] },
      { name: 'Formwork Systems', brands: [] },
      { name: 'Shuttering Materials', brands: [] },
      { name: 'Pavers', brands: [] },
      { name: 'Kerb Stones', brands: [] },
      { name: 'Artificial Grass', brands: [] },
      { name: 'Fencing Materials', brands: [] },
      { name: 'Outdoor Furniture', brands: [] },
    ],
  },
];

async function seedCategories() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.DB_CTX;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI / DB_CTX not found in .env.local');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check existing categories
    const existing = await Category.find({});
    console.log(`\nFound ${existing.length} existing categories:`);
    existing.forEach(c => console.log(`  - ${c.categoryName} (${c.subCategories.length} subcategories)`));

    // Insert new categories (skip if name already exists)
    let added = 0;
    let skipped = 0;

    for (const cat of CATEGORIES) {
      const exists = existing.find(e => 
        e.categoryName.toLowerCase().trim() === cat.categoryName.toLowerCase().trim()
      );
      if (exists) {
        console.log(`⏭️  Skipping "${cat.categoryName}" — already exists`);
        skipped++;
        continue;
      }

      const created = await Category.create(cat);
      console.log(`✅ Created "${cat.categoryName}" with ${cat.subCategories.length} subcategories (ID: ${created._id})`);
      added++;
    }

    console.log(`\n========== SEED COMPLETE ==========`);
    console.log(`Added: ${added} | Skipped: ${skipped} | Total now: ${existing.length + added}`);
    console.log(`===================================\n`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seedCategories();
