const express = require("express");
const router = express.Router();
let supabase = null;

try {
  supabase = require("../database");
} catch (err) {
  console.warn("Database not available");
}

function checkDb() {
  return supabase !== null;
}

// POST /ratings
router.post("/", async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: "Database not available" });
  }

  try {
    const { rater_id, rated_user_id, listing_id, score, review } = req.body;

    if (!rater_id || !rated_user_id || !score) {
      return res.status(400).json({
        error: "rater_id, rated_user_id and score are required"
      });
    }

    if (rater_id === rated_user_id) {
      return res.status(400).json({
        error: "Users cannot rate themselves"
      });
    }

    const numericScore = Number(score);

    if (Number.isNaN(numericScore) || numericScore < 1 || numericScore > 5) {
      return res.status(400).json({
        error: "Score must be a number between 1 and 5"
      });
    }

    const { data, error } = await supabase
      .from("ratings")
      .insert([
        {
          rater_id,
          rated_user_id,
          listing_id: listing_id || null,
          score: numericScore,
          review: review || null
        }
      ])
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({
      message: "Rating submitted successfully",
      rating: data[0]
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /ratings/user/:userId
router.get("/user/:userId", async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: "Database not available" });
  }

  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from("ratings")
      .select("*")
      .eq("rated_user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /ratings/user/:userId/summary
router.get("/user/:userId/summary", async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: "Database not available" });
  }

  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from("ratings")
      .select("score")
      .eq("rated_user_id", userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const count = data.length;
    const average =
      count === 0
        ? 0
        : data.reduce((sum, item) => sum + Number(item.score), 0) / count;

    return res.json({
      user_id: userId,
      average_rating: Number(average.toFixed(2)),
      total_ratings: count
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;