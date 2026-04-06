class Slot {
  constructor(id, time, isAvailable = true, isBooked = false) {
    this.id = id;
    this.time = time;
    this.isAvailable = isAvailable;
    this.isBooked = isBooked;
  }
}

module.exports = Slot;