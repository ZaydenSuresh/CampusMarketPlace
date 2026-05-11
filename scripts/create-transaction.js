import { requireRole, getCurrentUser } from "/scripts/auth.js";

let pendingTransactions = [];
let selectedTransactionId = null;
let allSlots = [];
let selectedSlotId = null;
let selectedItemTitle = "";

const itemSelect = document.getElementById("itemSelect");
const dateInput = document.getElementById("dateInput");
const timeGrid = document.getElementById("timeGrid");
const itemPreview = document.getElementById("selected-item-preview");
const previewImg = document.getElementById("previewImg");
const previewTitle = document.getElementById("previewTitle");
const previewDetail = document.getElementById("previewDetail");
const summaryLine = document.getElementById("summaryLine");
const form = document.getElementById("transactionForm");
const submitBtn = document.getElementById("submitBtn");
const message = document.getElementById("formMessage");
const itemField = document.getElementById("item-field");

const params = new URLSearchParams(window.location.search);
const preselectedId = params.get("transactionId");

async function initPage() {
  const user = await requireRole(["Student"]);
  if (!user) return;

  if (preselectedId) {
    document.getElementById("pageTitle").textContent = "Book a Trade Slot";
    document.getElementById("pageDescription").textContent =
      "Confirm your item and select a trade slot to finalise.";
  }

  // Set date min to today
  dateInput.min = new Date().toISOString().split("T")[0];

  await Promise.all([fetchPendingTransactions(user.id), fetchSlots()]);
}

// Fetch pending transactions
async function fetchPendingTransactions(userId) {
  try {
    const res = await fetch(`/transactions?user_id=${userId}&status=pending`);
    if (!res.ok) throw new Error("Failed to load items");
    pendingTransactions = await res.json();
    populateItems();
  } catch (err) {
    console.error(err);
    showMessage("Could not load your reserved items.", "error");
  }
}

// Populate item dropdown or show preselected preview
function populateItems() {
  if (preselectedId) {
    const tx = pendingTransactions.find((t) => t.id === preselectedId);
    if (tx) {
      selectedTransactionId = tx.id;
      selectedItemTitle = getListing(tx)?.title || "Unknown Item";
      showItemPreview(tx);
      itemField.style.display = "none";
    } else {
      showMessage(
        "Selected item not found. It may have been booked already.",
        "error",
      );
    }
    return;
  }

  itemSelect.innerHTML =
    '<option value="">Select a reserved item</option>' +
    pendingTransactions
      .map((t) => {
        const listing = getListing(t);
        return `<option value="${t.id}">${escapeHtml(listing?.title || "Unknown")}</option>`;
      })
      .join("");

  if (!pendingTransactions.length) {
    itemSelect.innerHTML = '<option value="">No pending transactions</option>';
  }
}

// Show preselected item preview
function showItemPreview(tx) {
  const listing = getListing(tx);
  const imgUrl = listing?.image_url || "/images/placeholder.png";
  previewImg.src = imgUrl;
  previewImg.alt = listing?.title || "Item";
  previewTitle.textContent = listing?.title || "Unknown Item";
  previewDetail.textContent = `Type: ${tx.type}  |  Buyer: ${tx.buyer?.name || "Unknown"}  |  Seller: ${tx.seller?.name || "Unknown"}`;
  itemPreview.style.display = "flex";
}

// Fetch all slots
async function fetchSlots() {
  try {
    const res = await fetch("/slots");
    if (!res.ok) throw new Error("Failed to load slots");
    allSlots = await res.json();
    dateInput.addEventListener("change", onDateChange);
  } catch (err) {
    console.error(err);
    timeGrid.innerHTML = '<span class="empty-text">Error loading slots.</span>';
  }
}

// Date changed — filter and render time cards
function onDateChange() {
  selectedSlotId = null;
  summaryLine.style.display = "none";

  const selectedDate = dateInput.value;
  if (!selectedDate) {
    timeGrid.innerHTML =
      '<span class="empty-text">Pick a date to see available times.</span>';
    return;
  }

  // Filter slots matching this date with capacity
  const available = allSlots.filter(
    (s) => s.date === selectedDate && s.bookedCount < s.capacity,
  );

  if (!available.length) {
    timeGrid.innerHTML =
      '<span class="empty-text">No slots available on this date.</span>';
    return;
  }

  timeGrid.innerHTML = available
    .map(
      (s) => `
        <div class="time-card" data-id="${s.id}" data-date="${s.date}" data-time="${s.time}">
          <div class="time">${s.time}</div>
          <div class="remaining">${s.capacity - s.bookedCount} remaining</div>
        </div>
      `,
    )
    .join("");
}

// Time card click — select/deselect via delegation
timeGrid.addEventListener("click", (e) => {
  const card = e.target.closest(".time-card");
  if (!card) return;

  document
    .querySelectorAll(".time-card.selected")
    .forEach((c) => c.classList.remove("selected"));

  card.classList.add("selected");
  selectedSlotId = card.dataset.id;

  updateSummary();
});

// Update summary line based on selected item + time card
function updateSummary() {
  const selectedCard = document.querySelector(".time-card.selected");
  if (!selectedCard) {
    summaryLine.style.display = "none";
    return;
  }

  const itemName = preselectedId
    ? selectedItemTitle
    : itemSelect.options[itemSelect.selectedIndex]?.text || "your item";

  const date = selectedCard.dataset.date;
  const time = selectedCard.dataset.time;

  summaryLine.innerHTML = `You are booking a slot for <strong>${escapeHtml(itemName)}</strong> on <strong>${date}</strong> at <strong>${time}</strong>.`;
  summaryLine.style.display = "block";
}

// Item dropdown changed — show preview card with item details
itemSelect.addEventListener("change", () => {
  const id = itemSelect.value;
  selectedTransactionId = id || null;

  const tx = pendingTransactions.find((t) => t.id === id);
  if (tx) {
    selectedItemTitle = getListing(tx)?.title || "Unknown Item";
    showItemPreview(tx);
  } else {
    selectedItemTitle = "";
    itemPreview.style.display = "none";
  }

  updateSummary();
});

// Form submit
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.className = "message";

  const tx = preselectedId
    ? pendingTransactions.find((t) => t.id === preselectedId)
    : pendingTransactions.find((t) => t.id === selectedTransactionId);

  if (!tx) {
    showMessage("Please select a reserved item.", "error");
    return;
  }

  const listingId = tx.listing_id;

  if (!selectedSlotId) {
    showMessage("Please select a trade slot.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Booking...";

  try {
    const res = await fetch("/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: listingId, slot_id: selectedSlotId }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create transaction");
    }

    showMessage("Transaction created! Redirecting...", "success");
    setTimeout(() => {
      window.location.href = "/student-transactions.html";
    }, 1000);
  } catch (err) {
    showMessage(err.message, "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Book Slot & Create Transaction";
  }
});

function showMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type}`;
}

function getListing(t) {
  if (!t.listings) return null;
  return Array.isArray(t.listings) ? t.listings[0] : t.listings;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

initPage();
