const express = require("express");
const { createSupabaseClient } = require("../lib/supabase");

// ADDED BY KHANYISILE
const PDFDocument = require("pdfkit");

const router = express.Router();

async function requireAdmin(req, res) {
  const supabase = createSupabaseClient(req, res);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "Admin") return null;

  return { user, supabase };
}

// KEEP EXISTING
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
        const startOfYear = new Date(year, 0, 1);
        const days = Math.floor((date - startOfYear) / 86400000);
        const weekNum = Math.ceil(
          (days + startOfYear.getDay() + 1) / 7
        );

        key = `${year}-W${String(weekNum).padStart(2, "0")}`;
        break;
      }

      case "month":
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        break;

      default:
        key = date.toISOString().split("T")[0];
    }

    groups[key] = (groups[key] || 0) + 1;
  });

  return {
    labels: Object.keys(groups),
    data: Object.values(groups),
  };
}

// EXISTING ENDPOINTS (unchanged)
router.get("/transactions", async (req, res) => {
  const auth = await requireAdmin(req, res);

  // ADDED BY KHANYISILE
  if (!auth) {
    return res.status(403).json({
      ok: false,
      error: "Admin access required",
    });
  }

  const { supabase } = auth;

  const { data, error } = await supabase
    .from("transactions")
    .select("*, listings(*)")
    .eq("status", "completed");

  if (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }

  const grouped = groupByPeriod(
    data || [],
    req.query.period || "week"
  );

  return res.json({
    ok: true,
    ...grouped,
  });
});

// ADDED BY KHANYISILE — Card 11
router.get("/slots", async (req, res) => {
  const auth = await requireAdmin(req, res);

  if (!auth) {
    return res.status(403).json({
      ok: false,
      error: "Admin access required",
    });
  }

  const { supabase } = auth;

  // ADDED BY KHANYISILE
  // Only include slots whose booking date
  // has not yet passed.
  const today = new Date()
    .toISOString()
    .split("T")[0];

  let query = supabase
    .from("trade_slots")
    .select("*")
    .gte("date", today);

  // ADDED BY KHANYISILE
  if (req.query.from) {
    query = query.gte("date", req.query.from);
  }

  // ADDED BY KHANYISILE
  if (req.query.to) {
    query = query.lte("date", req.query.to);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }

  const slots = data || [];

  const summary = {
    total_slots: slots.length,

    total_capacity: slots.reduce(
      (a, b) => a + (b.capacity || 0),
      0
    ),

    // ADDED BY KHANYISILE
    total_booked: slots.reduce(
      (a, b) => a + (b.booked_count || 0),
      0
    ),
  };

  summary.utilisation_pct =
    summary.total_capacity > 0
      ? Number(
          (
            (summary.total_booked /
              summary.total_capacity) *
            100
          ).toFixed(2)
        )
      : 0;

  // ADDED BY KHANYISILE
  const byDateMap = {};

  slots.forEach((slot) => {
    const date =
      slot.date ||
      slot.created_at?.split("T")[0] ||
      "Unknown";

    if (!byDateMap[date]) {
      byDateMap[date] = {
        date,
        capacity: 0,
        booked: 0,
      };
    }

    byDateMap[date].capacity +=
      slot.capacity || 0;

    // ADDED BY KHANYISILE
    byDateMap[date].booked +=
      slot.booked_count || 0;
  });

  // ADDED BY KHANYISILE
  const by_date = Object.values(byDateMap).map(
    (d) => ({
      ...d,

      utilisation_pct:
        d.capacity > 0
          ? Number(
              (
                (d.booked / d.capacity) *
                100
              ).toFixed(2)
            )
          : 0,
    })
  );

  return res.json({
    ok: true,
    summary,
    by_date,
  });
});

// ADDED BY KHANYISILE — Card 12
router.get("/flagged-content", async (req, res) => {
  const auth = await requireAdmin(req, res);

  if (!auth) {
    return res.status(403).json({
      ok: false,
      error: "Admin access required",
    });
  }

  const { supabase } = auth;

  const { data, error } = await supabase
    .from("ratings")
    .select("*");

  if (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }

  const ratings = data || [];

  return res.json({
    ok: true,
    summary: {
      total_reviews: ratings.length,

      flagged_count: ratings.filter(
        (r) => r.flagged
      ).length,

      removed_count: ratings.filter(
        (r) => r.removed
      ).length,
    },
  });
});

// ADDED BY KHANYISILE — Card 13 PDF
router.get("/export/pdf", async (req, res) => {
  const auth = await requireAdmin(req, res);

  if (!auth) {
    return res.status(403).json({
      ok: false,
      error: "Admin access required",
    });
  }

  const { supabase } = auth;

  const { data, error } = await supabase
    .from("transactions")
    .select("*, listings(*)")
    .eq("status", "completed");

  if (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }

  const transactions = data || [];

  const doc = new PDFDocument();

  res.setHeader(
    "Content-Type",
    "application/pdf"
  );

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=analytics-report-${new Date()
      .toISOString()
      .split("T")[0]}.pdf`
  );

  doc.pipe(res);

  doc.fontSize(20).text(
    "Campus Marketplace — Analytics Report"
  );

  doc.moveDown();

  doc
    .fontSize(12)
    .text(
      `Generated: ${new Date().toISOString()}`
    );

  doc.moveDown();

  doc.fontSize(16).text("Completed Transactions");

  doc.moveDown();

  if (transactions.length === 0) {
    doc.text("No data available");
  } else {
    transactions.forEach((t) => {
      doc.text(
        `${t.listings?.title || "Unknown Listing"} - R${
          t.listings?.price || 0
        }`
      );
    });
  }

  doc.end();
});

module.exports = router;