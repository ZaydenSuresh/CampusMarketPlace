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
        .select("*")
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
    const { id } = req.params;
    const { action } = req.body;

    if (!supabase) {
        return res.status(503).json({ error: "Database not available" });
    }

    try {
        let updates = {};

        if (action === "dropoff") {
            updates.dropoff_confirmed = true;
        }

        if (action === "complete") {
            updates.collection_confirmed = true;
            updates.status = "completed";
        }

        const { error } = await supabase
            .from("transactions")
            .update(updates)
            .eq("id", id);

        if (error) {
            return res.status(500).json({
                error: "Update failed",
                details: error.message
            });
        }

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({
            error: "Unexpected error",
            details: err.message
        });
    }
});

module.exports = router;