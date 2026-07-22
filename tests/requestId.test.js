import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Request correlation ID', () => {
  it('generates one and echoes it back when the client sends none', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('reuses the id the client already generated, rather than replacing it', async () => {
    const clientId = 'frontend-generated-id-123';
    const res = await request(app).get('/health').set('X-Request-Id', clientId);
    expect(res.headers['x-request-id']).toBe(clientId);
  });

  it('generates a different id per request when the client sends none', async () => {
    const res1 = await request(app).get('/health');
    const res2 = await request(app).get('/health');
    expect(res1.headers['x-request-id']).not.toBe(res2.headers['x-request-id']);
  });
});
