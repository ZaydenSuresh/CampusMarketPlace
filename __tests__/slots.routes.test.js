const request = require('supertest');
const express = require('express');

jest.mock('../database', () => ({
  from: jest.fn()
}));

const db = require('../database');
const router = require('../routes/slots');

const app = express();
app.use(express.json());
app.use('/slots', router);

describe('Slots routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ================= GET =================
  test('GET /slots returns upcoming slots from database', async () => {
    const mockData = [
      { id: 1, date: '2026-04-21', time: '09:00', capacity: 3, booked_count: 1 }
    ];

    const mockChain = {
      select: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn(),
    };
    mockChain.order = jest.fn()
      .mockReturnValueOnce(mockChain)
      .mockReturnValueOnce(Promise.resolve({ data: mockData, error: null }));

    db.from.mockReturnValue(mockChain);

    const res = await request(app).get('/slots');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(1);
    expect(res.body[0].date).toBe('2026-04-21');
    expect(res.body[0].time).toBe('9:00 AM');
    expect(res.body[0].capacity).toBe(3);
    expect(res.body[0].bookedCount).toBe(1);
  });

  test('GET /slots returns empty array when no slots exist', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn(),
    };
    mockChain.order = jest.fn()
      .mockReturnValueOnce(mockChain)
      .mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

    db.from.mockReturnValue(mockChain);

    const res = await request(app).get('/slots');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('GET /slots returns 500 on database error', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn(),
    };
    mockChain.order = jest.fn()
      .mockReturnValueOnce(mockChain)
      .mockReturnValueOnce(Promise.resolve({ data: null, error: { message: 'DB error' } }));

    db.from.mockReturnValue(mockChain);

    const res = await request(app).get('/slots');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to load slots');
  });

  // ================= CREATE =================
  test('POST /slots returns 400 when fields are missing', async () => {
    const res = await request(app).post('/slots').send({
      date: '2026-04-20'
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Date, time and capacity required');
  });

  test('POST /slots creates a slot', async () => {
    db.from.mockReturnValue({
      insert: () => ({
        select: () =>
          Promise.resolve({
            data: [{ id: 1 }],
            error: null
          })
      })
    });

    const res = await request(app).post('/slots').send({
      date: '2026-04-21',
      time: '09:00',
      capacity: 3
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Slot created successfully');
  });

  // ================= DELETE =================
  test('DELETE /slots/:id deletes slot', async () => {
    db.from.mockReturnValue({
      delete: () => ({
        eq: () => Promise.resolve({ error: null })
      })
    });

    const res = await request(app).delete('/slots/5');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Slot deleted successfully');
  });

  // ================= BOOK =================
  test('POST /slots/book reduces capacity', async () => {
    db.from
      // fetch slot
      .mockReturnValueOnce({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [{ id: 1, capacity: 3, booked_count: 1 }],
              error: null
            })
        })
      })
      // update slot
      .mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            select: () =>
              Promise.resolve({
                data: [{ id: 1, capacity: 3, booked_count: 2 }],
                error: null
              })
          })
        })
      });

    const res = await request(app).post('/slots/book').send({ id: 1 });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Slot booked successfully');
  });

  test('POST /slots/book fails if slot is full', async () => {
    db.from.mockReturnValue({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [{ id: 1, capacity: 2, booked_count: 2 }],
            error: null
          })
      })
    });

    const res = await request(app).post('/slots/book').send({ id: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Slot is full');
  });

  // ================= PUT =================
  test('PUT /slots/:id updates a slot', async () => {
    db.from
      // fetch existing
      .mockReturnValueOnce({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [{ id: 1, capacity: 5, booked_count: 2 }],
              error: null
            })
        })
      })
      // update
      .mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            select: () =>
              Promise.resolve({
                data: [{ id: 1, capacity: 5 }],
                error: null
              })
          })
        })
      });

    const res = await request(app).put('/slots/1').send({
      date: '2026-04-22',
      time: '10:30',
      capacity: 5
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Slot updated successfully');
  });
});