import express from 'express';

const router = express.Router();

const CATEGORY_IMAGES = [
  { name: 'Building Materials', url: '/category-images/building-materials.png' },
  { name: 'Electrical Supplies', url: '/category-images/electrical-supplies.png' },
  { name: 'Plumbing & Sanitary', url: '/category-images/plumbing-sanitary.png' },
  { name: 'Hardware & Tools', url: '/category-images/hardware-tools.png' },
  { name: 'Paint & Coatings', url: '/category-images/paint-coatings.png' },
  { name: 'Steel & Iron', url: '/category-images/steel-iron.png' },
  { name: 'Cement & Concrete', url: '/category-images/cement-concrete.png' },
  { name: 'Wood & Timber', url: '/category-images/wood-timber.png' },
  { name: 'Glass & Ceramics', url: '/category-images/glass-ceramics.png' },
  { name: 'Safety Equipment', url: '/category-images/safety-equipment.png' },
];

router.get('/category-images', (req, res) => {
  return res.status(200).json(CATEGORY_IMAGES);
});

export default router;
