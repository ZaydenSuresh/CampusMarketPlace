const express = require('express');
const router = express.Router();
const Slot = require('../models/slots');
let supabase = null;

try {
  supabase = require('../database');
} catch (err) {
  console.warn('Database not available');
}

function checkDb() {
  return supabase !== null;
}

function isWeekday(dateString) {
  const date = new Date(dateString);
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function formatTime(time24) {
  let [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';

  if (h > 12) h -= 12;
  if (h === 0) h = 12;

  return `${h}:${m.toString().padStart(2, '0')} ${suffix}`;
}

// GET slots by date for students/staff
router.get('/', async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date required' });
  }

  if (!isWeekday(date)) {
    return res.json([]);
  }

  const { data, error } = await supabase
    .from('trade_slots')
    .select('*')
    .eq('date', date)
    .order('time', { ascending: true });

  if (error) {
    return res.status(500).json({ error: 'Failed to load slots' });
  }

  const slots = (data || []).map(
    (row) =>
      new Slot(
        row.id,
        row.date,
        formatTime((row.time || "").slice(0, 5)),
        row.capacity,
        row.booked_count || 0
      )
  );

  res.json(slots);
});

// CREATE slot - staff
router.post('/', async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  const { date, time, capacity } = req.body || {};

  if (!date || !time || capacity === undefined) {
    return res.status(400).json({ error: 'Date, time and capacity are required' });
  }

  if (!isWeekday(date)) {
    return res.status(400).json({ error: 'Slots can only be created on weekdays' });
  }

  if (Number(capacity) < 1) {
    return res.status(400).json({ error: 'Capacity must be at least 1' });
  }

  const { data, error } = await supabase
    .from('trade_slots')
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
    return res.status(500).json({ error: error.message || 'Failed to create slot' });
  }

  res.status(201).json({
    message: 'Slot created successfully',
    slot: data[0]
  });
});

// DELETE slot - staff
router.delete('/:id', async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  const { id } = req.params;

  const { error } = await supabase
    .from('trade_slots')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: 'Failed to delete slot' });
  }

  res.json({ message: 'Slot deleted successfully' });
});

// BOOK slot - keep for later
router.post('/book', async (req, res) => {
  return res.status(501).json({
    error: 'Booking logic will be implemented later'
  });
});

module.exports = router;