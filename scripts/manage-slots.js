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
        <div class="slot-view">
          <p><strong>${slot.time}</strong></p>
          <p>Date: ${slot.date}</p>

          <p>Total Capacity: ${slot.capacity}</p>
          <p>Booked: ${slot.bookedCount}</p>
          <p>Remaining: ${slot.capacity - slot.bookedCount}</p>

          <p>Status: ${slot.status}</p>

          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>
        </div>

        <div class="slot-edit" style="display:none;">
          <input type="date" value="${slot.date.replaceAll("/", "-")}" class="edit-date" />
          <input type="time" value="${to24(slot.time)}" class="edit-time" />
          <input type="number" value="${slot.capacity}" class="edit-capacity" min="1" />

          <button class="save-btn">Save</button>
          <button class="cancel-btn">Cancel</button>
        </div>
      `;

      const view = div.querySelector(".slot-view");
      const edit = div.querySelector(".slot-edit");

      // DELETE
      div.querySelector(".delete-btn").onclick = () => deleteSlot(slot.id);

      // EDIT
      div.querySelector(".edit-btn").onclick = () => {
        view.style.display = "none";
        edit.style.display = "block";
      };

      // CANCEL
      div.querySelector(".cancel-btn").onclick = () => {
        edit.style.display = "none";
        view.style.display = "block";
      };

      // SAVE
      div.querySelector(".save-btn").onclick = async () => {
        let newDate = div.querySelector(".edit-date").value;
        const newTime = div.querySelector(".edit-time").value;
        const newCapacity = div.querySelector(".edit-capacity").value;

        newDate = newDate.replaceAll("/", "-");

        if (!newDate || !newTime || !newCapacity) {
          showMessage("Fill all fields", "error");
          return;
        }

        try {
          const res = await fetch(`${API}/slots/${slot.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              date: newDate,
              time: newTime,
              capacity: Number(newCapacity)
            })
          });

          const data = await res.json();

          if (!res.ok) {
            showMessage(data.error || "Update failed", "error");
            return;
          }

          showMessage("Slot updated successfully", "success");
          renderSlots();
        } catch (err) {
          console.error(err);
          showMessage("Update failed", "error");
        }
      };

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
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;

    dateInput.addEventListener("change", renderSlots);
    renderSlots();
  }
});

function to24(time) {
  let [t, p] = time.split(" ");
  let [h, m] = t.split(":").map(Number);

  if (p === "PM" && h !== 12) h += 12;
  if (p === "AM" && h === 12) h = 0;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}