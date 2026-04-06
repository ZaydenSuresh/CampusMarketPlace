const express = require('express');
const router = express.Router();
const Slot = require('../models/slot');

const slots = [
  new Slot(1, '09:00 AM'),
  new Slot(2, '10:00 AM'),
  new Slot(3, '11:00 AM')
];

// GET available slots
router.get('/', (req, res) => {
  const availableSlots = slots.filter(slot => slot.isAvailable && !slot.isBooked);
  res.json(availableSlots);
});

// POST book a slot
router.post('/book/:id', (req, res) => {
  const slotId = parseInt(req.params.id, 10);
  const slot = slots.find(s => s.id === slotId);

  if (!slot) {
    return res.status(404).json({ error: 'Slot not found' });
  }

  if (!slot.isAvailable || slot.isBooked) {
    return res.status(400).json({ error: 'Slot already booked' });
  }

  slot.isBooked = true;
  slot.isAvailable = false;

  res.json({
    message: 'Slot booked successfully',
    slot
  });
});

module.exports = router;