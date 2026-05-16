// __tests__/seller-history-moderation.test.js

const request = require("supertest");
const express = require("express");

jest.mock("../lib/supabase", () => ({
  createSupabaseClient: jest.fn(),
}));

const { createSupabaseClient } = require("../lib/supabase");

const sellerHistoryRouter = require("../routes/seller-history");
const ratingsRouter = require("../routes/ratings");

function createApp(mockSupabase) {
  createSupabaseClient.mockReturnValue(mockSupabase);

  const app = express();
  app.use(express.json());

  app.use("/seller-history", sellerHistoryRouter);
  app.use("/ratings", ratingsRouter);

  return app;
}

function createSupabaseMockSequence(responses = []) {
  let index = 0;

  function nextResponse() {
    const response = responses[index] || { data: null, error: null };
    index += 1;
    return Promise.resolve(response);
  }

  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),

    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),

    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),

    single: jest.fn(() => nextResponse()),
    maybeSingle: jest.fn(() => nextResponse()),

    then: jest.fn((resolve, reject) => {
      return nextResponse().then(resolve, reject);
    }),
  };

  return {
    from: jest.fn(() => queryBuilder),

    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "test@example.com",
          },
        },
        error: null,
      }),
    },

    __queryBuilder: queryBuilder,
  };
}

function createSupabaseMock({ data = null, error = null } = {}) {
  return createSupabaseMockSequence([{ data, error }]);
}

function extractArrayFromResponseBody(body) {
  if (Array.isArray(body)) return body;

  return (
    body.reviews ||
    body.ratings ||
    body.flaggedReviews ||
    body.flagged_reviews ||
    body.data ||
    []
  );
}

