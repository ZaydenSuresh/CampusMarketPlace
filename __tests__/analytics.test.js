const request = require('supertest');
const express = require('express');

jest.mock('../lib/supabase', () => ({
  createSupabaseClient: jest.fn(),
}));

const { createSupabaseClient } = require('../lib/supabase');
const analyticsRouter = require('../routes/analytics');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/analytics', analyticsRouter);
  return app;
}

describe('Analytics routes', () => {
  let mockSupabaseClient;

  function profileChain(result) {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(result),
    };
  }

  function orderingChain(result) {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue(result),
    };
  }

  function simpleChain(result) {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue(result),
    };
  }

  function adminAuth() {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null,
    });
    mockSupabaseClient.from.mockReturnValueOnce(
      profileChain({ data: { role: 'Admin' }, error: null })
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabaseClient = {
      auth: { getUser: jest.fn() },
      from: jest.fn(),
    };

    createSupabaseClient.mockReturnValue(mockSupabaseClient);
  });

  // ============ Authentication ============
  describe('requireAdmin guard', () => {
    test.each([
      ['getUser fails', { data: { user: null }, error: { message: 'fail' } }],
      ['no user', { data: { user: null }, error: null }],
    ])('GET /analytics/transactions returns 403 when %s', async (_, getUserResult) => {
      mockSupabaseClient.auth.getUser.mockResolvedValue(getUserResult);

      const res = await request(buildApp()).get('/analytics/transactions');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ ok: false, message: 'Admin access required' });
    });

    test('GET /analytics/transactions returns 403 when profile query errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null,
      });
      mockSupabaseClient.from.mockReturnValueOnce(
        profileChain({ data: null, error: { message: 'profile error' } })
      );

      const res = await request(buildApp()).get('/analytics/transactions');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ ok: false, message: 'Admin access required' });
    });

    test('GET /analytics/transactions returns 403 when role is not Admin', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null,
      });
      mockSupabaseClient.from.mockReturnValue(
        profileChain({ data: { role: 'Student' }, error: null })
      );

      const res = await request(buildApp()).get('/analytics/transactions');
      expect(res.status).toBe(403);
    });

    test.each(['/categories', '/export', '/summary'])(
      'GET /analytics%s returns 403 without admin',
      async (endpoint) => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const res = await request(buildApp()).get(`/analytics${endpoint}`);
        expect(res.status).toBe(403);
      }
    );
  });

  // ============ GET /analytics/transactions ============
  describe('GET /analytics/transactions', () => {
    test('returns 400 for invalid period', async () => {
      adminAuth();

      const res = await request(buildApp()).get('/analytics/transactions?period=bogus');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ ok: false, message: 'Invalid period. Use day, week, or month.' });
    });

    test('returns 500 on supabase error', async () => {
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        orderingChain({ data: null, error: { message: 'Query failed' } })
      );

      const res = await request(buildApp()).get('/analytics/transactions');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ ok: false, error: 'Query failed' });
    });

    test('returns 500 on thrown error', async () => {
      adminAuth();
      mockSupabaseClient.from.mockImplementationOnce(() => {
        throw new Error('Kaboom');
      });

      const res = await request(buildApp()).get('/analytics/transactions');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ ok: false, error: 'Kaboom' });
    });

    test('groups by default period (week)', async () => {
      const tx = [
        { created_at: '2026-01-05T10:00:00Z', listings: {} },
        { created_at: '2026-01-12T10:00:00Z', listings: {} },
      ];
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        orderingChain({ data: tx, error: null })
      );

      const res = await request(buildApp()).get('/analytics/transactions');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.period).toBe('week');
      expect(res.body.labels).toHaveLength(2);
      expect(res.body.data).toHaveLength(2);
    });

    test('groups by day period', async () => {
      const tx = [
        { created_at: '2026-01-05T10:00:00Z', listings: {} },
        { created_at: '2026-01-05T14:00:00Z', listings: {} },
      ];
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        orderingChain({ data: tx, error: null })
      );

      const res = await request(buildApp()).get('/analytics/transactions?period=day');
      expect(res.status).toBe(200);
      expect(res.body.period).toBe('day');
      expect(res.body.labels).toEqual(['2026-01-05']);
      expect(res.body.data).toEqual([2]);
    });

    test('groups by month period', async () => {
      const tx = [
        { created_at: '2026-01-05T10:00:00Z', listings: {} },
        { created_at: '2026-02-10T10:00:00Z', listings: {} },
      ];
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        orderingChain({ data: tx, error: null })
      );

      const res = await request(buildApp()).get('/analytics/transactions?period=month');
      expect(res.status).toBe(200);
      expect(res.body.period).toBe('month');
      expect(res.body.labels).toEqual(['2026-01', '2026-02']);
      expect(res.body.data).toEqual([1, 1]);
    });

    test('returns empty arrays with no transactions', async () => {
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        orderingChain({ data: [], error: null })
      );

      const res = await request(buildApp()).get('/analytics/transactions');
      expect(res.status).toBe(200);
      expect(res.body.labels).toEqual([]);
      expect(res.body.data).toEqual([]);
    });
  });

  // ============ GET /analytics/categories ============
  describe('GET /analytics/categories', () => {
    test('returns 500 on supabase error', async () => {
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        simpleChain({ data: null, error: { message: 'DB error' } })
      );

      const res = await request(buildApp()).get('/analytics/categories');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ ok: false, error: 'DB error' });
    });

    test('returns 500 on thrown error', async () => {
      adminAuth();
      mockSupabaseClient.from.mockImplementationOnce(() => {
        throw new Error('Kaboom');
      });

      const res = await request(buildApp()).get('/analytics/categories');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ ok: false, error: 'Kaboom' });
    });

    test('groups transactions by category', async () => {
      const tx = [
        { listings: { title: 'Book', price: 20, category: 'Textbooks' } },
        { listings: { title: 'Laptop', price: 500, category: 'Electronics' } },
        { listings: { title: 'Pen', price: 5, category: 'Textbooks' } },
      ];
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        simpleChain({ data: tx, error: null })
      );

      const res = await request(buildApp()).get('/analytics/categories');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const textbooks = res.body.categories.find(c => c.category === 'Textbooks');
      expect(textbooks.count).toBe(2);
      expect(textbooks.total_value).toBe(25);

      const electronics = res.body.categories.find(c => c.category === 'Electronics');
      expect(electronics.count).toBe(1);
      expect(electronics.total_value).toBe(500);
    });

    test('zero-fills categories that have no transactions', async () => {
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        simpleChain({ data: [], error: null })
      );

      const res = await request(buildApp()).get('/analytics/categories');
      expect(res.status).toBe(200);
      expect(res.body.categories).toHaveLength(8);
      res.body.categories.forEach(c => {
        expect(c.count).toBe(0);
        expect(c.total_value).toBe(0);
      });
    });

    test('handles transaction with no listing data as Uncategorized', async () => {
      const tx = [
        { listings: null },
        { listings: { category: 'Textbooks', price: 30 } },
      ];
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        simpleChain({ data: tx, error: null })
      );

      const res = await request(buildApp()).get('/analytics/categories');
      expect(res.status).toBe(200);
      expect(res.body.categories.find(c => c.category === 'Uncategorized').count).toBe(1);
      expect(res.body.categories.find(c => c.category === 'Textbooks').count).toBe(1);
    });
  });

  // ============ GET /analytics/export ============
  describe('GET /analytics/export', () => {
    test('returns 500 on supabase error', async () => {
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        orderingChain({ data: null, error: { message: 'Export failed' } })
      );

      const res = await request(buildApp()).get('/analytics/export');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ ok: false, error: 'Export failed' });
    });

    test('returns 500 on thrown error', async () => {
      adminAuth();
      mockSupabaseClient.from.mockImplementationOnce(() => {
        throw new Error('Kaboom');
      });

      const res = await request(buildApp()).get('/analytics/export');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ ok: false, error: 'Kaboom' });
    });

    test('returns raw completed transactions', async () => {
      const tx = [
        { id: 1, created_at: '2026-01-05T10:00:00Z', listings: { title: 'Book' } },
      ];
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        orderingChain({ data: tx, error: null })
      );

      const res = await request(buildApp()).get('/analytics/export');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.transactions).toEqual(tx);
    });
  });

  // ============ GET /analytics/summary ============
  describe('GET /analytics/summary', () => {
    test('returns 500 on supabase error', async () => {
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        simpleChain({ data: null, error: { message: 'Summary failed' } })
      );

      const res = await request(buildApp()).get('/analytics/summary');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ ok: false, error: 'Summary failed' });
    });

    test('returns 500 on thrown error', async () => {
      adminAuth();
      mockSupabaseClient.from.mockImplementationOnce(() => {
        throw new Error('Kaboom');
      });

      const res = await request(buildApp()).get('/analytics/summary');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ ok: false, error: 'Kaboom' });
    });

    test('aggregates total_transactions, total_value, avg_per_day', async () => {
      const tx = [
        { created_at: '2026-01-05T10:00:00Z', listings: { price: 100 } },
        { created_at: '2026-01-05T14:00:00Z', listings: { price: 50 } },
        { created_at: '2026-01-06T10:00:00Z', listings: { price: 200 } },
      ];
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        simpleChain({ data: tx, error: null })
      );

      const res = await request(buildApp()).get('/analytics/summary');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.total_transactions).toBe(3);
      expect(res.body.total_value).toBe(350);
      expect(res.body.avg_per_day).toBe(175);
    });

    test('returns zeros with no transactions', async () => {
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        simpleChain({ data: [], error: null })
      );

      const res = await request(buildApp()).get('/analytics/summary');
      expect(res.status).toBe(200);
      expect(res.body.total_transactions).toBe(0);
      expect(res.body.total_value).toBe(0);
      expect(res.body.avg_per_day).toBe(0);
    });

    test('handles transactions without created_at', async () => {
      const tx = [
        { created_at: null, listings: { price: 100 } },
      ];
      adminAuth();
      mockSupabaseClient.from.mockReturnValueOnce(
        simpleChain({ data: tx, error: null })
      );

      const res = await request(buildApp()).get('/analytics/summary');
      expect(res.status).toBe(200);
      expect(res.body.total_transactions).toBe(1);
      expect(res.body.total_value).toBe(100);
      expect(res.body.avg_per_day).toBe(100);
    });
  });

