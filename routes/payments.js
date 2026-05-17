const express = require("express");
const { createSupabaseClient } = require("../lib/supabase");
const Payment = require("../models/payment");
const Shortfall = require("../models/shortfall");

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

// POST /payments/pay — Buyer confirms a cash payment
router.post("/pay", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const user = await getCurrentUser(req, res);
    if (!user) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    const { transaction_id, amount_paid } = req.body;

    if (!transaction_id || amount_paid == null) {
      return res.status(400).json({
        ok: false,
        message: "transaction_id and amount_paid are required",
      });
    }

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*, listings!inner(price)")
      .eq("id", transaction_id)
      .single();

    if (txError || !transaction) {
      return res.status(404).json({ ok: false, message: "Transaction not found" });
    }

    if (transaction.buyer_id !== user.id) {
      return res.status(403).json({ ok: false, message: "You are not the buyer for this transaction" });
    }

    if (transaction.status !== "in_progress") {
      return res.status(400).json({ ok: false, message: "Can only pay while transaction is in progress" });
    }

    const listingPrice = Number(transaction.listings.price);
    const paid = Number(amount_paid);

    if (paid <= 0 || paid > listingPrice) {
      return res.status(400).json({ ok: false, message: `amount_paid must be between 0 and ${listingPrice}` });
    }

    const payment = await Payment.create({
      transaction_id,
      amount_paid: paid,
      payment_method: "cash",
      status: "paid",
    });

    let shortfall = null;

    if (paid < listingPrice) {
      const owed = +(listingPrice - paid).toFixed(2);
      shortfall = await Shortfall.create({ transaction_id, amount_owed: owed });
      await supabase.from("transactions").update({ status: "awaiting_payment" }).eq("id", transaction_id);
    } else {
      await supabase.from("transactions").update({ status: "paid" }).eq("id", transaction_id);
    }

    return res.json({ ok: true, payment, shortfall });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// POST /payments/initialize — Initialize Paystack standard checkout
router.post("/initialize", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const user = await getCurrentUser(req, res);
    if (!user) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    const { transaction_id, amount_paid } = req.body;

    if (!transaction_id || amount_paid == null) {
      return res.status(400).json({
        ok: false,
        message: "transaction_id and amount_paid are required",
      });
    }

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*, listings!inner(price)")
      .eq("id", transaction_id)
      .single();

    if (txError || !transaction) {
      return res.status(404).json({ ok: false, message: "Transaction not found" });
    }

    if (transaction.buyer_id !== user.id) {
      return res.status(403).json({ ok: false, message: "You are not the buyer for this transaction" });
    }

    if (transaction.status !== "in_progress") {
      return res.status(400).json({ ok: false, message: "Can only pay while transaction is in progress" });
    }

    const listingPrice = Number(transaction.listings.price);
    const paid = Number(amount_paid);

    if (paid <= 0 || paid > listingPrice) {
      return res.status(400).json({ ok: false, message: `amount_paid must be between 0 and ${listingPrice}` });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    const email = profile?.email || user.email || "payer@marketplace.com";
    const reference = `CAMPUS-${transaction_id}-${Date.now()}`;
    const callbackUrl = `${req.protocol}://${req.get("host")}/payments/callback`;

    const psResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(paid * 100),
        reference,
        callback_url: callbackUrl,
        metadata: { transaction_id, amount_paid: paid },
      }),
    });

    const psResult = await psResponse.json();

    if (!psResult.status) {
      return res.status(400).json({ ok: false, message: psResult.message || "Paystack initialization failed" });
    }

    return res.json({
      ok: true,
      authorization_url: psResult.data.authorization_url,
      reference: psResult.data.reference,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// GET /payments/callback — Paystack redirects here after checkout
router.get("/callback", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const { reference } = req.query;

    if (!reference) {
      return res.redirect("/student-transactions.html?payment_error=No+reference+returned");
    }

    const psResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      },
    );

    const psResult = await psResponse.json();

    if (!psResult.status || psResult.data.status !== "success") {
      const txId = reference.split("-")[1] || "";
      return res.redirect(
        `/payment.html?transactionId=${txId}&error=Payment+verification+failed`,
      );
    }

    const transaction_id = psResult.data.metadata?.transaction_id;
    const amount_paid = Number(psResult.data.metadata?.amount_paid || 0);

    if (!transaction_id || amount_paid <= 0) {
      return res.redirect("/student-transactions.html?payment_error=Invalid+payment+data");
    }

    const { data: transaction } = await supabase
      .from("transactions")
      .select("*, listings!inner(price)")
      .eq("id", transaction_id)
      .single();

    if (!transaction) {
      return res.redirect("/student-transactions.html?payment_error=Transaction+not+found");
    }

    const payment = await Payment.create({
      transaction_id,
      amount_paid,
      payment_method: "paystack",
      status: "paid",
    });

    const listingPrice = Number(transaction.listings.price);
    let shortfall = null;

    if (amount_paid < listingPrice) {
      const owed = +(listingPrice - amount_paid).toFixed(2);
      shortfall = await Shortfall.create({ transaction_id, amount_owed: owed });
      await supabase.from("transactions").update({ status: "awaiting_payment" }).eq("id", transaction_id);
    } else {
      await supabase.from("transactions").update({ status: "paid" }).eq("id", transaction_id);
    }

    return res.redirect("/student-transactions.html?payment=success");
  } catch (err) {
    return res.redirect("/student-transactions.html?payment_error=" + encodeURIComponent(err.message));
  }
});

