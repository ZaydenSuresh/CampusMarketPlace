class Slot {
  constructor(id, date, time, capacity, bookedCount = 0) {
    this.id = id;
    this.date = date;
    this.time = time;
    this.capacity = capacity;
    this.bookedCount = bookedCount;
    this.status = bookedCount >= capacity ? 'full' : 'available';
  }
}

module.exports = Slot;