const API = "http://localhost:3000";

const form = document.getElementById("create-slot-form");
const dateInput = document.getElementById("slot-date");
const timeInput = document.getElementById("slot-time");
const capacityInput = document.getElementById("slot-capacity");
const container = document.getElementById("staff-slots-container");
const feedbackMessage = document.getElementById("feedback-message");

function showMessage(message, type) {
  feedbackMessage.textContent = message;
  feedbackMessage.classList.remove("success", "error");
  feedbackMessage.classList.add(type);
  feedbackMessage.style.display = "block";
}

function clearMessage() {
  feedbackMessage.textContent = "";
  feedbackMessage.classList.remove("success", "error");
  feedbackMessage.style.display = "none";
}

async function fetchSlotsByDate(date) {
  const res = await fetch(`${API}/slots?date=${date}`);
  if (!res.ok) throw new Error("Failed to fetch slots");
  return res.json();
}

async function renderSlots() {
  const date = dateInput.value;

  if (!date) {
    container.innerHTML = "<p class='loading-text'>Select a date to manage slots.</p>";
    return;
  }

  try {
    const slots = await fetchSlotsByDate(date);

    if (!slots.length) {
      container.innerHTML = "<p class='loading-text'>No slots created for this date.</p>";
      return;
    }

    container.innerHTML = "";

    slots.forEach((slot) => {
      const div = document.createElement("div");
      div.className = "slot-card";

      div.innerHTML = `
        <p><strong>${slot.time}</strong></p>
        <p>Date: ${slot.date}</p>
        <p>Capacity: ${slot.capacity}</p>
        <p>Status: ${slot.status}</p>
        <button class="delete-btn" data-id="${slot.id}">Delete</button>
      `;

      div.querySelector(".delete-btn").addEventListener("click", async () => {
        await deleteSlot(slot.id);
      });

      container.appendChild(div);
    });
  } catch (error) {
    console.error(error);
    container.innerHTML = "<p class='loading-text'>Failed to load slots.</p>";
  }
}

async function createSlot(event) {
  event.preventDefault();
  clearMessage();

  const date = dateInput.value;
  const time = timeInput.value;
  const capacity = capacityInput.value;

  if (!date || !time || !capacity) {
    showMessage("Please fill in all fields", "error");
    return;
  }

  try {
    const res = await fetch(`${API}/slots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        date,
        time,
        capacity: Number(capacity)
      })
    });

    const data = await res.json();

    if (!res.ok) {
      showMessage(data.error || "Failed to create slot", "error");
      return;
    }

    showMessage("Slot created successfully", "success");
    form.reset();
    dateInput.value = date;
    renderSlots();
  } catch (error) {
    console.error(error);
    showMessage("Failed to create slot", "error");
  }
}

async function deleteSlot(id) {
  clearMessage();

  try {
    const res = await fetch(`${API}/slots/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();

    if (!res.ok) {
      showMessage(data.error || "Failed to delete slot", "error");
      return;
    }

    showMessage("Slot deleted successfully", "success");
    renderSlots();
  } catch (error) {
    console.error(error);
    showMessage("Failed to delete slot", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (form) {
    form.addEventListener("submit", createSlot);
  }

  if (dateInput) {
    dateInput.addEventListener("change", renderSlots);
  }
});