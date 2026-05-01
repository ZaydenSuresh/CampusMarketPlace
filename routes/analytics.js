const express = require("express");
const { createSupabaseClient } = require("../lib/supabase");

const router = express.Router();

/**
 * Checks if logged-in user has Admin role.
 * Returns { user, supabase } if authorized, null otherwise.
 * Uses cookie-based auth via createSupabaseClient (SSR-aware).
 */
async function requireAdmin(req, res) {
  const supabase = createSupabaseClient(req, res);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "Admin") return null;

  return { user, supabase };
}

/**
 * Groups transactions by time period (day/week/month).
 * Does grouping in JS instead of SQL for simplicity and flexibility.
 */
function groupByPeriod(transactions, period) {
  const groups = {};

  transactions.forEach((tx) => {
    const date = new Date(tx.created_at);
    let key;

    switch (period) {
      case "day":
        key = date.toISOString().split("T")[0];
        break;
      case "week": {
        const year = date.getFullYear();
        const startOfYear = new Date(year,0, 1);
        const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        key = `${year}-W${String(weekNum).padStart(2, "0")}`;
        break;
      }
      case "month":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        break;
      default:
        key = date.toISOString().split("T")[0];
    }

    groups[key] = (groups[key] || 0) + 1;
  });

  const sortedKeys = Object.keys(groups).sort();
  return {
    period,
    labels: sortedKeys,
    data: sortedKeys.map((k) => groups[k]),
  };
}

// GET /analytics/transactions
// Returns completed transactions grouped by day/week/month
// Query param: ?period=week (default)
router.get("/transactions", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) {
    return res.status(403).json({ ok: false, message: "Admin access required" });
  }

  const { supabase } = auth;
  const period = req.query.period || "week";

  if (!["day", "week", "month"].includes(period)) {
    return res.status(400).json({ ok: false, message: "Invalid period. Use day, week, or month." });
  }

  try {
    // Join with listings table to get category and created_at for grouping
    const { data, error } = await supabase
      .from("transactions")
      .select(`*, listings(title, price, category, created_at)`)
      .eq("status", "completed")
      .order("created_at", { ascending: true });

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const grouped = groupByPeriod(data, period);
    return res.json({ ok: true, ...grouped });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /analytics/categories
// Returns transaction counts and total value grouped by listing category
router.get("/categories", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) {
    return res.status(403).json({ ok: false, message: "Admin access required" });
  }

  const { supabase } = auth;

  try {
    const { data, error } = await supabase
      .from("transactions")
      .select(`*, listings(title, price, category)`)
      .eq("status", "completed");

    if (error) return res.status(500).json({ ok: false, error: error.message });

    // Group by category using object as lookup table
    const categories = {};
    data.forEach((tx) => {
      const cat = tx.listings?.category || "Uncategorized";
      if (!categories[cat]) {
        categories[cat] = { category: cat, count: 0, total_value: 0 };
      }
      categories[cat].count += 1;
      categories[cat].total_value += tx.listings?.price || 0;
    });

    // Sort by count descending (most popular first)
    const result = Object.values(categories).sort((a, b) => b.count - a.count);
    return res.json({ ok: true, categories: result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /analytics/export
// Returns raw completed transactions for CSV export
router.get("/export", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) {
    return res.status(403).json({ ok: false, message: "Admin access required" });
  }

  const { supabase } = auth;

  try {
    const { data, error } = await supabase
      .from("transactions")
      .select(`*, listings(title, price, category), buyer:profiles!buyer_id(name), seller:profiles!seller_id(name)`)
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, transactions: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /analytics/summary
// Returns total transactions, total value, and average value per day
router.get("/summary", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) {
    return res.status(403).json({ ok: false, message: "Admin access required" });
  }

  const { supabase } = auth;

  try {
    const { data, error } = await supabase
      .from("transactions")
      .select(`*, listings(price, created_at)`)
      .eq("status", "completed");

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const total_transactions = data.length;
    
    // Sum all listing prices using reduce
    const total_value = data.reduce((sum, tx) => sum + (tx.listings?.price || 0),0);

    // Count unique days with transactions using Set for deduplication
    const uniqueDays = new Set();
    data.forEach((tx) => {
      if (tx.created_at) uniqueDays.add(tx.created_at.split("T")[0]);
    });

    const daysWithTransactions = uniqueDays.size || 1;
    const avg_per_day = Number((total_value / daysWithTransactions).toFixed(2));

    return res.json({
      ok: true,
      total_transactions,
      total_value: Number(total_value.toFixed(2)),
      avg_per_day,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
