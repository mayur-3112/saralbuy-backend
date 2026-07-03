import axios from 'axios';

async function checkIndividualCategoryProducts() {
  try {
    // 1. Get all categories
    const categoriesUrl = 'https://saralbuy-backend-2ndv.onrender.com/api/v1/category/get-category';
    const categoriesRes = await axios.get(categoriesUrl);
    const categories = categoriesRes.data?.data || [];
    
    console.log(`System has ${categories.length} categories.`);
    
    // 2. Fetch products for each active count category to see if they are actually expired
    const activeCats = [
      { name: 'Construction Chemicals, Waterproofing, Paints, Surface Finishes', id: '6a3d6f2dfe9e662e9c064b66' },
      { name: 'Plywood, Hardware', id: '6a3d6f2dfe9e662e9c064b9f' }
    ];

    for (const cat of activeCats) {
      console.log(`\nChecking category: ${cat.name} (ID: ${cat.id})`);
      const searchUrl = `https://saralbuy-backend-2ndv.onrender.com/api/v1/product/get-products-by-title/search?categoryId=${cat.id}&page=1&limit=20`;
      const searchRes = await axios.get(searchUrl);
      const products = searchRes.data?.data?.products || [];
      console.log(`Found ${products.length} matching products from search query.`);
      
      products.forEach(p => {
        console.log(`- Product: "${p.title}" (ID: ${p._id})`);
        console.log(`  bidExpiryDate: ${p.bidExpiryDate}`);
        console.log(`  isExpired? : ${p.bidExpiryDate ? (new Date(p.bidExpiryDate).getTime() < Date.now()) : 'No expiry set'}`);
      });
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkIndividualCategoryProducts();
