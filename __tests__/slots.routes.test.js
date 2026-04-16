const request = require('supertest');
const express = require('express');

jest.mock('../database', () => {
  const mockFrom = jest.fn();

  return {
    from: mockFrom,
    __mockFrom: mockFrom
  };
});

const db = require('../database');
const router = require('../routes/slots');

const app = express();
app.use(express.json());
app.use('/slots', router);

describe('Slots routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /slots returns 400 if date is missing', async () => {
    const res = await request(app).get('/slots');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Date required');
  });

  test('GET /slots returns [] on weekend', async () => {
    const res = await request(app).get('/slots?date=2026-04-18'); // Saturday
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('POST /slots returns 400 when fields are missing', async () => {
    const res = await request(app).post('/slots').send({
      date: '2026-04-20'
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Date, time and capacity are required');
  });

  test('POST /slots creates a slot', async () => {
    // FIXED MOCK: matches .insert().select()
    const selectMock = jest.fn().mockResolvedValue({
      data: [{ id: 1 }],
      error: null
    });

    const insertMock = jest.fn().mockReturnValue({
      select: selectMock
    });

    db.__mockFrom.mockReturnValue({
      insert: insertMock
    });

    const res = await request(app).post('/slots').send({
      date: '2026-04-21',
      time: '09:00',
      capacity: 3
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Slot created successfully');
  });

  test('DELETE /slots/:id deletes slot', async () => {
    const eqMock = jest.fn().mockResolvedValue({ error: null });

    const deleteMock = jest.fn().mockReturnValue({
      eq: eqMock
    });

    db.__mockFrom.mockReturnValue({
      delete: deleteMock
    });

    const res = await request(app).delete('/slots/5');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Slot deleted successfully');
  });
});