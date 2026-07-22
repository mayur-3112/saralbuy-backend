import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import userSchema from '../src/models/user.schema.js';

// NODE_ENV=development (set in vitest.config.js) routes /send-otp and
// /verify-otp to the dev stub controllers, which return the OTP directly
// in the response — the same behavior used for local dev, exercised here
// without needing a real SMS provider.
describe('OTP auth flow', () => {
  it('sends an OTP and verifies it, creating a new user on first login', async () => {
    const phone = '+919876500001';

    const sendRes = await request(app).post('/api/v1/user/send-otp').send({ pNo: phone });
    expect(sendRes.status).toBe(200);
    const otp = sendRes.body.data;
    expect(otp).toBeTruthy();

    const verifyRes = await request(app)
      .post('/api/v1/user/verify-otp')
      .send({ pNo: phone, otp });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.token).toBeTruthy();
    expect(verifyRes.body.data.user.phone).toBe(phone);

    const created = await userSchema.findOne({ phone });
    expect(created).not.toBeNull();
  });

  it('rejects an incorrect OTP', async () => {
    const phone = '+919876500002';
    await request(app).post('/api/v1/user/send-otp').send({ pNo: phone });

    const res = await request(app)
      .post('/api/v1/user/verify-otp')
      .send({ pNo: phone, otp: '000000' });

    expect(res.status).toBe(400);
  });

  it('rejects a request to an auth-gated route with no token', async () => {
    const res = await request(app).get('/api/v1/user/profile');
    expect(res.status).toBe(401);
  });
});
