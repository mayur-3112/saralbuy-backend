import https from 'https';

const options = {
  hostname: 'saralbuy-backend-2ndv.onrender.com',
  path: '/api/v1/requirement/my-requirements?page=1&limit=10',
  method: 'GET',
  headers: {
    'Cookie': 'authToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2YTJjNDBkYWY2MWQ1MWIwNDNjZDBkZTEiLCJlbWFpbCI6Im1heXVyMzExYWdhcndhbEBnbWFpbC5jb20iLCJpYXQiOjE3ODI0OTUwNDQsImV4cCI6MTc4NTA4NzA0NH0.iolJ53fc7BFGycRscLo0JhO8wrR8I2MQxcy1cuDFtBw'
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', e => console.error(e));
req.end();
