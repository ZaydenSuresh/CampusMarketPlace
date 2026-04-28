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
  clearMessage();

  container.innerHTML = "<p class='loading-text'>Loading slots...</p>";

  try {
    const res = await fetch(`${API}/slots`);

    if (!res.ok) {
      throw new Error("Failed to fetch slots");
    }

    let slots = await res.json();

    /* student selected a date -> filter frontend only */
    const selectedDate = dateInput.value;

    if (selectedDate) {
      if (!isWeekday(selectedDate)) {
        container.innerHTML =
          "<p class='loading-text'>No booking available on weekends.</p>";
        return;
      }

      slots = slots.filter(slot => slot.date === selectedDate);
    }

    displaySlots(slots);

  } catch (error) {
    console.error(error);
    container.innerHTML =
      "<p class='loading-text'>Failed to load slots.</p>";
  }
}

function displaySlots(slots) {
  container.innerHTML = "";

  /* hide full slots */
  const availableSlots = slots.filter(
    slot => slot.bookedCount < slot.capacity
  );

  if (!availableSlots.length) {
    container.innerHTML =
      "<p class='loading-text'>No available slots found.</p>";
    return;
  }

  availableSlots.forEach(slot => {
    const remaining = slot.capacity - slot.bookedCount;

    const div = document.createElement("div");
    div.className = "slot-card";

    div.innerHTML = `
      <p><strong>${slot.time}</strong></p>
      <p>Date: ${slot.date}</p>
      <p>${remaining} remaining</p>
      <button class="book-btn">Book Slot</button>
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

  fetchSlots(); /* load immediately */

  dateInput.addEventListener("change", fetchSlots);
});