import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, teardownApp, cleanupDatabase, TEST_USER } from './setup';

describe('E2E Tests (with mocked services)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanupDatabase();
  });

  afterAll(async () => {
    await teardownApp(app);
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  describe('Auth Endpoints', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(TEST_USER)
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should reject duplicate registration', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(TEST_USER)
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(TEST_USER)
        .expect(409);
    });

    it('should handle invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Test123!@#',
        })
        .expect(400);
    });
  });

  describe('API Health', () => {
    it('should have working endpoints after setup', async () => {
      // Register a user
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send(TEST_USER)
        .expect(201);

      expect(registerRes.body).toBeDefined();
      expect(registerRes.body.ok).toBe(true);
    });
  });
});
