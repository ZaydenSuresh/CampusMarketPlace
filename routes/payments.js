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

// POST /payments/pay — Buyer submits a payment (Paystack or cash)
router.post("/pay", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const user = await getCurrentUser(req, res);
    if (!user) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    const { transaction_id, amount_paid, payment_method, paystack_reference } =
      req.body;

    if (!transaction_id || amount_paid == null || !payment_method) {
      return res
        .status(400)
        .json({
          ok: false,
          message:
            "transaction_id, amount_paid, and payment_method are required",
        });
    }

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*, listings!inner(price)") // join with listings to get the price
      .eq("id", transaction_id)
      .single();

    if (txError || !transaction) {
      return res
        .status(404)
        .json({ ok: false, message: "Transaction not found" });
    }

    if (transaction.buyer_id !== user.id) {
      return res
        .status(403)
        .json({
          ok: false,
          message: "You are not the buyer for this transaction",
        });
    }

    if (transaction.status !== "in_progress") {
      return res
        .status(400)
        .json({
          ok: false,
          message: "Can only pay while transaction is in progress",
        });
    }

    const listingPrice = Number(transaction.listings.price);
    const paid = Number(amount_paid);

    if (paid <= 0 || paid > listingPrice) {
      return res
        .status(400)
        .json({
          ok: false,
          message: `amount_paid must be between 0 and ${listingPrice}`,
        });
    }

    if (payment_method === "paystack") {
      if (!paystack_reference) {
        return res
          .status(400)
          .json({
            ok: false,
            message: "paystack_reference is required for Paystack payments",
          });
      }

      // verify the Paystack transaction using the provided reference
      const psResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${paystack_reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        },
      );

      const psResult = await psResponse.json();

      // verify that the Paystack transaction is successful
      if (!psResult.status || psResult.data.status !== "success") {
        return res
          .status(400)
          .json({ ok: false, message: "Paystack verification failed" });
      }

      // verify that the amount paid matches the amount on the Paystack transaction
      const verifiedAmount = psResult.data.amount / 100;
      if (Math.abs(verifiedAmount - paid) > 0.01) {
        return res
          .status(400)
          .json({
            ok: false,
            message: "Paystack amount does not match amount_paid",
          });
      }
    }

    // create a payment record in the database
    const payment = await Payment.create({
      transaction_id,
      amount_paid: paid,
      payment_method,
      status: "paid",
    });

    let shortfall = null;

    // if the payment is short, create a shortfall record
    if (paid < listingPrice) {
      const owed = +(listingPrice - paid).toFixed(2);
      shortfall = await Shortfall.create({ transaction_id, amount_owed: owed });
      await supabase
        .from("transactions")
        .update({ status: "awaiting_payment" })
        .eq("id", transaction_id);
    } else {
      await supabase
        .from("transactions")
        .update({ status: "paid" })
        .eq("id", transaction_id);
    }

    return res.json({ ok: true, payment, shortfall });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
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
