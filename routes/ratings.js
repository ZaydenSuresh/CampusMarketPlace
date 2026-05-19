const express = require("express");
const { createSupabaseClient } = require("../lib/supabase");

const router = express.Router();

async function getCurrentUser(req, res) {
  const supabase = createSupabaseClient(req, res);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// POST /ratings — Submit a rating for a completed transaction.
// Security: rater_id is always taken from the session, NEVER from the request body.
router.post("/", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const user = await getCurrentUser(req, res);

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { rated_id, transaction_id, rating, review } = req.body;

    // Validate required fields
    if (!rated_id || !transaction_id || !rating) {
      return res.status(400).json({ error: "rated_id, transaction_id, and rating are required" });
    }

    // Rating must be a whole number between 1 and 5
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
    }

    // Verify the transaction exists
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("id, buyer_id, seller_id, status")
      .eq("id", transaction_id)
      .single();

    if (txError || !transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Only completed transactions can be rated
    if (transaction.status !== "completed") {
      return res.status(400).json({ error: "Can only rate completed transactions" });
    }

    // Only the buyer or seller of the transaction can submit a rating
    const rater_id = user.id;
    if (rater_id !== transaction.buyer_id && rater_id !== transaction.seller_id) {
      return res.status(403).json({ error: "You are not part of this transaction" });
    }

    // Prevent rating yourself
    if (rater_id === rated_id) {
      return res.status(400).json({ error: "Cannot rate yourself" });
    }

    // Prevent duplicate ratings — one rating per person per transaction
    const { data: existing, error: dupError } = await supabase
      .from("ratings")
      .select("id")
      .eq("rater_id", rater_id)
      .eq("transaction_id", transaction_id)
      .maybeSingle();

    if (dupError) {
      return res.status(500).json({ error: dupError.message });
    }

    if (existing) {
      return res.status(409).json({ error: "You have already rated this transaction" });
    }

    // Insert the rating into the database
    const { data: ratingRow, error: insertError } = await supabase
      .from("ratings")
      .insert([
        {
          rater_id,
          rated_id,
          transaction_id,
          rating,
          review: review || null,
        },
      ])
      .select("*")
      .single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    res.status(201).json({ ok: true, rating: ratingRow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /ratings?user_id=x  — ratings this user received (includes average + total)
// GET /ratings?rater_id=x — ratings this user gave (just the list)
router.get("/", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const { user_id, rater_id } = req.query;

    if (!user_id && !rater_id) {
      return res.status(400).json({ error: "user_id or rater_id query parameter is required" });
    }

    // Choose the filter column based on which parameter was provided
    const filterField = rater_id ? "rater_id" : "rated_id";
    const filterValue = rater_id || user_id;

    // ADDED BY KHANYISILE
    // Public seller rating views must hide reviews that were soft-removed by Admin.
    // But rater_id history is not filtered, because users should still see their own rating history.
    let ratingsQuery = supabase
      .from("ratings")
      .select("*")
      .eq(filterField, filterValue);

    if (user_id && !rater_id) {
      ratingsQuery = ratingsQuery.or("removed.is.null,removed.eq.false");
    }

    const { data: ratings, error: ratingsError } = await ratingsQuery
      .order("created_at", { ascending: false });

    if (ratingsError) {
      return res.status(500).json({ error: ratingsError.message });
    }

    // If querying by rater_id, we only need the list — no average needed
    if (rater_id) {
      return res.json({ ratings });
    }

    // For ?user_id, also compute the average rating and total count
    // ADDED BY KHANYISILE
    // Removed ratings must not affect public average rating.
    const { data: agg, error: aggError } = await supabase
      .from("ratings")
      .select("rating")
      .eq("rated_id", user_id)
      .or("removed.is.null,removed.eq.false");

    if (aggError) {
      return res.status(500).json({ error: aggError.message });
    }

    const total = agg.length;
    const average = total > 0
      ? Math.round((agg.reduce((sum, r) => sum + r.rating, 0) / total) * 100) / 100
      : 0;

    res.json({ ratings, average, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Helper: check if the logged-in user is an Admin.
// This checks the profiles table using the current user's id.
async function requireAdmin(req, res, supabase) {
  const user = await getCurrentUser(req, res);

  if (!user) {
    return { user: null, errorResponse: res.status(401).json({ error: "Not authenticated" }) };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return { user: null, errorResponse: res.status(403).json({ error: "Admin access required" }) };
  }

  if (profile.role !== "Admin") {
    return { user: null, errorResponse: res.status(403).json({ error: "Admin access required" }) };
  }

  return { user, errorResponse: null };
}


// GET /ratings/moderation — Admin views all ratings with moderation status
// GET /ratings/moderation — Admin views all ratings with moderation status
router.get("/moderation", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);

    const { errorResponse } = await requireAdmin(req, res, supabase);
    if (errorResponse) return;

    // 1. Fetch ratings without joins
    const { data: ratings, error: ratingsError } = await supabase
      .from("ratings")
      .select(`
        id,
        rater_id,
        rated_id,
        transaction_id,
        rating,
        review,
        flagged,
        flagged_at,
        removed,
        removed_at,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (ratingsError) {
      return res.status(500).json({ error: ratingsError.message });
    }

    // 2. Fetch reviewer and reviewed-user profiles manually
    const userIds = [
      ...new Set(
        (ratings || [])
          .flatMap((rating) => [rating.rater_id, rating.rated_id])
          .filter(Boolean)
      ),
    ];// creates a list of unique IDs.

    let profiles = [];

    if (userIds.length > 0) {
      const { data: profileData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      if (profilesError) {
        return res.status(500).json({ error: profilesError.message });
      }

      profiles = profileData || [];
    }//for the user identified already, if they are there, then collect their info.

    // 3. Fetch related transactions manually
    const transactionIds = [
      ...new Set(
        (ratings || [])
          .map((rating) => rating.transaction_id)
          .filter(Boolean)
      ),
    ];

    let transactions = [];

    if (transactionIds.length > 0) {
      const { data: transactionData, error: transactionsError } = await supabase
        .from("transactions")
        .select("id, listing_id")
        .in("id", transactionIds);

      if (transactionsError) {
        return res.status(500).json({ error: transactionsError.message });
      }

      transactions = transactionData || [];
    }

    // 4. Fetch related listings manually
    const listingIds = [
      ...new Set(
        (transactions || [])
          .map((transaction) => transaction.listing_id)
          .filter(Boolean)
      ),
    ];

    let listings = [];

    if (listingIds.length > 0) {
      const { data: listingData, error: listingsError } = await supabase
        .from("listings")
        .select("id, title")
        .in("id", listingIds);

      if (listingsError) {
        return res.status(500).json({ error: listingsError.message });
      }

      listings = listingData || [];
    }

    // 5. Format response for moderation.js
    const formattedRatings = (ratings || []).map((rating) => {
      const rater = profiles.find((profile) => profile.id === rating.rater_id);
      const ratedUser = profiles.find(
        (profile) => profile.id === rating.rated_id
      );

      const transaction = transactions.find(
        (item) => item.id === rating.transaction_id
      );

      const listing = listings.find(
        (item) => item.id === transaction?.listing_id
      );

      return {
        id: rating.id,

        reviewer_name:
          rater?.name ||
          rater?.email ||
          "Unknown reviewer",

        reviewed_user_name:
          ratedUser?.name ||
          ratedUser?.email ||
          "Unknown user",

        item_title: listing?.title || "Unknown item",

        rating: rating.rating,
        review: rating.review,
        flagged: rating.flagged === true,
        flagged_at: rating.flagged_at,
        removed: rating.removed === true,
        removed_at: rating.removed_at,
        created_at: rating.created_at,
      };
    });

    return res.json({ ok: true, ratings: formattedRatings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /ratings/:id/flag — Any logged-in user can flag a review
router.put("/:id/flag", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const user = await getCurrentUser(req, res);

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;

    // Check that the rating exists first
    const { data: existingRating, error: findError } = await supabase
      .from("ratings")
      .select("*")
      .eq("id", id)
      .single();

    if (findError || !existingRating) {
      return res.status(404).json({ error: "Rating not found" });
    }

    // Soft-flag the review for admin moderation
    const { data: rating, error: updateError } = await supabase
      .from("ratings")
      .update({
        flagged: true,
        flagged_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({ ok: true, rating });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /ratings/:id/mark-safe — Admin clears a false flag
router.put("/:id/mark-safe", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);

    const { errorResponse } = await requireAdmin(req, res, supabase);
    if (errorResponse) return;

    const { id } = req.params;

    // Check that the rating exists first
    const { data: existingRating, error: findError } = await supabase
      .from("ratings")
      .select("*")
      .eq("id", id)
      .single();

    if (findError || !existingRating) {
      return res.status(404).json({ error: "Rating not found" });
    }

    // Clear the flag
    const { data: rating, error: updateError } = await supabase
      .from("ratings")
      .update({
        flagged: false,
        flagged_at: null,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({ ok: true, rating });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /ratings/:id/remove — Admin soft-removes an abusive review
router.put("/:id/remove", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);

    const { errorResponse } = await requireAdmin(req, res, supabase);
    if (errorResponse) return;

    const { id } = req.params;

    // Check that the rating exists first
    const { data: existingRating, error: findError } = await supabase
      .from("ratings")
      .select("*")
      .eq("id", id)
      .single();

    if (findError || !existingRating) {
      return res.status(404).json({ error: "Rating not found" });
    }

    // Do not delete the review. Only hide it from public views.
    const { data: rating, error: updateError } = await supabase
      .from("ratings")
      .update({
        removed: true,
        removed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({ ok: true, rating });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;