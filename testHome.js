import https from 'https';

const options = {
  hostname: 'saralbuy-backend-2ndv.onrender.com',
  path: '/api/v1/product/get-home-products',
  method: 'GET'
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response length:', data.length);
    console.log('Response preview:', data.substring(0, 1000));
  });
});

req.on('error', e => console.error(e));
req.end();
