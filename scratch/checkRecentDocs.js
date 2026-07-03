import axios from 'axios';

async function checkRecentProductionDocs() {
  try {
    const recentUrl = 'https://saralbuy-backend-2ndv.onrender.com/api/v1/product/get-products-by-title/search?title=&page=1&limit=10';
    console.log('Fetching most recent products from production...');
    const recentRes = await axios.get(recentUrl);
    const allRecent = recentRes.data?.data?.products || [];
    console.log(`Fetched ${allRecent.length} recent products.`);
    
    allRecent.slice(0, 5).forEach(p => {
      console.log(`- ID: ${p._id}, Title: "${p.title}"`);
      console.log(`  Document: "${p.document}"`);
      console.log(`  Items Count: ${p.items?.length || 0}`);
      console.log(`  CreatedAt: ${p.createdAt}`);
    });

  } catch (err) {
    console.error('Error fetching from production API:', err.message);
  }
}

checkRecentProductionDocs();
