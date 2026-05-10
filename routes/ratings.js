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

router.post("/", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const user = await getCurrentUser(req, res);

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { rated_id, transaction_id, rating, review } = req.body;

    if (!rated_id || !transaction_id || !rating) {
      return res.status(400).json({ error: "rated_id, transaction_id, and rating are required" });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
    }

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("id, buyer_id, seller_id, status")
      .eq("id", transaction_id)
      .single();

    if (txError || !transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (transaction.status !== "completed") {
      return res.status(400).json({ error: "Can only rate completed transactions" });
    }

    const rater_id = user.id;
    if (rater_id !== transaction.buyer_id && rater_id !== transaction.seller_id) {
      return res.status(403).json({ error: "You are not part of this transaction" });
    }

    if (rater_id === rated_id) {
      return res.status(400).json({ error: "Cannot rate yourself" });
    }

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

router.get("/", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const { user_id, rater_id } = req.query;

    if (!user_id && !rater_id) {
      return res.status(400).json({ error: "user_id or rater_id query parameter is required" });
    }

    const filterField = rater_id ? "rater_id" : "rated_id";
    const filterValue = rater_id || user_id;

    const { data: ratings, error: ratingsError } = await supabase
      .from("ratings")
      .select("*")
      .eq(filterField, filterValue)
      .order("created_at", { ascending: false });

    if (ratingsError) {
      return res.status(500).json({ error: ratingsError.message });
    }

    if (rater_id) {
      return res.json({ ratings });
    }

    const { data: agg, error: aggError } = await supabase
      .from("ratings")
      .select("rating")
      .eq("rated_id", user_id);

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

module.exports = router;
