const express = require("express");
const router = express.Router();

let supabase = null;

try {
    supabase = require("../database");
} catch (err) {
    console.warn("Database not available");
}

/* ================= GET ALL TRANSACTIONS ================= */

router.get("/", async (req, res) => {
    if (!supabase) {
        return res.status(503).json({ error: "Database not available" });
    }

    const { data, error } = await supabase
        .from("transactions")
        .select(`
            *,
            listings(title, image_url),

            buyer:profiles!transactions_buyer_id_fkey(
                id,
                name
            ),

            seller:profiles!transactions_seller_id_fkey(
                id,
                name
            ),

            slot_info:trade_slots!transactions_slot_id_fkey(
                date,
                time
            )
        `)
        .order("created_at", { ascending: false });

    if (error) {
        return res.status(500).json({
            error: "Failed to fetch transactions",
            details: error.message
        });
    }

    res.json(data);
});

/* ================= UPDATE TRANSACTION ================= */

router.put("/:id", async (req, res) => {
    if (!supabase) {
        return res.status(503).json({ error: "Database not available" });
    }

    const { id } = req.params;
    const { action } = req.body;

    let updateData = {};

    if (action === "dropoff") {
        updateData = {
            dropoff_confirmed: true
        };
    }

    if (action === "complete") {
        updateData = {
            collection_confirmed: true,
            status: "completed"
        };
    }

    const { error } = await supabase
        .from("transactions")
        .update(updateData)
        .eq("id", id);

    if (error) {
        return res.status(500).json({
            error: "Failed to update transaction",
            details: error.message
        });
    }

    res.json({
        success: true
    });
});

module.exports = router;