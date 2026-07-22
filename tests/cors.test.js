import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('CORS allow-list', () => {
  const original = process.env.CLIENT_URL;
  beforeAll(() => {
    process.env.CLIENT_URL = 'http://localhost:5173';
  });
  afterAll(() => {
    process.env.CLIENT_URL = original;
  });

  it('allows the real frontend origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('rejects an arbitrary *.vercel.app origin — the previous wildcard hole', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://some-attacker-project.vercel.app');
    // cors() surfaces a disallowed origin as no ACAO header (browser then
    // blocks the response), not a 4xx/5xx status.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects an arbitrary *.netlify.app origin', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://some-attacker-project.netlify.app');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects a random unrelated origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows requests with no Origin header (server-to-server, curl)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
