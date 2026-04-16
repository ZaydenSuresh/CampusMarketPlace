const Slot = require('../models/slots');

describe('Slot model', () => {
  test('creates a slot object correctly', () => {
    const slot = new Slot(1, '2026-04-20', '09:00', 5);

    expect(slot.id).toBe(1);
    expect(slot.date).toBe('2026-04-20');
    expect(slot.time).toBe('09:00');
    expect(slot.capacity).toBe(5);
    expect(slot.bookedCount).toBe(0);
    expect(slot.status).toBe('available');
  });

  test('sets status to full when bookedCount equals capacity', () => {
    const slot = new Slot(2, '2026-04-20', '10:00', 2, 2);

    expect(slot.status).toBe('full');
  });

  test('keeps status available when bookedCount is less than capacity', () => {
    const slot = new Slot(3, '2026-04-20', '11:00', 3, 1);

    expect(slot.status).toBe('available');
  });
});