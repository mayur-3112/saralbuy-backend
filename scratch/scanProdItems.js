import axios from 'axios';

async function checkProductionProductsForItems() {
  try {
    const recentUrl = 'https://saralbuy-backend-2ndv.onrender.com/api/v1/product/get-products-by-title/search?title=&page=1&limit=100';
    console.log('Fetching recent products...');
    const recentRes = await axios.get(recentUrl);
    const allRecent = recentRes.data?.data?.products || [];
    console.log(`Fetched ${allRecent.length} recent products.`);
    
    const withItems = allRecent.filter(p => p.items && p.items.length > 0);
    console.log(`Found ${withItems.length} products with non-empty items array.`);
    withItems.forEach(p => {
      console.log(`- ID: ${p._id}, Title: "${p.title}", Items count: ${p.items.length}`);
      console.log('  Items:', JSON.stringify(p.items, null, 2));
    });

  } catch (err) {
    console.error('Error fetching from production API:', err.message);
  }
}

checkProductionProductsForItems();
