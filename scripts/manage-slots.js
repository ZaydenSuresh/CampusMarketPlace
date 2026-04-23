const API = "http://localhost:3000";

const form = document.getElementById("create-slot-form");
const dateInput = document.getElementById("slot-date");
const timeInput = document.getElementById("slot-time");
const capacityInput = document.getElementById("slot-capacity");
const tableBody = document.getElementById("slots-table-body");
const feedbackMessage = document.getElementById("feedback-message");
const statusFilter = document.getElementById("status-filter");

let editingId = null;

/* ---------------- TIME OPTIONS ---------------- */

function populateTimes() {
    timeInput.innerHTML = "";

    for (let h = 8; h <= 17; h++) {
        for (let m = 0; m < 60; m += 15) {
            if (h === 17 && m > 0) continue;

            const hh = String(h).padStart(2, "0");
            const mm = String(m).padStart(2, "0");

            const option = document.createElement("option");
            option.value = `${hh}:${mm}`;
            option.textContent = `${hh}:${mm}`;

            timeInput.appendChild(option);
        }
    }
}

/* ---------------- MESSAGES ---------------- */

function showMessage(message, type) {
    feedbackMessage.textContent = message;
    feedbackMessage.className = "feedback-message " + type;
}

function clearMessage() {
    feedbackMessage.textContent = "";
    feedbackMessage.className = "feedback-message";
}

/* ---------------- FETCH ---------------- */

async function fetchSlots() {
    const res = await fetch(`${API}/slots`);
    return await res.json();
}

/* ---------------- STATS FIX ---------------- */

function updateStats(slots) {
    const total = slots.length;

    const full = slots.filter(
        slot => slot.bookedCount >= slot.capacity
    ).length;

    const open = slots.filter(
        slot => slot.bookedCount < slot.capacity
    ).length;

    const bookings = slots.reduce(
        (sum, slot) => sum + Number(slot.bookedCount || 0),
        0
    );

    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-booked").textContent = full;
    document.getElementById("stat-open").textContent = open;
    document.getElementById("stat-capacity").textContent = bookings;
}

/* ---------------- TABLE ---------------- */

async function renderSlots() {
    const slots = await fetchSlots();

    updateStats(slots);

    let filtered = [...slots];

    if (statusFilter.value === "available") {
        filtered = slots.filter(
            slot => slot.bookedCount < slot.capacity
        );
    }

    if (statusFilter.value === "full") {
        filtered = slots.filter(
            slot => slot.bookedCount >= slot.capacity
        );
    }

    tableBody.innerHTML = "";

    if (!filtered.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-text">
                    No slots found.
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(slot => {
        const isFull = slot.bookedCount >= slot.capacity;
        const remaining = slot.capacity - slot.bookedCount;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${slot.date}</td>
            <td>${slot.time}</td>
            <td>${slot.capacity}</td>
            <td>${slot.bookedCount}</td>
            <td>${remaining}</td>
            <td>
                <span class="${
                    isFull ? "status-full" : "status-available"
                }">
                    ${isFull ? "Full" : "Available"}
                </span>
            </td>
            <td>
                <section class="slot-actions">
                    <button type="button" class="edit-btn">
                        Edit
                    </button>

                    <button type="button" class="delete-btn">
                        Delete
                    </button>
                </section>
            </td>
        `;

        row.querySelector(".edit-btn").onclick =
            () => loadEdit(slot);

        row.querySelector(".delete-btn").onclick =
            () => deleteSlot(slot.id);

        tableBody.appendChild(row);
    });
}

/* ---------------- EDIT ---------------- */

function loadEdit(slot) {
    editingId = slot.id;

    dateInput.value = slot.date;
    capacityInput.value = slot.capacity;

    const raw = slot.time
        .replace(" AM", "")
        .replace(" PM", "");

    const isPM = slot.time.includes("PM");

    timeInput.value = convertTo24(raw, isPM);

    form.querySelector("button[type='submit']")
        .textContent = "💾 Save Changes";

    showMessage(
        "Editing slot. Click Save Changes.",
        "success"
    );
}

function convertTo24(time, isPM) {
    let [h, m] = time.split(":");
    h = Number(h);

    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;

    return `${String(h).padStart(2, "0")}:${m}`;
}

/* ---------------- SAVE ---------------- */

async function createSlot(e) {
    e.preventDefault();

    clearMessage();

    const payload = {
        date: dateInput.value,
        time: timeInput.value,
        capacity: Number(capacityInput.value)
    };

    let url = `${API}/slots`;
    let method = "POST";

    if (editingId) {
        url = `${API}/slots/${editingId}`;
        method = "PUT";
    }

    const res = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
        showMessage(
            data.error || "Failed to save slot",
            "error"
        );
        return;
    }

    showMessage(
        editingId
            ? "Slot updated successfully"
            : "Slot created successfully",
        "success"
    );

    editingId = null;

    form.reset();
    populateTimes();

    form.querySelector("button[type='submit']")
        .textContent = "＋ Create New Slot";

    renderSlots();
}

/* ---------------- DELETE ---------------- */

async function deleteSlot(id) {
    if (!confirm("Delete this slot?")) return;

    const res = await fetch(`${API}/slots/${id}`, {
        method: "DELETE"
    });

    const data = await res.json();

    if (!res.ok) {
        showMessage(
            data.error || "Delete failed",
            "error"
        );
        return;
    }

    showMessage(
        "Slot deleted successfully",
        "success"
    );

    renderSlots();
}

/* ---------------- START ---------------- */

document.addEventListener("DOMContentLoaded", () => {
    populateTimes();
    renderSlots();

    form.addEventListener("submit", createSlot);

    statusFilter.addEventListener(
        "change",
        renderSlots
    );
});