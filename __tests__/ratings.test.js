const request = require('supertest');
const express = require('express');

jest.mock('../lib/supabase', () => ({
  createSupabaseClient: jest.fn(),
}));

const { createSupabaseClient } = require('../lib/supabase');
const ratingsRouter = require('../routes/ratings');

const app = express();
app.use(express.json());
app.use('/ratings', ratingsRouter);

describe('Ratings routes', () => {
  let mockSupabaseClient;

  function singleChain(result) {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(result),
    };
  }

  function maybeSingleChain(result) {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue(result),
    };
  }

  function insertChain(result) {
    return {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(result),
    };
  }

  function thenableChain(data, error = null) {
    const result = { data, error };
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    };
    chain.then = (resolve) => resolve(result);
    return chain;
  }

  function simpleThenableChain(data, error = null) {
    const result = { data, error };
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    chain.then = (resolve) => resolve(result);
    return chain;
  }

  function mockAuth(userId) {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
  }

  function mockNoAuth() {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabaseClient = {
      auth: { getUser: jest.fn() },
      from: jest.fn(),
    };

    createSupabaseClient.mockReturnValue(mockSupabaseClient);
  });

  // ============ POST / ============
  describe('POST /', () => {
    const validBody = {
      rated_id: 'user-2',
      transaction_id: 'tx-1',
      rating: 4,
    };

    test('returns 401 when not authenticated', async () => {
      mockNoAuth();

      const res = await request(app).post('/ratings').send(validBody);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Not authenticated' });
    });

    test('returns 400 when rated_id is missing', async () => {
      mockAuth('user-1');

      const res = await request(app)
        .post('/ratings')
        .send({ transaction_id: 'tx-1', rating: 4 });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'rated_id, transaction_id, and rating are required' });
    });

    test('returns 400 when transaction_id is missing', async () => {
      mockAuth('user-1');

      const res = await request(app)
        .post('/ratings')
        .send({ rated_id: 'user-2', rating: 4 });
      expect(res.status).toBe(400);
    });

    test('returns 400 when rating is missing', async () => {
      mockAuth('user-1');

      const res = await request(app)
        .post('/ratings')
        .send({ rated_id: 'user-2', transaction_id: 'tx-1' });
      expect(res.status).toBe(400);
    });

    test('returns 400 when rating is not an integer', async () => {
      mockAuth('user-1');

      const res = await request(app)
        .post('/ratings')
        .send({ ...validBody, rating: 2.5 });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Rating must be an integer between 1 and 5' });
    });

    test('returns 400 when rating is less than 1', async () => {
      mockAuth('user-1');

      const res = await request(app)
        .post('/ratings')
        .send({ ...validBody, rating: 0 });
      expect(res.status).toBe(400);
    });

    test('returns 400 when rating is greater than 5', async () => {
      mockAuth('user-1');

      const res = await request(app)
        .post('/ratings')
        .send({ ...validBody, rating: 6 });
      expect(res.status).toBe(400);
    });

    test('returns 404 when transaction not found', async () => {
      mockAuth('user-1');
      mockSupabaseClient.from.mockReturnValueOnce(
        singleChain({ data: null, error: { message: 'not found' } })
      );

      const res = await request(app).post('/ratings').send(validBody);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Transaction not found' });
    });

    test('returns 400 when transaction is not completed', async () => {
      mockAuth('user-1');
      mockSupabaseClient.from.mockReturnValueOnce(
        singleChain({
          data: { id: 'tx-1', buyer_id: 'user-1', seller_id: 'user-2', status: 'pending' },
          error: null,
        })
      );

      const res = await request(app).post('/ratings').send(validBody);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Can only rate completed transactions' });
    });

    test('returns 403 when user is not part of the transaction', async () => {
      mockAuth('user-3');
      mockSupabaseClient.from.mockReturnValueOnce(
        singleChain({
          data: { id: 'tx-1', buyer_id: 'user-1', seller_id: 'user-2', status: 'completed' },
          error: null,
        })
      );

      const res = await request(app).post('/ratings').send(validBody);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'You are not part of this transaction' });
    });

    test('returns 400 when rating yourself', async () => {
      mockAuth('user-1');
      mockSupabaseClient.from.mockReturnValueOnce(
        singleChain({
          data: { id: 'tx-1', buyer_id: 'user-1', seller_id: 'user-2', status: 'completed' },
          error: null,
        })
      );

      const res = await request(app)
        .post('/ratings')
        .send({ ...validBody, rated_id: 'user-1' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Cannot rate yourself' });
    });

    test('returns 500 when duplicate check fails', async () => {
      mockAuth('user-1');
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({
          data: { id: 'tx-1', buyer_id: 'user-1', seller_id: 'user-2', status: 'completed' },
          error: null,
        }))
        .mockReturnValueOnce(maybeSingleChain({ data: null, error: { message: 'dup check error' } }));

      const res = await request(app).post('/ratings').send(validBody);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'dup check error' });
    });

    test('returns 409 when rating already exists', async () => {
      mockAuth('user-1');
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({
          data: { id: 'tx-1', buyer_id: 'user-1', seller_id: 'user-2', status: 'completed' },
          error: null,
        }))
        .mockReturnValueOnce(maybeSingleChain({ data: { id: 'existing-rating' }, error: null }));

      const res = await request(app).post('/ratings').send(validBody);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'You have already rated this transaction' });
    });

    test('returns 500 when insert fails', async () => {
      mockAuth('user-1');
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({
          data: { id: 'tx-1', buyer_id: 'user-1', seller_id: 'user-2', status: 'completed' },
          error: null,
        }))
        .mockReturnValueOnce(maybeSingleChain({ data: null, error: null }))
        .mockReturnValueOnce(insertChain({ data: null, error: { message: 'insert failed' } }));

      const res = await request(app).post('/ratings').send(validBody);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'insert failed' });
    });

    test('returns 500 on thrown error', async () => {
      mockAuth('user-1');
      mockSupabaseClient.from.mockImplementationOnce(() => {
        throw new Error('Kaboom');
      });

      const res = await request(app).post('/ratings').send(validBody);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Kaboom' });
    });

    test('creates a rating successfully with review', async () => {
      const inserted = { id: 'r1', rater_id: 'user-1', rated_id: 'user-2', rating: 4, review: 'Great!' };
      mockAuth('user-1');
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({
          data: { id: 'tx-1', buyer_id: 'user-1', seller_id: 'user-2', status: 'completed' },
          error: null,
        }))
        .mockReturnValueOnce(maybeSingleChain({ data: null, error: null }))
        .mockReturnValueOnce(insertChain({ data: inserted, error: null }));

      const res = await request(app)
        .post('/ratings')
        .send({ ...validBody, review: 'Great!' });
      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.rating).toEqual(inserted);
    });

    test('creates a rating successfully without review', async () => {
      const inserted = { id: 'r2', rater_id: 'user-1', rated_id: 'user-2', rating: 5, review: null };
      mockAuth('user-1');
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({
          data: { id: 'tx-1', buyer_id: 'user-1', seller_id: 'user-2', status: 'completed' },
          error: null,
        }))
        .mockReturnValueOnce(maybeSingleChain({ data: null, error: null }))
        .mockReturnValueOnce(insertChain({ data: inserted, error: null }));

      const res = await request(app).post('/ratings').send(validBody);
      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.rating).toEqual(inserted);
    });
  });

  // ============ GET / ============
  describe('GET /', () => {
    test('returns 400 when no query param provided', async () => {
      const res = await request(app).get('/ratings');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'user_id or rater_id query parameter is required' });
    });

    test('returns 500 when ratings query fails', async () => {
      mockSupabaseClient.from.mockReturnValueOnce(
        thenableChain(null, { message: 'ratings error' })
      );

      const res = await request(app).get('/ratings?user_id=u1');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'ratings error' });
    });

    test('returns 500 when aggregation query fails', async () => {
      mockSupabaseClient.from
        .mockReturnValueOnce(thenableChain([{ id: 'r1', rating: 4 }]))
        .mockReturnValueOnce(simpleThenableChain(null, { message: 'agg error' }));

      const res = await request(app).get('/ratings?user_id=u1');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'agg error' });
    });

    test('returns 500 on thrown error', async () => {
      mockSupabaseClient.from.mockImplementationOnce(() => {
        throw new Error('Kaboom');
      });

      const res = await request(app).get('/ratings?user_id=u1');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Kaboom' });
    });

    test('returns ratings list for rater_id (no average)', async () => {
      const ratings = [{ id: 'r1', rater_id: 'u1', rating: 4 }];
      mockSupabaseClient.from.mockReturnValueOnce(
        thenableChain(ratings)
      );

      const res = await request(app).get('/ratings?rater_id=u1');
      expect(res.status).toBe(200);
      expect(res.body.ratings).toEqual(ratings);
      expect(res.body.average).toBeUndefined();
    });

    test('returns ratings with average and total for user_id', async () => {
      const ratings = [{ id: 'r1', rating: 4 }, { id: 'r2', rating: 5 }];
      const agg = [{ rating: 4 }, { rating: 5 }];
      mockSupabaseClient.from
        .mockReturnValueOnce(thenableChain(ratings))
        .mockReturnValueOnce(simpleThenableChain(agg));

      const res = await request(app).get('/ratings?user_id=u1');
      expect(res.status).toBe(200);
      expect(res.body.ratings).toEqual(ratings);
      expect(res.body.average).toBe(4.5);
      expect(res.body.total).toBe(2);
    });

    test('returns average of 0 when user has no ratings', async () => {
      mockSupabaseClient.from
        .mockReturnValueOnce(thenableChain([]))
        .mockReturnValueOnce(simpleThenableChain([]));

      const res = await request(app).get('/ratings?user_id=u1');
      expect(res.status).toBe(200);
      expect(res.body.ratings).toEqual([]);
      expect(res.body.average).toBe(0);
      expect(res.body.total).toBe(0);
    });
  });
});
