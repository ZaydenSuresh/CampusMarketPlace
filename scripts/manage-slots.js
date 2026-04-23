const API = "http://localhost:3000";

const form = document.getElementById("create-slot-form");
const dateInput = document.getElementById("slot-date");
const timeInput = document.getElementById("slot-time");
const capacityInput = document.getElementById("slot-capacity");
const container = document.getElementById("staff-slots-container");
const feedbackMessage = document.getElementById("feedback-message");

function showMessage(message, type) {
    feedbackMessage.textContent = message;
    feedbackMessage.className = "feedback-message " + type;
}

function clearMessage() {
    feedbackMessage.textContent = "";
    feedbackMessage.className = "feedback-message";
}

async function fetchSlotsByDate(date) {
    const res = await fetch(`${API}/slots?date=${date}`);
    return await res.json();
}

function updateStats(slots) {
    let total = slots.length;
    let booked = 0;
    let open = 0;
    let capacity = 0;

    slots.forEach(slot => {
        booked += slot.bookedCount;
        capacity += slot.capacity;

        if (slot.capacity - slot.bookedCount > 0) {
            open++;
        }
    });

    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-booked").textContent = booked;
    document.getElementById("stat-open").textContent = open;
    document.getElementById("stat-capacity").textContent = capacity;
}

async function renderSlots() {
    const date = dateInput.value;

    if (!date) return;

    const slots = await fetchSlotsByDate(date);

    updateStats(slots);

    if (!slots.length) {
        container.innerHTML = `<p class="loading-text">No slots found.</p>`;
        return;
    }

    container.innerHTML = "";

    slots.forEach(slot => {
        const card = document.createElement("article");
        card.className = "slot-card";

        card.innerHTML = `
            <h4>${slot.time}</h4>
            <p>Date: ${slot.date}</p>
            <p>Capacity: ${slot.capacity}</p>
            <p>Booked: ${slot.bookedCount}</p>
            <p>Remaining: ${slot.capacity - slot.bookedCount}</p>
            <p>Status: ${slot.status}</p>

            <section class="slot-actions">
                <button class="edit-btn">Edit</button>
                <button class="delete-btn">Delete</button>
            </section>
        `;

        card.querySelector(".delete-btn").onclick = () => deleteSlot(slot.id);

        container.appendChild(card);
    });
}

async function createSlot(e) {
    e.preventDefault();

    clearMessage();

    const date = dateInput.value;
    const time = timeInput.value;
    const capacity = capacityInput.value;

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
        showMessage(data.error || "Failed", "error");
        return;
    }

    showMessage("Slot created successfully", "success");

    renderSlots();
}

async function deleteSlot(id) {
    const res = await fetch(`${API}/slots/${id}`, {
        method: "DELETE"
    });

    const data = await res.json();

    if (!res.ok) {
        showMessage(data.error || "Delete failed", "error");
        return;
    }

    showMessage("Slot deleted", "success");

    renderSlots();
}

document.addEventListener("DOMContentLoaded", () => {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;

    renderSlots();

    dateInput.addEventListener("change", renderSlots);

    form.addEventListener("submit", createSlot);
});