describe("Seller History and Review Moderation UAT tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("UAT 1 — View seller history", async () => {
    const mockSellerHistory = {
      seller: {
        id: "seller-123",
        name: "Test Seller",
        email: "seller@example.com",
      },
      averageRating: 4.5,
      totalReviews: 2,
      completedTransactions: 3,
      reviews: [
        {
          id: "review-1",
          rating: 5,
          review: "Great seller",
          status: "active",
        },
        {
          id: "review-2",
          rating: 4,
          review: "Good communication",
          status: "active",
        },
      ],
    };

    const mockSupabase = createSupabaseMock({
      data: mockSellerHistory,
      error: null,
    });

    const app = createApp(mockSupabase);

    const response = await request(app).get("/seller-history/seller-123");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("ok", true);
    expect(response.body).toHaveProperty("seller");
    expect(response.body).toHaveProperty("rating");
    expect(response.body.rating).toHaveProperty("average");
    expect(response.body.rating).toHaveProperty("total");
    expect(response.body).toHaveProperty("completed_transactions");
    expect(response.body).toHaveProperty("reviews");
  });

  test("UAT 2 — Reject invalid seller history request", async () => {
    const mockSupabase = createSupabaseMock({
      data: null,
      error: { message: "Seller not found" },
    });

    const app = createApp(mockSupabase);

    const response = await request(app).get("/seller-history/invalid-seller");

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body).toHaveProperty("error");
  });

  test("UAT 3 — View seller with no reviews", async () => {
    const mockSellerHistory = {
      seller: {
        id: "seller-456",
        name: "New Seller",
        email: "newseller@example.com",
      },
      averageRating: 0,
      totalReviews: 0,
      completedTransactions: 0,
      reviews: [],
    };

    const mockSupabase = createSupabaseMock({
      data: mockSellerHistory,
      error: null,
    });

    const app = createApp(mockSupabase);

    const response = await request(app).get("/seller-history/seller-456");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("ok", true);
    expect(response.body).toHaveProperty("seller");
    expect(response.body).toHaveProperty("rating");
    expect(response.body.rating.total).toBe(0);
    expect(response.body.reviews).toEqual([]);
  });

  test("UAT 4 — Flag a review", async () => {
    const flaggedReview = {
      id: "review-123",
      flagged: true,
      status: "flagged",
    };

    const mockSupabase = createSupabaseMock({
      data: flaggedReview,
      error: null,
    });

    const app = createApp(mockSupabase);

    const response = await request(app)
      .put("/ratings/review-123/flag")
      .set("Authorization", "Bearer fake-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("ok", true);
    expect(response.body).toHaveProperty("rating");
  });

  test("UAT 5 — Reject flagging a non-existing review", async () => {
    const mockSupabase = createSupabaseMock({
      data: null,
      error: { message: "Review not found" },
    });

    const app = createApp(mockSupabase);

    const response = await request(app).put("/ratings/missing-review/flag");

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body).toHaveProperty("error");
  });

  test("UAT 6 — View reviews for moderation", async () => {
    const moderationReviews = [
      {
        id: "review-1",
        rating: 1,
        review: "Inappropriate review",
        flagged: true,
        status: "flagged",
        reviewer: {
          id: "buyer-1",
          name: "Buyer User",
        },
        rated_user: {
          id: "seller-1",
          name: "Seller User",
        },
      },
    ];

    const mockSupabase = createSupabaseMockSequence([
      {
        data: {
          id: "user-123",
          role: "Admin",
        },
        error: null,
      },
      {
        data: moderationReviews,
        error: null,
      },
    ]);

    const app = createApp(mockSupabase);

    const response = await request(app)
      .get("/ratings/moderation")
      .set("Authorization", "Bearer fake-token");

    const reviews = extractArrayFromResponseBody(response.body);

    expect(response.status).toBe(200);
    expect(Array.isArray(reviews)).toBe(true);
    expect(reviews.length).toBe(1);
expect(reviews[0]).toHaveProperty("rating");
expect(reviews[0]).toHaveProperty("review");
expect(reviews[0]).toHaveProperty("flagged");
expect(reviews[0]).toHaveProperty("removed");
expect(reviews[0]).toHaveProperty("reviewer_name");
expect(reviews[0]).toHaveProperty("reviewed_user_name");
  });

  test("UAT 7 — View moderation page when no flagged reviews exist", async () => {
    const mockSupabase = createSupabaseMockSequence([
      {
        data: {
          id: "user-123",
          role: "Admin",
        },
        error: null,
      },
      {
        data: [],
        error: null,
      },
    ]);

    const app = createApp(mockSupabase);

    const response = await request(app)
      .get("/ratings/moderation")
      .set("Authorization", "Bearer fake-token");

    const reviews = extractArrayFromResponseBody(response.body);

    expect(response.status).toBe(200);
    expect(Array.isArray(reviews)).toBe(true);
    expect(reviews).toHaveLength(0);
  });

  test("UAT 8 — Mark flagged review as safe", async () => {
    const safeReview = {
      id: "review-123",
      flagged: false,
      status: "active",
    };

    const mockSupabase = createSupabaseMockSequence([
      {
        data: {
          id: "user-123",
          role: "Admin",
        },
        error: null,
      },
      {
        data: safeReview,
        error: null,
      },
    ]);

    const app = createApp(mockSupabase);

    const response = await request(app)
      .put("/ratings/review-123/mark-safe")
      .set("Authorization", "Bearer fake-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("ok", true);
    expect(response.body).toHaveProperty("rating");
  });

  test("UAT 9 — Remove flagged review", async () => {
    const removedReview = {
      id: "review-123",
      status: "removed",
    };

    const mockSupabase = createSupabaseMockSequence([
      {
        data: {
          id: "user-123",
          role: "Admin",
        },
        error: null,
      },
      {
        data: removedReview,
        error: null,
      },
    ]);

    const app = createApp(mockSupabase);

    const response = await request(app)
      .put("/ratings/review-123/remove")
      .set("Authorization", "Bearer fake-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("ok", true);
    expect(response.body).toHaveProperty("rating");
  });

  test("UAT 10 — Reject moderation action for non-existing review", async () => {
    const mockSupabase = createSupabaseMock({
      data: null,
      error: { message: "Review not found" },
    });

    const app = createApp(mockSupabase);

    const markSafeResponse = await request(app).put(
      "/ratings/missing-review/mark-safe"
    );

    expect(markSafeResponse.status).toBeGreaterThanOrEqual(400);
    expect(markSafeResponse.body).toHaveProperty("error");

    const removeResponse = await request(app).put(
      "/ratings/missing-review/remove"
    );

    expect(removeResponse.status).toBeGreaterThanOrEqual(400);
    expect(removeResponse.body).toHaveProperty("error");
  });
});