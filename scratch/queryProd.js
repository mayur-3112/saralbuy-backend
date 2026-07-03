import axios from 'axios';

async function checkProductionProduct() {
  try {
    const searchUrl = 'https://saralbuy-backend-2ndv.onrender.com/api/v1/product/get-products-by-title/search?title=Tiles&page=1&limit=50';
    console.log('Searching production products...');
    const searchRes = await axios.get(searchUrl);
    const products = searchRes.data?.data?.products || [];
    console.log(`Found ${products.length} products on production matching 'Tiles'.`);
    
    const target = products.find(p => p._id.toString().toLowerCase().endsWith('d1fe42'));
    if (target) {
      console.log('--- FOUND IN SEARCH ---');
      console.log('ID:', target._id);
      console.log('Title:', target.title);
      console.log('Description:', target.description);
      console.log('Items:', JSON.stringify(target.items, null, 2));
      return;
    }

    console.log('Product not found in search. Fetching all recent products to look for endsWith d1fe42...');
    const recentUrl = 'https://saralbuy-backend-2ndv.onrender.com/api/v1/product/get-products-by-title/search?title=&page=1&limit=100';
    const recentRes = await axios.get(recentUrl);
    const allRecent = recentRes.data?.data?.products || [];
    console.log(`Fetched ${allRecent.length} recent products.`);
    const matched = allRecent.find(p => p._id.toString().toLowerCase().endsWith('d1fe42'));
    if (matched) {
      console.log('--- FOUND IN RECENT ---');
      console.log('ID:', matched._id);
      console.log('Title:', matched.title);
      console.log('Description:', matched.description);
      console.log('Items:', JSON.stringify(matched.items, null, 2));
      return;
    }

    console.log('Product ending in d1fe42 not found.');
    console.log('Available product IDs in recent 20:');
    allRecent.slice(0, 20).forEach(p => {
      console.log(`- ID: ${p._id}, Title: "${p.title}", EndsWith: ${p._id.toString().slice(-6)}`);
    });

  } catch (err) {
    console.error('Error fetching from production API:', err.message);
  }
}

checkProductionProduct();
