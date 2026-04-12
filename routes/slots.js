const express = require('express');
const router = express.Router();
const Slot = require('../models/slot');

// store bookings per date
const bookingsByDate = {};

// check weekday
function isWeekday(dateString) {
  const date = new Date(dateString);
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

// generate 15-min slots from 8 to 17
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

// format to AM/PM
function formatTime(time24) {
  let [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';

  if (h > 12) h -= 12;
  if (h === 0) h = 12;

  return `${h}:${m.toString().padStart(2, '0')} ${suffix}`;
}

// GET slots by date
router.get('/', (req, res) => {
  const { date } = req.query;

  if (!date) return res.status(400).json({ error: 'Date required' });

  if (!isWeekday(date)) {
    return res.json([]); // weekend = no slots
  }

  const allSlots = generateSlots();
  const booked = bookingsByDate[date] || new Set();

  const available = allSlots
    .filter(s => !booked.has(s.time))
    .map(s => new Slot(s.id, formatTime(s.time)));

  res.json(available);
});

// BOOK slot
router.post('/book', (req, res) => {
  const { date, time } = req.body || {};
  //const { date, time } = req.body;

  if (!date || !time) {
    return res.status(400).json({ error: 'Missing date or time' });
  }

  if (!isWeekday(date)) {
    return res.status(400).json({ error: 'No booking on weekends' });
  }

  if (!bookingsByDate[date]) {
    bookingsByDate[date] = new Set();
  }

  if (bookingsByDate[date].has(time)) {
    return res.status(400).json({ error: 'Slot already booked' });
  }

  bookingsByDate[date].add(time);

  res.json({ message: 'Slot has been booked' });
});

module.exports = router;