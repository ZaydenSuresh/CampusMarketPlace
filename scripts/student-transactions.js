import { requireRole, logoutUser, getCurrentUser } from "/scripts/auth.js";

let currentUserId = null;
let transactions = [];
let activeStatus = "all";
let activeType = "all";
let ratedTransactionIds = new Set();

const container = document.getElementById("transactions-container");

async function initPage() {
  const user = await requireRole(["Student"]);
  if (!user) return;
  currentUserId = user.id;

  await fetchTransactions();

  // Status tab clicks
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeStatus = btn.dataset.status;
      renderTransactions();
    });
  });

  // Type filter clicks
  document.querySelectorAll(".filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeType = btn.dataset.type;
      renderTransactions();
    });
  });

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);
}

async function fetchTransactions() {
  try {
    const res = await fetch(`/transactions?user_id=${currentUserId}`);
    if (!res.ok) throw new Error("Failed to fetch");
    transactions = await res.json();
    await fetchUserRatings();
  } catch (err) {
    console.error(err);
    transactions = [];
  }
  renderTransactions();
}

// Fetch all ratings the current user has submitted, then build a Set
// of transaction IDs they've already rated. Used to disable the Rate
// button on already-reviewed transactions.
async function fetchUserRatings() {
  try {
    const res = await fetch(`/ratings?rater_id=${currentUserId}`);
    if (!res.ok) return;
    const data = await res.json();
    ratedTransactionIds = new Set(data.ratings.map(r => r.transaction_id));
  } catch (err) {
    console.error(err);
  }
}

function getListing(t) {
  if (!t.listings) return null;
  return Array.isArray(t.listings) ? t.listings[0] : t.listings;
}

// Matches type: "either" counts for both Sale and Trade
function matchesType(t, typeFilter) {
  if (typeFilter === "all") return true;
  if (t.type === "either") return true;
  return t.type === typeFilter;
}

// Converts "2026-03-15" to "15 Mar"
function formatDate(dateStr) {
  if (!dateStr) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

function renderTransactions() {
  if (!container) return;

  const filtered = transactions.filter((t) => {
    const statusMatch = activeStatus === "all" || t.status === activeStatus;
    const typeMatch = matchesType(t, activeType);
    return statusMatch && typeMatch;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No transactions found</h3>
        <p>There are no ${activeStatus !== "all" ? activeStatus.replace("_", " ") + " " : ""}transactions to show.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map((t) => buildCard(t)).join("");
}

// Safely encode a string for use in a URL query parameter
function encodeUrl(str) {
  return encodeURIComponent(str || "");
}

function buildCard(t) {
  const listing = getListing(t);
  const imgUrl = listing?.image_url || "/images/placeholder.png";
  const title = listing?.title || "Unknown Item";

  const isPending = t.status === "pending";
  const canCancel = t.status !== "completed" && t.status !== "cancelled";
  const isCompleted = t.status === "completed";
  // Check if this user has already submitted a rating for this transaction
  const alreadyRated = isCompleted && ratedTransactionIds.has(t.id);

  // Determine the other person in this transaction (the one to rate).
  // If current user is buyer → counterparty is seller; if seller → counterparty is buyer.
  const counterpartyId = t.buyer_id === currentUserId ? t.seller_id : t.buyer_id;
  const counterpartyName = t.buyer_id === currentUserId ? (t.seller?.name || "Unknown") : (t.buyer?.name || "Unknown");
  const ratedRole = t.buyer_id === currentUserId ? "seller" : "buyer";

  // Slot info row — styled like buyer/seller meta
  const slot = t.slot_info;
  const slotLine = slot
    ? `<div class="slot-row"><span class="label">Booked:</span> <span class="value">${formatDate(slot.date)} - ${slot.time?.slice(0, 5) || slot.time}</span></div>`
    : `<div class="slot-row"><span class="label">Booked:</span> <span class="value">No slot booked yet</span></div>`;

  return `
    <div class="transaction-card">
      <div class="card-img">
        <img src="${imgUrl}" alt="${escapeHtml(title)}" loading="lazy" />
      </div>
      <div class="card-body">
        <h3>${escapeHtml(title)}</h3>
        <div class="card-meta">
          <span><span class="label">Buyer:</span> <span class="name">${t.buyer?.name || "Unknown"}</span></span>
          <span><span class="label">Seller:</span> <span class="name">${t.seller?.name || "Unknown"}</span></span>
        </div>
        ${slotLine}
        <div class="card-bottom">
          <div>
            <span class="badge badge-${t.status}">${t.status.replace("_", " ")}</span>
            <span class="badge badge-${t.type}">${t.type}</span>
          </div>
          <div class="card-actions">
            ${isPending ? `<button class="btn-sm btn-book" data-book="${t.id}">Book Slot</button>` : ""}
            ${canCancel ? `<button class="btn-sm btn-cancel" data-id="${t.id}">Cancel</button>` : ""}
            ${isCompleted && alreadyRated ? `<button class="btn-sm btn-rate" disabled>Rated</button>` : ""}
            ${isCompleted && !alreadyRated ? `<button class="btn-sm btn-rate" onclick="window.location.href='/rating.html?transactionId=${t.id}&ratedId=${counterpartyId}&ratedName=${encodeUrl(counterpartyName)}&itemTitle=${encodeUrl(title)}&ratedRole=${ratedRole}'">Rate</button>` : ""}
          </div>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Event delegation for Cancel and Book Slot buttons
container.addEventListener("click", async (e) => {
  const cancelBtn = e.target.closest(".btn-cancel");
  if (cancelBtn) {
    const id = cancelBtn.dataset.id;
    if (!confirm("Cancel this transaction? This cannot be undone.")) return;

    try {
      const res = await fetch(`/transactions/${id}/cancel`, { method: "PUT" });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to cancel");
        return;
      }
      await fetchTransactions();
    } catch (err) {
      alert("Something went wrong. Please try again.");
    }
    return;
  }

  const bookBtn = e.target.closest("[data-book]");
  if (bookBtn) {
    const id = bookBtn.dataset.book;
    window.location.href = `/create-transaction.html?transactionId=${id}`;
  }
});

initPage();
