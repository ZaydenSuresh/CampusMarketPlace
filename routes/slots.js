const express = require('express');
const router = express.Router();
const Slot = require('../models/slot');
const supabase = require('../database');

// check weekday
function isWeekday(dateString) {
  const date = new Date(dateString);
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

// generate 15-min slots from 8:00 to 4:45
function generateSlots() {
  const slots = [];
  let hour = 8;
  let minute = 0;
  let id = 1;

  while (hour < 17) {
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    slots.push({ id: id++, time });

    minute += 15;
    if (minute === 60) {
      minute = 0;
      hour++;
    }
  }

  return slots;
}

// format 24-hour time to AM/PM
function formatTime(time24) {
  let [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';

  if (h > 12) h -= 12;
  if (h === 0) h = 12;

  return `${h}:${m.toString().padStart(2, '0')} ${suffix}`;
}

// GET slots by date
router.get('/', async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date required' });
  }

  if (!isWeekday(date)) {
    return res.json([]);
  }

  const { data, error } = await supabase
    .from('slot_bookings')
    .select('booking_time')
    .eq('booking_date', date);

  if (error) {
    return res.status(500).json({ error: 'Failed to load booked slots' });
  }

  const bookedTimes = new Set((data || []).map(row => row.booking_time));
  const allSlots = generateSlots();

  const available = allSlots
    .filter(slot => !bookedTimes.has(slot.time))
    .map(slot => new Slot(slot.id, formatTime(slot.time)));

  res.json(available);
});

// BOOK slot
router.post('/book', async (req, res) => {
  const { date, time } = req.body || {};

  if (!date || !time) {
    return res.status(400).json({ error: 'Missing date or time' });
  }

  if (!isWeekday(date)) {
    return res.status(400).json({ error: 'No booking on weekends' });
  }

  const { error } = await supabase
    .from('slot_bookings')
    .insert([
      {
        booking_date: date,
        booking_time: time
      }
    ]);

  if (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Slot already booked' });
    }

    return res.status(500).json({ error: 'Failed to book slot' });
  }

  res.json({ message: 'Slot has been booked' });
});

module.exports = router;