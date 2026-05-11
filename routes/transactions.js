const express = require("express");
const { createSupabaseClient } = require("../lib/supabase");

const router = express.Router();

// Extract authenticated user from session cookie
async function getCurrentUser(req, res) {
  const supabase = createSupabaseClient(req, res);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// GET /transactions?user_id=&status= — fetch transactions (all if no filter)
router.get("/", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const { user_id, status } = req.query;

    let query = supabase
      .from("transactions")
      .select(
        `
        *,
        listings(title, image_url),
        buyer:profiles!transactions_buyer_id_fkey(id, name),
        seller:profiles!transactions_seller_id_fkey(id, name),
        slot_info:trade_slots!transactions_slot_id_fkey(date, time)
      `
      )
      .order("created_at", { ascending: false });

    // Filter: show only transactions where the user is buyer or seller
    if (user_id) {
      query = query.or(`buyer_id.eq.${user_id},seller_id.eq.${user_id}`);
    }

    // Optional status filter (pending, in_progress, completed, cancelled)
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /transactions — book a trade slot for a reserved listing (student confirms)
router.post("/", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const user = await getCurrentUser(req, res);

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { listing_id, slot_id } = req.body;

    if (!listing_id || !slot_id) {
      return res
        .status(400)
        .json({ error: "listing_id and slot_id are required" });
    }

    // Check listing exists and is reserved
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listing_id)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (listing.status !== "reserved") {
      return res.status(400).json({ error: "Listing is not reserved" });
    }

    // Find the pending transaction created when listing was reserved
    const { data: pendingTrans, error: transError } = await supabase
      .from("transactions")
      .select("*")
      .eq("listing_id", listing_id)
      .eq("status", "pending")
      .single();

    if (transError || !pendingTrans) {
      return res
        .status(404)
        .json({ error: "No pending transaction found for this listing" });
    }

    // Verify the current user is the buyer
    if (pendingTrans.buyer_id !== user.id) {
      return res
        .status(403)
        .json({ error: "You are not the buyer for this transaction" });
    }

    // Check slot exists and has capacity
    const { data: slot, error: slotError } = await supabase
      .from("trade_slots")
      .select("*")
      .eq("id", slot_id)
      .single();

    if (slotError || !slot) {
      return res.status(404).json({ error: "Slot not found" });
    }

    if (slot.booked_count >= slot.capacity) {
      return res.status(400).json({ error: "Slot is full" });
    }

    // Assign slot and advance status to in_progress
    const { data: updated, error: updateError } = await supabase
      .from("transactions")
      .update({
        slot_id,
        status: "in_progress",
      })
      .eq("id", pendingTrans.id)
      .select("*");

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    // Increment slot booked_count
    const { error: bookError } = await supabase
      .from("trade_slots")
      .update({ booked_count: slot.booked_count + 1 })
      .eq("id", slot_id);

    if (bookError) {
      console.error("Failed to increment slot booked_count:", bookError);
    }

    res.json({ ok: true, transaction: updated[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id/cancel — cancel a transaction (buyer or seller), revert listing to available
router.put("/:id/cancel", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const user = await getCurrentUser(req, res);

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;

    // Fetch transaction to verify ownership
    const { data: trans, error: transError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (transError || !trans) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Only the buyer or seller can cancel
    if (trans.buyer_id !== user.id && trans.seller_id !== user.id) {
      return res
        .status(403)
        .json({ error: "Not authorized to cancel this transaction" });
    }

    // Mark transaction as cancelled
    const { error: cancelError } = await supabase
      .from("transactions")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (cancelError) {
      return res.status(500).json({ error: cancelError.message });
    }

    // Put the listing back up for grabs
    const { error: listingError } = await supabase
      .from("listings")
      .update({
        status: "available",
        reserved_by: null,
      })
      .eq("id", trans.listing_id);

    if (listingError) {
      console.error("Failed to revert listing:", listingError);
    }

    res.json({ ok: true, message: "Transaction cancelled" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id — staff-only actions: confirm dropoff or mark as complete
router.put("/:id", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const { id } = req.params;
    const { action } = req.body;

    let updateData = {};

    if (action === "dropoff") {
      // Staff confirms seller dropped off the item
      updateData.dropoff_confirmed = true;
    }

    if (action === "complete") {
      // Staff confirms buyer collected the item
      updateData.collection_confirmed = true;
      updateData.status = "completed";
    }

    const { error } = await supabase
      .from("transactions")
      .update(updateData)
      .eq("id", id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
