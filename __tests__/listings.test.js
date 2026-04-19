// __tests__/listings.uat.test.js

const request = require("supertest");
const express = require("express");

jest.mock("../lib/supabase", () => ({
  createSupabaseClient: jest.fn(),
}));

const { createSupabaseClient } = require("../lib/supabase");
const listingsRouter = require("../routes/listings");

function makeSupabaseMock({
  user = { id: "user-123", email: "test@example.com" },
  listingsData = [],
  singleListing = null,
  insertedListing = null,
  updatedListing = null,
  deleteError = null,
  authError = null,
  uploadError = null,
  publicUrl = "https://example.com/image.jpg",
} = {}) {
  const queryBuilder = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
    gte: jest.fn(),
    lte: jest.fn(),
    or: jest.fn(),
  };

  const supabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: authError,
      }),
    },
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          error: uploadError,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl },
        }),
      }),
    },
    from: jest.fn(() => queryBuilder),
  };

  // GET /listings and GET /listings/all
  queryBuilder.select.mockReturnValue(queryBuilder);
  queryBuilder.order.mockReturnValue(queryBuilder);
  queryBuilder.limit.mockResolvedValue({
    data: listingsData,
    error: null,
  });

  // GET /listings/:id
  queryBuilder.eq.mockReturnValue(queryBuilder);
  queryBuilder.single.mockResolvedValue({
    data: singleListing,
    error: singleListing ? null : { message: "Not found" },
  });

  // POST /listings
  queryBuilder.insert.mockReturnValue({
    select: jest.fn().mockResolvedValue({
      data: insertedListing ? [insertedListing] : [],
      error: insertedListing ? null : { message: "Insert failed" },
    }),
  });

  // PUT /listings/:id
  queryBuilder.update.mockReturnValue({
    eq: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        data: updatedListing ? [updatedListing] : [],
        error: updatedListing ? null : { message: "Update failed" },
      }),
    }),
  });

  // DELETE /listings/:id
  queryBuilder.delete.mockReturnValue({
    eq: jest.fn().mockResolvedValue({
      error: deleteError,
    }),
  });

  // search chain support
  queryBuilder.gte.mockReturnValue(queryBuilder);
  queryBuilder.lte.mockReturnValue(queryBuilder);
  queryBuilder.or.mockResolvedValue({
    data: listingsData,
    error: null,
  });

  return { supabase, queryBuilder };
}

describe("Listings UAT tests", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use("/listings", listingsRouter);
  });

  test("UAT 1 — Create listing with valid data", async () => {
    const listing = {
      id: "listing-1",
      title: "Physics Textbook",
      description: "Good condition",
      price: 250,
      category: "Textbooks",
      condition: "Good",
      sale_type: "Sale",
      image_url: "https://example.com/image.jpg",
      user_id: "user-123",
    };

    const { supabase } = makeSupabaseMock({
      insertedListing: listing,
    });

    createSupabaseClient.mockReturnValue(supabase);

    const res = await request(app).post("/listings").send({
      title: "Physics Textbook",
      description: "Good condition",
      price: 250,
      category: "Textbooks",
      condition: "Good",
      sale_type: "Sale",
      imageName: "book.jpg",
      imageType: "image/jpeg",
      imageBase64: "data:image/jpeg;base64,ZmFrZQ==",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.listing.title).toBe("Physics Textbook");
  });

  test("UAT 2 — Reject unauthenticated listing creation", async () => {
    const { supabase } = makeSupabaseMock({
      user: null,
    });

    createSupabaseClient.mockReturnValue(supabase);

    const res = await request(app).post("/listings").send({
      title: "Item",
      description: "Desc",
      price: 100,
      category: "Textbooks",
      condition: "Good",
      sale_type: "Sale",
      imageName: "item.jpg",
      imageBase64: "data:image/jpeg;base64,ZmFrZQ==",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("Not authenticated");
  });

  test("UAT 3 — Reject creation with missing fields", async () => {
    const { supabase } = makeSupabaseMock();
    createSupabaseClient.mockReturnValue(supabase);

    const res = await request(app).post("/listings").send({
      description: "No title",
      price: 100,
      category: "Textbooks",
      condition: "Good",
      sale_type: "Sale",
      imageName: "item.jpg",
      imageBase64: "data:image/jpeg;base64,ZmFrZQ==",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test("UAT 4 — View all listings", async () => {
    const listings = [
      { id: "1", title: "Book 1" },
      { id: "2", title: "Book 2" },
    ];

    const { supabase, queryBuilder } = makeSupabaseMock({
      listingsData: listings,
    });

    queryBuilder.order.mockResolvedValue({
      data: listings,
      error: null,
    });

    createSupabaseClient.mockReturnValue(supabase);

    const res = await request(app).get("/listings/all");

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.listings.length).toBe(2);
  });

  test("UAT 5 — View latest 6 listings", async () => {
    const listings = [{ id: "1", title: "Latest listing" }];

    const { supabase } = makeSupabaseMock({
      listingsData: listings,
    });

    createSupabaseClient.mockReturnValue(supabase);

    const res = await request(app).get("/listings");

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.listings)).toBe(true);
  });

  test("UAT 6 — View a single listing", async () => {
    const listing = {
      id: "listing-1",
      title: "Calculator",
      description: "Casio",
    };

    const { supabase } = makeSupabaseMock({
      singleListing: listing,
    });

    createSupabaseClient.mockReturnValue(supabase);

    const res = await request(app).get("/listings/listing-1");

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.listing.id).toBe("listing-1");
  });

  test("UAT 7 — Edit listing successfully", async () => {
    const existingListing = {
      id: "listing-1",
      title: "Old Title",
    };

    const updatedListing = {
      id: "listing-1",
      title: "New Title",
      price: 500,
      category: "Electronics",
      condition: "Good",
      sale_type: "Sale",
    };

    const { supabase } = makeSupabaseMock({
      singleListing: existingListing,
      updatedListing,
    });

    createSupabaseClient.mockReturnValue(supabase);

    const res = await request(app).put("/listings/listing-1").send({
      title: "New Title",
      price: 500,
      category: "Electronics",
      condition: "Good",
      sale_type: "Sale",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.listing.title).toBe("New Title");
  });

  test("UAT 8 — Reject invalid category update", async () => {
    const existingListing = {
      id: "listing-1",
      title: "Old Title",
    };

    const { supabase } = makeSupabaseMock({
      singleListing: existingListing,
    });

    createSupabaseClient.mockReturnValue(supabase);

    const res = await request(app).put("/listings/listing-1").send({
      category: "InvalidCategory",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Invalid category");
  });

  test("UAT 9 — Delete listing", async () => {
    const { supabase } = makeSupabaseMock();
    createSupabaseClient.mockReturnValue(supabase);

    const res = await request(app).delete("/listings/listing-1");

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.message).toBe("Listing deleted");
  });

  test("UAT 10 — Search listings", async () => {
    const listings = [
      { id: "1", title: "Laptop", category: "Electronics" },
    ];

    const { supabase, queryBuilder } = makeSupabaseMock({
      listingsData: listings,
    });

    queryBuilder.order.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.gte.mockReturnValue(queryBuilder);
    queryBuilder.lte.mockReturnValue(queryBuilder);
    queryBuilder.or.mockResolvedValue({
      data: listings,
      error: null,
    });

    createSupabaseClient.mockReturnValue(supabase);

    const res = await request(app).get(
      "/listings/search?q=laptop&category=Electronics&minPrice=100&maxPrice=6000"
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.listings.length).toBe(1);
  });
});