// GET /payments/:transactionId — View payment status
router.get("/:transactionId", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const user = await getCurrentUser(req, res);
    if (!user) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    const { transactionId } = req.params;

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("buyer_id, seller_id")
      .eq("id", transactionId)
      .single();

    if (txError || !transaction) {
      return res
        .status(404)
        .json({ ok: false, message: "Transaction not found" });
    }

    if (transaction.buyer_id !== user.id && transaction.seller_id !== user.id) {
      return res
        .status(403)
        .json({ ok: false, message: "Not authorized to view this payment" });
    }

    const payments = await Payment.findByTransaction(transactionId);
    const shortfalls = await Shortfall.findByTransaction(transactionId);

    // convert each payment to a number and sum them up
    const total_paid = payments.reduce(
      (sum, p) => sum + Number(p.amount_paid),
      0,
    );
    // convert each outstanding shortfall to a number and sum them up
    const total_shortfall = shortfalls
      .filter((s) => s.status === "outstanding")
      .reduce((sum, s) => sum + Number(s.amount_owed), 0);
    // check if all shortfalls have been settled
    const fully_paid =
      payments.length > 0 && shortfalls.every((s) => s.status === "settled");

    return res.json({
      ok: true,
      payments,
      shortfalls,
      total_paid,
      total_shortfall,
      fully_paid,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// PUT /payments/:transactionId/settle-shortfall — Staff confirms cash settlement
router.put("/:transactionId/settle-shortfall", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const user = await getCurrentUser(req, res);
    if (!user) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "Staff" && profile.role !== "Admin")) {
      return res
        .status(403)
        .json({ ok: false, message: "Only staff can settle shortfalls" });
    }

    const { transactionId } = req.params;

    const shortfalls = await Shortfall.findByTransaction(transactionId);
    const outstanding = shortfalls.find((s) => s.status === "outstanding");

    if (!outstanding) {
      return res
        .status(404)
        .json({ ok: false, message: "No outstanding shortfall found" });
    }

    const settled = await Shortfall.settle(outstanding.id);

    const remaining = await Shortfall.findByTransaction(transactionId);
    const hasOutstanding = remaining.some((s) => s.status === "outstanding");

    if (!hasOutstanding) {
      await supabase
        .from("transactions")
        .update({ status: "paid" })
        .eq("id", transactionId);
    }

    return res.json({ ok: true, shortfall: settled });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
