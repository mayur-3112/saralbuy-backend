import axios from 'axios';

async function checkProductionCounts() {
  try {
    const trendingUrl = 'https://saralbuy-backend-2ndv.onrender.com/api/v1/product/get-trending-category';
    console.log('Querying production get-trending-category endpoint...');
    const res = await axios.get(trendingUrl);
    
    if (res.data?.data) {
      console.log('Categories returned from API:');
      res.data.data.forEach(item => {
        console.log(`- Category: "${item.category?.categoryName}" (ID: ${item.category?._id})`);
        console.log(`  Count: ${item.productCount}`);
      });
    } else {
      console.log('No trending data returned:', res.data);
    }
  } catch (err) {
    console.error('Error fetching trending data:', err.message);
  }
}

checkProductionCounts();
