import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import userSchema from '../src/models/user.schema.js';

describe('Admin login rate limiting', () => {
  const email = 'admin@saralbuy-test.com';

  beforeEach(async () => {
    await userSchema.create({
      email,
      password: 'correct-password',
      phone: '+919876500099',
      role: 'admin',
    });
  });

  it('allows attempts under the limit', async () => {
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email, password: 'wrong-password' });
    // Wrong password, but not yet rate-limited — a normal 401.
    expect(res.status).toBe(401);
  });

  it('blocks after 5 attempts for the same email within the window', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ email, password: 'wrong-password' });
    }

    const sixth = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email, password: 'wrong-password' });

    expect(sixth.status).toBe(429);
  });

  it('does not block a different email after another one is rate-limited', async () => {
    for (let i = 0; i < 6; i++) {
      await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ email, password: 'wrong-password' });
    }

    const otherEmail = 'other-admin@saralbuy-test.com';
    await userSchema.create({
      email: otherEmail,
      password: 'correct-password',
      phone: '+919876500098',
      role: 'admin',
    });

    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: otherEmail, password: 'correct-password' });

    expect(res.status).toBe(200);
  });
});
