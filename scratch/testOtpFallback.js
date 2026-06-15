async function testOtp() {
  const pNo = '9876543210';
  console.log('1. Requesting OTP for number:', pNo);
  
  try {
    const sendResponse = await fetch('https://saralbuy-backend-2ndv.onrender.com/api/v1/user/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pNo })
    });
    
    const sendData = await sendResponse.json();
    console.log('Send OTP response:', JSON.stringify(sendData, null, 2));
    
    if (sendResponse.status !== 200 && sendData.statusCode !== 200) {
      console.error('Failed to request OTP');
      process.exit(1);
    }
    
    const sessionId = sendData.data.sessionId;
    console.log('Received sessionId:', sessionId);
    
    console.log('2. Verifying OTP with mock code: 123456');
    const verifyResponse = await fetch('https://saralbuy-backend-2ndv.onrender.com/api/v1/user/verify-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pNo,
        otp: '123456',
        sessionId
      })
    });
    
    const verifyData = await verifyResponse.json();
    console.log('Verify OTP response:', JSON.stringify(verifyData, null, 2));
    
    if (verifyResponse.status === 200 || verifyData.statusCode === 200) {
      console.log('✅ OTP FALLBACK FLOW VERIFIED SUCCESSFULLY!');
    } else {
      console.error('❌ OTP verification failed!');
      process.exit(1);
    }
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testOtp();
