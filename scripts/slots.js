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
    container.innerHTML = "<p>Select a date</p>";
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
    displaySlots(slots, date);
  } catch (error) {
    console.error("Error loading slots:", error);
    container.innerHTML = "<p class='loading-text'>Failed to load slots.</p>";
  }
}

function displaySlots(slots, date) {
  container.innerHTML = "";

  if (!slots.length) {
    container.innerHTML = "<p class='loading-text'>No booking available.</p>";
    return;
  }

  slots.forEach((slot) => {
    const div = document.createElement("div");
    div.className = "slot-card";

    div.innerHTML = `
      <p><strong>${slot.time}</strong></p>
      <button>Book</button>
    `;

    div.querySelector("button").onclick = () => bookSlot(date, slot.time);

    container.appendChild(div);
  });
}

function to24(time) {
  let [t, p] = time.split(" ");
  let [h, m] = t.split(":").map(Number);

  if (p === "PM" && h !== 12) h += 12;
  if (p === "AM" && h === 12) h = 0;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function bookSlot(date, time) {
  clearMessage();

  try {
    const res = await fetch(`${API}/slots/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        time: to24(time)
      })
    });

    const data = await res.json();

    if (!res.ok) {
      showMessage(data.error || "Failed to book slot", "error");
      return;
    }

    showMessage("The slot has been booked", "success");
    fetchSlots();
  } catch (error) {
    console.error("Error booking slot:", error);
    showMessage("Failed to book slot", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!dateInput || !container) return;

  dateInput.addEventListener("change", fetchSlots);
});