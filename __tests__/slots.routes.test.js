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

test('PUT /slots/:id updates a slot', async () => {
  // Mock DB to simulate NOT implemented yet (force failure)
  const updateMock = jest.fn().mockReturnThis();
  const eqMock = jest.fn().mockReturnThis();
  const selectMock = jest.fn().mockResolvedValue({
    data: [{ id: 1, date: '2026-04-22', time: '10:30:00', capacity: 5 }],
    error: null
  });

  db.__mockFrom.mockReturnValue({
    update: updateMock,
    eq: eqMock,
    select: selectMock
  });

  const res = await request(app).put('/slots/1').send({
    date: '2026-04-22',
    time: '10:30',
    capacity: 5
  });

  // EXPECT SUCCESS (but it will FAIL because route not implemented yet)
  expect(res.status).toBe(200);
  expect(res.body.message).toBe('Slot updated successfully');
});

test('POST /slots/book reduces capacity', async () => {
  // Step 1: mock existing slot
  const selectMock = jest.fn().mockResolvedValue({
    data: [{ id: 1, capacity: 5, booked_count: 2 }],
    error: null
  });

  const updateMock = jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue({ error: null })
  });

  db.__mockFrom.mockReturnValue({
    select: selectMock,
    update: updateMock
  });

  const res = await request(app).post('/slots/book').send({
    id: 1
  });

  expect(res.status).toBe(200);
  expect(res.body.message).toBe('Slot booked successfully');
});

//Test: prevent overbooking
test('POST /slots/book fails if slot is full', async () => {
  const selectMock = jest.fn().mockResolvedValue({
    data: [{ id: 1, capacity: 3, booked_count: 3 }],
    error: null
  });

  db.__mockFrom.mockReturnValue({
    select: selectMock
  });

  const res = await request(app).post('/slots/book').send({
    id: 1
  });

  expect(res.status).toBe(400);
  expect(res.body.error).toBe('Slot is full');
});

//Test: slot disappears when full
test('GET /slots does not return full slots', async () => {
  const selectMock = jest.fn().mockResolvedValue({
    data: [
      { id: 1, capacity: 2, booked_count: 2 }, // FULL
      { id: 2, capacity: 3, booked_count: 1 }  // AVAILABLE
    ],
    error: null
  });

  db.__mockFrom.mockReturnValue({
    select: selectMock,
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis()
  });

  const res = await request(app).get('/slots?date=2026-04-21');

  expect(res.body.length).toBe(1); // only available slot
});