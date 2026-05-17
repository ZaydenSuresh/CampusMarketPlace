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
    maybeSingle: jest.fn(),
    gte: jest.fn(),
    lte: jest.fn(),
    or: jest.fn(),
    in: jest.fn(),
  };


const ratingsBuilder = {
  select: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  or: jest.fn().mockResolvedValue({
    data: [],
    error: null,
  }),
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
    from: jest.fn((table) => {
  if (table === "ratings") {
    return ratingsBuilder;
  }

  return queryBuilder;
}),
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

  queryBuilder.maybeSingle.mockResolvedValue({
  data: singleListing,
  error: singleListing ? null : null,
});

// POST /listings
queryBuilder.insert.mockReturnValue({
  select: jest.fn().mockResolvedValue({
    data: insertedListing ? [insertedListing] : undefined,
    error: insertedListing ? null : { message: "Insert failed" },
  }),
});

// PUT /listings/:id
queryBuilder.update.mockReturnValue({
  eq: jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue({
      data: updatedListing ? [updatedListing] : undefined,
      error: updatedListing ? null : { message: "Update failed" },
    }),
  }),
});

  // DELETE /listings/:id
const deleteBuilder = {
  eq: jest.fn().mockReturnThis(),
  then: (resolve) =>
    resolve({
      error: deleteError,
    }),
};

queryBuilder.delete.mockReturnValue(deleteBuilder);

  // search chain support
  queryBuilder.gte.mockReturnValue(queryBuilder);
  queryBuilder.lte.mockReturnValue(queryBuilder);
  queryBuilder.or.mockResolvedValue({
    data: listingsData,
    error: null,
  });
  queryBuilder.then = (resolve) =>
  resolve({
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
  const { supabase } = makeSupabaseMock({
    user: {
      id: "user-123",
      email: "test@example.com",
    },
    singleListing: {
      id: "listing-1",
      title: "Item to delete",
      user_id: "user-123",
      status: "available",
    },
  });

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

//UATs for newly added buy now/reserve features
test("UAT 11 — Reserve available listing sets reserved_by", async () => {
  const buyerId = "buyer-123";

  const existingListing = {
    id: "listing-1",
    title: "Laptop",
    user_id: "seller-123",
    status: "available",
    sale_type: "Trade",
  };

  const updatedListing = {
    ...existingListing,
    status: "reserved",
    reserved_by: buyerId,
  };

  const listingsSelectBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: existingListing,
      error: null,
    }),
  };

  const listingsUpdateBuilder = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: updatedListing,
      error: null,
    }),
  };

const transactionsLookupBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  then: (resolve) =>
    resolve({
      data: [],
      error: null,
    }),
};

const transactionsInsertBuilder = {
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockResolvedValue({
    data: [
      {
        id: "transaction-1",
        listing_id: "listing-1",
        buyer_id: buyerId,
        type: "trade",
        status: "pending",
      },
    ],
    error: null,
  }),
};

let transactionsCallCount = 0;
  const supabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: buyerId,
            email: "buyer@example.com",
          },
        },
        error: null,
      }),
    },
    from: jest.fn((table) => {
      if (table === "listings") {
        if (listingsSelectBuilder.single.mock.calls.length === 0) {
          return listingsSelectBuilder;
        }
        return listingsUpdateBuilder;
      }

if (table === "transactions") {
  transactionsCallCount++;

  if (transactionsCallCount === 1) {
    return transactionsLookupBuilder;
  }

  return transactionsInsertBuilder;
}

      return {};
    }),
  };

  createSupabaseClient.mockReturnValue(supabase);

  const res = await request(app)
    .post("/listings/listing-1/reserve")
    .send({
      transaction_type: "trade",
    });

  expect(res.statusCode).toBe(200);
  expect(res.body.ok).toBe(true);

  expect(listingsUpdateBuilder.update).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "reserved",
      reserved_by: buyerId,
    })
  );
});

test("UAT 12 — Prevent duplicate reservation", async () => {
  const buyerId = "buyer-123";

  const existingListing = {
    id: "listing-1",
    title: "Laptop",
    user_id: "seller-123",
    status: "reserved",
    reserved_by: "other-buyer-456",
    sale_type: "Trade",
  };

  const listingsSelectBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: existingListing,
      error: null,
    }),
  };

  const listingsUpdateBuilder = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  const supabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: buyerId,
            email: "buyer@example.com",
          },
        },
        error: null,
      }),
    },
    from: jest.fn((table) => {
      if (table === "listings") {
        if (listingsSelectBuilder.single.mock.calls.length === 0) {
          return listingsSelectBuilder;
        }
        return listingsUpdateBuilder;
      }

      return {};
    }),
  };

  createSupabaseClient.mockReturnValue(supabase);

  const res = await request(app)
    .post("/listings/listing-1/reserve")
    .send({
      transaction_type: "trade",
    });

  expect(res.statusCode).toBe(400);
 expect(res.body.error).toBeDefined();

  expect(listingsUpdateBuilder.update).not.toHaveBeenCalled();
});

test("UAT 13 — Search listings by status", async () => {
  const listings = [
    {
      id: "listing-1",
      title: "Calculator",
      status: "available",
      user_id: "seller-123",
    },
  ];

  const { supabase, queryBuilder } = makeSupabaseMock({
    listingsData: listings,
  });

  queryBuilder.select.mockReturnValue(queryBuilder);
  queryBuilder.order.mockReturnValue(queryBuilder);
  queryBuilder.eq.mockReturnValue(queryBuilder);
  queryBuilder.gte.mockReturnValue(queryBuilder);
  queryBuilder.lte.mockReturnValue(queryBuilder);
  queryBuilder.or.mockResolvedValue({
    data: listings,
    error: null,
  });

  createSupabaseClient.mockReturnValue(supabase);

  const res = await request(app).get("/listings/search?status=available");

  expect(res.statusCode).toBe(200);
  expect(res.body.ok).toBe(true);
  expect(res.body.listings.length).toBe(1);

  expect(queryBuilder.eq).toHaveBeenCalledWith("status", "available");
});

