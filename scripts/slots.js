const API = "http://localhost:3000";

const container = document.getElementById("slots-container");
const dateInput = document.getElementById("slot-date");
const feedbackMessage = document.getElementById("feedback-message");

function isWeekday(date) {
  const d = new Date(date).getDay();
  return d >= 1 && d <= 5;
}

function showMessage(message, type) {
  if (!feedbackMessage) return;

  feedbackMessage.textContent = message;
  feedbackMessage.classList.remove("success", "error");
  feedbackMessage.classList.add(type);
  feedbackMessage.style.display = "block";
}

function clearMessage() {
  if (!feedbackMessage) return;

  feedbackMessage.textContent = "";
  feedbackMessage.classList.remove("success", "error");
  feedbackMessage.style.display = "none";
}

async function fetchSlots() {
  const date = dateInput.value;

  clearMessage();

  if (!date) {
    container.innerHTML = "<p class='loading-text'>Select a date</p>";
    return;
  }

  if (!isWeekday(date)) {
    container.innerHTML = "<p class='loading-text'>No booking available.</p>";
    return;
  }

  try {
    const res = await fetch(`${API}/slots?date=${date}`);

    if (!res.ok) {
      throw new Error("Failed to fetch slots");
    }

    const slots = await res.json();
    displaySlots(slots);
  } catch (error) {
    console.error(error);
    container.innerHTML = "<p class='loading-text'>Failed to load slots.</p>";
  }
}

function displaySlots(slots) {
  container.innerHTML = "";

  if (!slots.length) {
    container.innerHTML = "<p class='loading-text'>No slots available.</p>";
    return;
  }

  slots.forEach((slot) => {
    // hide full slots
    if (slot.bookedCount >= slot.capacity) return;

    const div = document.createElement("div");
    div.className = "slot-card";

    div.innerHTML = `
      <p><strong>${slot.time}</strong></p>
      <p>Date: ${slot.date}</p>
      <p>Capacity: ${slot.capacity - slot.bookedCount} remaining</p>
      <button>Book</button>
    `;

    div.querySelector("button").onclick = () => bookSlot(slot.id);

    container.appendChild(div);
  });
}

async function bookSlot(id) {
  clearMessage();

  try {
    const res = await fetch(`${API}/slots/book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id })
    });

    const data = await res.json();

    if (!res.ok) {
      showMessage(data.error || "Booking failed", "error");
      return;
    }

    showMessage("Slot booked successfully", "success");
    fetchSlots();
  } catch (error) {
    console.error(error);
    showMessage("Booking failed", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!dateInput || !container) return;
  dateInput.addEventListener("change", fetchSlots);
});