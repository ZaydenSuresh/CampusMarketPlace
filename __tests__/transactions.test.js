const request = require('supertest');
const express = require('express');

jest.mock('../lib/supabase', () => ({
  createSupabaseClient: jest.fn(),
}));

const { createSupabaseClient } = require('../lib/supabase');
const transactionsRouter = require('../routes/transactions');

const app = express();
app.use(express.json());
app.use('/transactions', transactionsRouter);

describe('Transactions routes', () => {
  let mockSupabaseClient;

  function singleChain(result) {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(result),
    };
  }

  function getChain(data, error) {
    const result = { data, error };
    const chain = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    chain.then = (resolve) => resolve(result);
    return chain;
  }

  function updateChain(result) {
    return {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue(result),
    };
  }

  function updateAndSelectChain(result) {
    return {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(result),
    };
  }

  function mockAuth(userId = 'user-1') {
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

  // ============ GET / ============
  describe('GET /', () => {
    test('returns all transactions', async () => {
      const tx = [{ id: 1, status: 'completed' }];
      mockSupabaseClient.from.mockReturnValueOnce(getChain(tx));

      const res = await request(app).get('/transactions');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(tx);
    });

    test('filters by user_id', async () => {
      const tx = [{ id: 1, buyer_id: 'u1' }];
      mockSupabaseClient.from.mockReturnValueOnce(getChain(tx));

      const res = await request(app).get('/transactions?user_id=u1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(tx);
    });

    test('filters by status', async () => {
      const tx = [{ id: 1, status: 'pending' }];
      mockSupabaseClient.from.mockReturnValueOnce(getChain(tx));

      const res = await request(app).get('/transactions?status=pending');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(tx);
    });

    test('filters by user_id and status', async () => {
      const tx = [{ id: 1, buyer_id: 'u1', status: 'completed' }];
      mockSupabaseClient.from.mockReturnValueOnce(getChain(tx));

      const res = await request(app).get('/transactions?user_id=u1&status=completed');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(tx);
    });

    test('returns 500 on supabase error', async () => {
      mockSupabaseClient.from.mockReturnValueOnce(getChain(null, { message: 'DB error' }));

      const res = await request(app).get('/transactions');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'DB error' });
    });

    test('returns 500 on thrown error', async () => {
      mockSupabaseClient.from.mockImplementationOnce(() => {
        throw new Error('Kaboom');
      });

      const res = await request(app).get('/transactions');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Kaboom' });
    });
  });

  // ============ POST / ============
  describe('POST /', () => {
    test('returns 401 when not authenticated', async () => {
      mockNoAuth();

      const res = await request(app)
        .post('/transactions')
        .send({ listing_id: 'l1', slot_id: 's1' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Not authenticated' });
    });

    test('returns 400 when listing_id is missing', async () => {
      mockAuth();

      const res = await request(app)
        .post('/transactions')
        .send({ slot_id: 's1' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'listing_id and slot_id are required' });
    });

    test('returns 400 when slot_id is missing', async () => {
      mockAuth();

      const res = await request(app)
        .post('/transactions')
        .send({ listing_id: 'l1' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'listing_id and slot_id are required' });
    });

    test('returns 404 when listing does not exist', async () => {
      mockAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        singleChain({ data: null, error: { message: 'not found' } })
      );

      const res = await request(app)
        .post('/transactions')
        .send({ listing_id: 'l1', slot_id: 's1' });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Listing not found' });
    });

    test('returns 400 when listing is not reserved', async () => {
      mockAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        singleChain({ data: { id: 'l1', status: 'available' }, error: null })
      );

      const res = await request(app)
        .post('/transactions')
        .send({ listing_id: 'l1', slot_id: 's1' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Listing is not reserved' });
    });

    test('returns 404 when pending transaction not found', async () => {
      mockAuth();
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({ data: { id: 'l1', status: 'reserved' }, error: null }))
        .mockReturnValueOnce(singleChain({ data: null, error: { message: 'not found' } }));

      const res = await request(app)
        .post('/transactions')
        .send({ listing_id: 'l1', slot_id: 's1' });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'No pending transaction found for this listing' });
    });

    test('returns 403 when user is not the buyer', async () => {
      mockAuth('user-2');
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({ data: { id: 'l1', status: 'reserved' }, error: null }))
        .mockReturnValueOnce(singleChain({ data: { id: 't1', buyer_id: 'user-1' }, error: null }));

      const res = await request(app)
        .post('/transactions')
        .send({ listing_id: 'l1', slot_id: 's1' });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'You are not the buyer for this transaction' });
    });

    test('returns 404 when slot not found', async () => {
      mockAuth();
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({ data: { id: 'l1', status: 'reserved' }, error: null }))
        .mockReturnValueOnce(singleChain({ data: { id: 't1', buyer_id: 'user-1' }, error: null }))
        .mockReturnValueOnce(singleChain({ data: null, error: { message: 'not found' } }));

      const res = await request(app)
        .post('/transactions')
        .send({ listing_id: 'l1', slot_id: 's1' });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Slot not found' });
    });

    test('returns 400 when slot is full', async () => {
      mockAuth();
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({ data: { id: 'l1', status: 'reserved' }, error: null }))
        .mockReturnValueOnce(singleChain({ data: { id: 't1', buyer_id: 'user-1' }, error: null }))
        .mockReturnValueOnce(singleChain({ data: { id: 's1', booked_count: 3, capacity: 3 }, error: null }));

      const res = await request(app)
        .post('/transactions')
        .send({ listing_id: 'l1', slot_id: 's1' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Slot is full' });
    });

    test('returns 500 when transaction update fails', async () => {
      mockAuth();
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({ data: { id: 'l1', status: 'reserved' }, error: null }))
        .mockReturnValueOnce(singleChain({ data: { id: 't1', buyer_id: 'user-1' }, error: null }))
        .mockReturnValueOnce(singleChain({ data: { id: 's1', booked_count: 1, capacity: 3 }, error: null }))
        .mockReturnValueOnce(updateAndSelectChain({ data: null, error: { message: 'Update failed' } }));

      const res = await request(app)
        .post('/transactions')
        .send({ listing_id: 'l1', slot_id: 's1' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Update failed' });
    });

    test('returns 500 on thrown error', async () => {
      mockAuth();
      mockSupabaseClient.from.mockImplementationOnce(() => {
        throw new Error('Kaboom');
      });

      const res = await request(app)
        .post('/transactions')
        .send({ listing_id: 'l1', slot_id: 's1' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Kaboom' });
    });

    test('books a slot successfully', async () => {
      mockAuth();
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({ data: { id: 'l1', status: 'reserved' }, error: null }))
        .mockReturnValueOnce(singleChain({ data: { id: 't1', buyer_id: 'user-1' }, error: null }))
        .mockReturnValueOnce(singleChain({ data: { id: 's1', booked_count: 1, capacity: 3 }, error: null }))
        .mockReturnValueOnce(updateAndSelectChain({
          data: [{ id: 't1', status: 'in_progress', slot_id: 's1' }],
          error: null,
        }))
        .mockReturnValueOnce(updateChain({ error: null }));

      const res = await request(app)
        .post('/transactions')
        .send({ listing_id: 'l1', slot_id: 's1' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.transaction.slot_id).toBe('s1');
    });

    test('logs but succeeds when slot booked_count increment fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockAuth();
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({ data: { id: 'l1', status: 'reserved' }, error: null }))
        .mockReturnValueOnce(singleChain({ data: { id: 't1', buyer_id: 'user-1' }, error: null }))
        .mockReturnValueOnce(singleChain({ data: { id: 's1', booked_count: 0, capacity: 3 }, error: null }))
        .mockReturnValueOnce(updateAndSelectChain({
          data: [{ id: 't1', status: 'in_progress', slot_id: 's1' }],
          error: null,
        }))
        .mockReturnValueOnce(updateChain({ error: { message: 'book error' } }));

      const res = await request(app)
        .post('/transactions')
        .send({ listing_id: 'l1', slot_id: 's1' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to increment slot booked_count:',
        expect.objectContaining({ message: 'book error' })
      );
      consoleSpy.mockRestore();
    });
  });

  // ============ PUT /:id/cancel ============
  describe('PUT /:id/cancel', () => {
    test('returns 401 when not authenticated', async () => {
      mockNoAuth();

      const res = await request(app).put('/transactions/t1/cancel');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Not authenticated' });
    });

    test('returns 404 when transaction not found', async () => {
      mockAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        singleChain({ data: null, error: { message: 'not found' } })
      );

      const res = await request(app).put('/transactions/t1/cancel');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Transaction not found' });
    });

    test('returns 403 when user is neither buyer nor seller', async () => {
      mockAuth('user-3');
      mockSupabaseClient.from.mockReturnValueOnce(
        singleChain({ data: { id: 't1', buyer_id: 'user-1', seller_id: 'user-2' }, error: null })
      );

      const res = await request(app).put('/transactions/t1/cancel');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Not authorized to cancel this transaction' });
    });

    test('returns 500 when cancel update fails', async () => {
      mockAuth('user-1');
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({ data: { id: 't1', buyer_id: 'user-1', seller_id: 'user-2' }, error: null }))
        .mockReturnValueOnce(updateChain({ error: { message: 'Cancel failed' } }));

      const res = await request(app).put('/transactions/t1/cancel');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Cancel failed' });
    });

    test('returns 500 on thrown error', async () => {
      mockAuth();
      mockSupabaseClient.from.mockImplementationOnce(() => {
        throw new Error('Kaboom');
      });

      const res = await request(app).put('/transactions/t1/cancel');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Kaboom' });
    });

    test('cancels transaction and reverts listing (buyer)', async () => {
      mockAuth('user-1');
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({ data: { id: 't1', listing_id: 'l1', buyer_id: 'user-1', seller_id: 'user-2' }, error: null }))
        .mockReturnValueOnce(updateChain({ error: null }))
        .mockReturnValueOnce(updateChain({ error: null }));

      const res = await request(app).put('/transactions/t1/cancel');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, message: 'Transaction cancelled' });
    });

    test('cancels transaction and reverts listing (seller)', async () => {
      mockAuth('user-2');
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({ data: { id: 't1', listing_id: 'l1', buyer_id: 'user-1', seller_id: 'user-2' }, error: null }))
        .mockReturnValueOnce(updateChain({ error: null }))
        .mockReturnValueOnce(updateChain({ error: null }));

      const res = await request(app).put('/transactions/t1/cancel');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, message: 'Transaction cancelled' });
    });

    test('logs but succeeds when listing revert fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockAuth('user-1');
      mockSupabaseClient.from
        .mockReturnValueOnce(singleChain({ data: { id: 't1', listing_id: 'l1', buyer_id: 'user-1', seller_id: 'user-2' }, error: null }))
        .mockReturnValueOnce(updateChain({ error: null }))
        .mockReturnValueOnce(updateChain({ error: { message: 'revert error' } }));

      const res = await request(app).put('/transactions/t1/cancel');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, message: 'Transaction cancelled' });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to revert listing:',
        expect.objectContaining({ message: 'revert error' })
      );
      consoleSpy.mockRestore();
    });
  });

  // ============ PUT /:id (staff actions) ============
  describe('PUT /:id (staff actions)', () => {
    test('returns 500 on supabase error', async () => {
      mockSupabaseClient.from.mockReturnValueOnce(
        updateChain({ error: { message: 'Staff update failed' } })
      );

      const res = await request(app)
        .put('/transactions/t1')
        .send({ action: 'dropoff' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Staff update failed' });
    });

    test('returns 500 on thrown error', async () => {
      mockSupabaseClient.from.mockImplementationOnce(() => {
        throw new Error('Kaboom');
      });

      const res = await request(app)
        .put('/transactions/t1')
        .send({ action: 'dropoff' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Kaboom' });
    });

    test('confirms dropoff with action=dropoff', async () => {
      mockSupabaseClient.from.mockReturnValueOnce(
        updateChain({ error: null })
      );

      const res = await request(app)
        .put('/transactions/t1')
        .send({ action: 'dropoff' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    test('marks as complete with action=complete', async () => {
      mockSupabaseClient.from.mockReturnValueOnce(
        updateChain({ error: null })
      );

      const res = await request(app)
        .put('/transactions/t1')
        .send({ action: 'complete' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });
  });
});
