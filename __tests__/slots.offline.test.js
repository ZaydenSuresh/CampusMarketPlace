const request = require('supertest');
const express = require('express');

jest.mock('../database', () => {
  throw new Error('Database module not found');
});

const router = require('../routes/slots');

const app = express();
app.use(express.json());
app.use('/slots', router);

describe('Slots routes - database unavailable', () => {
  test('GET /slots returns 503', async () => {
    const res = await request(app).get('/slots');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Database not available');
  });

  test('POST /slots returns 503', async () => {
    const res = await request(app)
      .post('/slots')
      .send({ date: '2026-04-21', time: '09:00', capacity: 3 });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Database not available');
  });

  test('PUT /slots/:id returns 503', async () => {
    const res = await request(app)
      .put('/slots/1')
      .send({ date: '2026-04-21', time: '09:00', capacity: 3 });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Database not available');
  });

  test('DELETE /slots/:id returns 503', async () => {
    const res = await request(app).delete('/slots/1');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Database not available');
  });

  test('POST /slots/book returns 503', async () => {
    const res = await request(app)
      .post('/slots/book')
      .send({ id: 1 });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Database not available');
  });
});