// ADDED BY KHANYISILE
describe("Sprint analytics endpoints", () => {


 // ADDED BY KHANYISILE
test("GET /analytics/slots returns slot utilisation summary", async () => {
  adminAuth();

  const slotsBuilder = {
    select: jest.fn().mockResolvedValue({
      data: [
        {
          date: "2026-05-20",
          capacity: 10,
          booked: 5,
        },
        {
          date: "2026-05-21",
          capacity: 20,
          booked: 10,
        },
      ],
      error: null,
    }),
  };

  mockSupabaseClient.from.mockReturnValueOnce(
    slotsBuilder
  );

  const res = await request(buildApp())
    .get("/analytics/slots");

  expect(res.status).toBe(200);

  expect(res.body.ok).toBe(true);

  expect(res.body.summary.total_slots).toBe(2);

  expect(res.body.summary.total_capacity)
    .toBe(30);

  expect(res.body.summary.total_booked)
    .toBe(15);

  expect(res.body.summary.utilisation_pct)
    .toBe(50);
});

  // ADDED BY KHANYISILE
  test("GET /analytics/slots returns 403 for non-admin", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: {
        user: null,
      },
      error: null,
    });

    const res = await request(buildApp())
      .get("/analytics/slots");

    expect(res.status).toBe(403);

    expect(res.body.ok).toBe(false);
  });

  // ADDED BY KHANYISILE
  test("GET /analytics/flagged-content returns moderation stats", async () => {
    adminAuth();

    const ratingsBuilder = {
      select: jest.fn().mockResolvedValue({
        data: [
          {
            flagged: true,
            removed: false,
          },
          {
            flagged: true,
            removed: true,
          },
          {
            flagged: false,
            removed: false,
          },
        ],
        error: null,
      }),
    };

    mockSupabaseClient.from.mockReturnValueOnce(
      ratingsBuilder
    );

    const res = await request(buildApp())
      .get("/analytics/flagged-content");

    expect(res.status).toBe(200);

    expect(res.body.ok).toBe(true);

    expect(
      res.body.summary.total_reviews
    ).toBe(3);

    expect(
      res.body.summary.flagged_count
    ).toBe(2);

    expect(
      res.body.summary.removed_count
    ).toBe(1);
  });

  // ADDED BY KHANYISILE
  test("GET /analytics/export/pdf returns PDF file", async () => {
    adminAuth();

    const transactionsBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            listings: {
              title: "Laptop",
              price: 5000,
            },
          },
        ],
        error: null,
      }),
    };

    mockSupabaseClient.from.mockReturnValueOnce(
      transactionsBuilder
    );

    const res = await request(buildApp())
      .get("/analytics/export/pdf");

    expect(res.status).toBe(200);

    expect(
      res.headers["content-type"]
    ).toContain("application/pdf");

    expect(
      res.headers["content-disposition"]
    ).toContain("attachment");
  });

  // ADDED BY KHANYISILE
  test("GET /analytics/export/pdf returns 403 for non-admin", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: {
        user: null,
      },
      error: null,
    });

    const res = await request(buildApp())
      .get("/analytics/export/pdf");

    expect(res.status).toBe(403);
  });
});  
});
