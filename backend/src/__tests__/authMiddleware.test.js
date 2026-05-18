const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const authMiddleware = require('../middleware/auth');

// 테스트용 최소 Express 앱 (DB 연결 없음)
function createApp() {
  const app = express();
  app.use(cookieParser());
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ userId: req.user.id });
  });
  return app;
}

const app = createApp();

function makeToken(payload = { id: 1, nickname: '테스터' }, secret = 'test-secret-key') {
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

describe('authMiddleware', () => {
  test('A1: 토큰 없는 요청 → 401', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  test('A2: 만료된 JWT → 401', async () => {
    const expired = jwt.sign({ id: 1 }, 'test-secret-key', { expiresIn: '-1s' });
    const res = await request(app)
      .get('/protected')
      .set('Cookie', `accessToken=${expired}`);
    expect(res.status).toBe(401);
  });

  test('A3: 위조된 JWT(다른 secret) → 401', async () => {
    const forged = jwt.sign({ id: 1 }, 'wrong-secret');
    const res = await request(app)
      .get('/protected')
      .set('Cookie', `accessToken=${forged}`);
    expect(res.status).toBe(401);
  });

  test('A4: 유효한 JWT — 쿠키 방식 → 통과', async () => {
    const token = makeToken();
    const res = await request(app)
      .get('/protected')
      .set('Cookie', `accessToken=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(1);
  });

  test('A5: 유효한 JWT — Authorization Bearer 헤더 방식 → 통과', async () => {
    const token = makeToken();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(1);
  });
});
