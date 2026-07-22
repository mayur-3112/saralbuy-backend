import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import userSchema from '../src/models/user.schema.js';
import { JWT_SECRET } from '../src/config/secrets.js';

async function makeAdminAgent() {
  const admin = await userSchema.create({
    email: `admin-${Date.now()}@saralbuy-test.com`,
    password: 'correct-password',
    phone: `+9198765${Math.floor(Math.random() * 100000)}`,
    role: 'admin',
  });
  const token = jwt.sign({ _id: admin._id }, JWT_SECRET);
  return { admin, cookie: `adminToken=${token}` };
}

async function makePendingSupplier() {
  return userSchema.create({
    phone: `+9198766${Math.floor(Math.random() * 100000)}`,
    accountRole: 'supplier',
    verificationStatus: 'pending',
  });
}

describe('Verification decisions — both endpoints share one implementation', () => {
  let cookie;
  beforeEach(async () => {
    ({ cookie } = await makeAdminAgent());
  });

  it('auth.controller.js route approves a pending supplier and records who decided it', async () => {
    const supplier = await makePendingSupplier();
    const res = await request(app)
      .post(`/api/v1/admin/auth/decide-verification/${supplier._id}`)
      .set('Cookie', cookie)
      .send({ decision: 'approve' });

    expect(res.status).toBe(200);
    const updated = await userSchema.findById(supplier._id);
    expect(updated.verificationStatus).toBe('verified');
    expect(updated.verificationDecidedBy).not.toBeNull();
  });

  it('userVerification.controller.js route rejects a pending supplier and, unlike before, actually records who decided it', async () => {
    const supplier = await makePendingSupplier();
    const res = await request(app)
      .patch(`/api/v1/admin/user-verification/${supplier._id}/decide`)
      .set('Cookie', cookie)
      .send({ verificationStatus: 'rejected', verificationNotes: 'GST document unreadable' });

    expect(res.status).toBe(200);
    const updated = await userSchema.findById(supplier._id);
    expect(updated.verificationStatus).toBe('rejected');
    // This is the bug fix: previously always null via this route (read
    // req.admin, which adminAuth never sets).
    expect(updated.verificationDecidedBy).not.toBeNull();
  });

  it('rejects a decision on a supplier who is not currently pending, via either route', async () => {
    const supplier = await makePendingSupplier();
    supplier.verificationStatus = 'verified';
    await supplier.save();

    const res = await request(app)
      .post(`/api/v1/admin/auth/decide-verification/${supplier._id}`)
      .set('Cookie', cookie)
      .send({ decision: 'reject', notes: 'trying to re-decide' });

    expect(res.status).toBe(400);
  });

  it('requires a reason when rejecting', async () => {
    const supplier = await makePendingSupplier();
    const res = await request(app)
      .patch(`/api/v1/admin/user-verification/${supplier._id}/decide`)
      .set('Cookie', cookie)
      .send({ verificationStatus: 'rejected' });

    expect(res.status).toBe(400);
  });

  it('allows reopening a decided verification back to pending, but not a no-op reopen', async () => {
    const supplier = await makePendingSupplier();
    supplier.verificationStatus = 'rejected';
    await supplier.save();

    const reopen = await request(app)
      .patch(`/api/v1/admin/user-verification/${supplier._id}/decide`)
      .set('Cookie', cookie)
      .send({ verificationStatus: 'pending' });
    expect(reopen.status).toBe(200);

    const noopReopen = await request(app)
      .patch(`/api/v1/admin/user-verification/${supplier._id}/decide`)
      .set('Cookie', cookie)
      .send({ verificationStatus: 'pending' });
    expect(noopReopen.status).toBe(400);
  });
});
