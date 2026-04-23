const express = require("express");
const router = express.Router();
const Slot = require("../models/slots");

let supabase = null;

try {
    supabase = require("../database");
} catch (err) {
    console.warn("Database not available");
}

function checkDb() {
    return supabase !== null;
}

function isWeekday(dateString) {
    const date = new Date(dateString);
    const day = date.getDay(); // 0 Sun, 6 Sat
    return day >= 1 && day <= 5;
}

function isValidBusinessTime(time) {
    if (!time) return false;

    const clean = time.slice(0, 5); // HH:MM
    const [hour, minute] = clean.split(":").map(Number);

    const total = hour * 60 + minute;

    return total >= 480 && total <= 1020; 
    // 08:00 = 480
    // 17:00 = 1020
}

function formatTime(time24) {
    let [h, m] = time24.split(":").map(Number);

    const suffix = h >= 12 ? "PM" : "AM";

    if (h > 12) h -= 12;
    if (h === 0) h = 12;

    return `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

/* ================= GET ALL FUTURE SLOTS ================= */

router.get("/", async (req, res) => {
    if (!checkDb()) {
        return res.status(503).json({ error: "Database not available" });
    }

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
        .from("trade_slots")
        .select("*")
        .gte("date", today)
        .order("date", { ascending: true })
        .order("time", { ascending: true });

    if (error) {
        return res.status(500).json({ error: "Failed to load slots" });
    }

    const slots = (data || []).map(row => ({
        id: row.id,
        date: row.date,
        time: formatTime((row.time || "").slice(0, 5)),
        capacity: row.capacity,
        bookedCount: row.booked_count || 0
    }));

    res.json(slots);
});

/* ================= CREATE SLOT ================= */

router.post("/", async (req, res) => {
    if (!checkDb()) {
        return res.status(503).json({ error: "Database not available" });
    }

    const { date, time, capacity } = req.body || {};

    if (!date || !time || capacity === undefined) {
        return res.status(400).json({
            error: "Date, time and capacity required"
        });
    }

    if (!isWeekday(date)) {
        return res.status(400).json({
            error: "Slots may only be created on weekdays"
        });
    }

    if (!isValidBusinessTime(time)) {
        return res.status(400).json({
            error: "Slots must be between 08:00 and 17:00"
        });
    }

    if (Number(capacity) < 1) {
        return res.status(400).json({
            error: "Capacity must be at least 1"
        });
    }

    const { data, error } = await supabase
        .from("trade_slots")
        .insert([
            {
                date,
                time,
                capacity: Number(capacity),
                booked_count: 0
            }
        ])
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    res.status(201).json({
        message: "Slot created successfully",
        slot: data[0]
    });
});

/* ================= EDIT SLOT ================= */

router.put("/:id", async (req, res) => {
    if (!checkDb()) {
        return res.status(503).json({ error: "Database not available" });
    }

    const { id } = req.params;
    let { date, time, capacity } = req.body || {};

    if (!date || !time || capacity === undefined) {
        return res.status(400).json({
            error: "All fields are required"
        });
    }

    if (!isWeekday(date)) {
        return res.status(400).json({
            error: "Slots may only be on weekdays"
        });
    }

    if (!isValidBusinessTime(time)) {
        return res.status(400).json({
            error: "Slots must be between 08:00 and 17:00"
        });
    }

    const { data: existingRows, error: fetchError } = await supabase
        .from("trade_slots")
        .select("*")
        .eq("id", id);

    if (fetchError || !existingRows.length) {
        return res.status(404).json({
            error: "Slot not found"
        });
    }

    const existing = existingRows[0];

    if (Number(capacity) < existing.booked_count) {
        return res.status(400).json({
            error: "Capacity cannot be below booked count"
        });
    }

    if (time.length === 5) time += ":00";

    const { data, error } = await supabase
        .from("trade_slots")
        .update({
            date,
            time,
            capacity: Number(capacity)
        })
        .eq("id", id)
        .select();

    if (error) {
        return res.status(500).json({
            error: error.message
        });
    }

    res.json({
        message: "Slot updated successfully",
        slot: data[0]
    });
});

/* ================= DELETE SLOT ================= */

router.delete("/:id", async (req, res) => {
    if (!checkDb()) {
        return res.status(503).json({ error: "Database not available" });
    }

    const { id } = req.params;

    const { error } = await supabase
        .from("trade_slots")
        .delete()
        .eq("id", id);

    if (error) {
        return res.status(500).json({
            error: "Failed to delete slot"
        });
    }

    res.json({
        message: "Slot deleted successfully"
    });
});

/* ================= BOOK SLOT ================= */

router.post("/book", async (req, res) => {
    if (!checkDb()) {
        return res.status(503).json({ error: "Database not available" });
    }

    const { id } = req.body || {};

    const { data, error } = await supabase
        .from("trade_slots")
        .select("*")
        .eq("id", id);

    if (error || !data.length) {
        return res.status(404).json({
            error: "Slot not found"
        });
    }

    const slot = data[0];

    if (slot.booked_count >= slot.capacity) {
        return res.status(400).json({
            error: "Slot is full"
        });
    }

    const { data: updated, error: updateError } = await supabase
        .from("trade_slots")
        .update({
            booked_count: slot.booked_count + 1
        })
        .eq("id", id)
        .select();

    if (updateError) {
        return res.status(500).json({
            error: "Failed to book slot"
        });
    }

    res.json({
        message: "Slot booked successfully",
        slot: updated[0]
    });
});

module.exports = router;