test("UAT 14 — Search listings by reserved buyer", async () => {
  const buyerId = "buyer-123";

  const listings = [
    {
      id: "listing-1",
      title: "Textbook",
      status: "reserved",
      reserved_by: buyerId,
      user_id: "seller-123",
    },
  ];

  const { supabase, queryBuilder } = makeSupabaseMock({
    listingsData: listings,
  });

  queryBuilder.select.mockReturnValue(queryBuilder);
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
    `/listings/search?status=reserved&reserved_by=${buyerId}`
  );

  expect(res.statusCode).toBe(200);
  expect(res.body.ok).toBe(true);
  expect(res.body.listings.length).toBe(1);

  expect(queryBuilder.eq).toHaveBeenCalledWith("status", "reserved");
  expect(queryBuilder.eq).toHaveBeenCalledWith("reserved_by", buyerId);
});

test("UAT 15 — Search listings returns seller name and ratings", async () => {
  const listings = [
    {
      id: "listing-1",
      title: "Laptop",
      status: "available",
      user_id: "seller-123",
      profiles: {
        name: "Test Seller",
      },
      ratings: [
        { rating: 5 },
        { rating: 4 },
      ],
    },
  ];

  const { supabase, queryBuilder } = makeSupabaseMock({
    listingsData: listings,
  });

  queryBuilder.select.mockReturnValue(queryBuilder);
  queryBuilder.order.mockReturnValue(queryBuilder);
  queryBuilder.eq.mockReturnValue(queryBuilder);
  queryBuilder.gte.mockReturnValue(queryBuilder);
  queryBuilder.lte.mockReturnValue(queryBuilder);
  queryBuilder.or.mockResolvedValue({
    data: listings,
    error: null,
  });

  createSupabaseClient.mockReturnValue(supabase);

  const res = await request(app).get("/listings/search?status=available");

  expect(res.statusCode).toBe(200);
  expect(res.body.ok).toBe(true);

  expect(res.body.listings[0].profiles.name).toBe("Test Seller");
  expect(res.body.listings[0].ratings.length).toBe(2);
});

// ADDED BY KHANYISILE — Sprint tests

test("UAT 16 — Get valid price suggestion", async () => {
  const suggestionBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        category: "Electronics",
        base_price: 2500,
        source: "Stats SA CPI Electronics",
      },
      error: null,
    }),
  };

  const supabase = {
    auth: {
      getUser: jest.fn(),
    },

    from: jest.fn((table) => {
      if (table === "price_suggestions") {
        return suggestionBuilder;
      }

      return suggestionBuilder;
    }),
  };

  createSupabaseClient.mockReturnValue(supabase);

  const res = await request(app).get(
    "/listings/price-suggestion/Electronics?condition=Good"
  );

  expect(res.statusCode).toBe(200);

  expect(res.body.ok).toBe(true);

  expect(res.body.suggestion.category).toBe(
    "Electronics"
  );

  expect(res.body.suggestion.adjusted_price).toBe(
    2125
  );
});

test("UAT 17 — Reject invalid price suggestion category", async () => {
  const { supabase } = makeSupabaseMock();

  createSupabaseClient.mockReturnValue(supabase);

  const res = await request(app).get(
    "/listings/price-suggestion/InvalidCategory"
  );

  expect(res.statusCode).toBe(400);

  expect(res.body.error).toBe(
    "Invalid category"
  );
});

test("UAT 18 — Reject invalid price suggestion condition", async () => {
  const { supabase } = makeSupabaseMock();

  createSupabaseClient.mockReturnValue(supabase);

  const res = await request(app).get(
    "/listings/price-suggestion/Electronics?condition=Broken"
  );

  expect(res.statusCode).toBe(400);

  expect(res.body.error).toBe(
    "Invalid condition"
  );
});

test("UAT 19 — Listing ratings exclude removed reviews", async () => {
  const listings = [
    {
      id: "listing-1",
      title: "Laptop",
      user_id: "seller-123",
    },
  ];

  const ratingsBuilder = {
    select: jest.fn().mockReturnThis(),

    in: jest.fn().mockReturnThis(),

    or: jest.fn().mockResolvedValue({
      data: [
        {
          rated_id: "seller-123",
          rating: 5,
        },
      ],

      error: null,
    }),
  };

  const listingsBuilder = {
    select: jest.fn().mockReturnThis(),

    order: jest.fn().mockReturnThis(),

    limit: jest.fn().mockResolvedValue({
      data: listings,
      error: null,
    }),
  };

  const supabase = {
    auth: {
      getUser: jest.fn(),
    },

    from: jest.fn((table) => {
      if (table === "ratings") {
        return ratingsBuilder;
      }

      return listingsBuilder;
    }),
  };

  createSupabaseClient.mockReturnValue(supabase);

  const res = await request(app).get("/listings");

  expect(res.statusCode).toBe(200);

  expect(res.body.ok).toBe(true);

  expect(
    ratingsBuilder.or
  ).toHaveBeenCalledWith(
    "removed.is.null,removed.eq.false"
  );

  expect(
    res.body.listings[0].seller_average_rating
  ).toBe(5);
});

});
