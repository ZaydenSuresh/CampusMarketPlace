const transactionsContainer = document.getElementById("transactions-container");
const feedbackMessage = document.getElementById("feedback-message");
const searchInput = document.getElementById("search-input");
const typeFilter = document.getElementById("type-filter");
const tabButtons = document.querySelectorAll(".tab-btn");

let activeStatusFilter = "all";
let transactions = [];

/* ---------- FETCH ---------- */

async function fetchTransactions() {
    try {
        const res = await fetch("/transactions");
        const data = await res.json();

        transactions = data.map(t => ({
            id: t.id,
            type: t.type === "either" ? "trade" : t.type,
            status: mapStatus(t),

            listingTitle: "Listing #" + t.listing_id.slice(0, 6),
            buyer: t.buyer_id.slice(0, 6),
            seller: t.seller_id.slice(0, 6),

            slotDate: formatDate(t.created_at),

            dropoffConfirmed: t.dropoff_confirmed,
            collectionConfirmed: t.collection_confirmed
        }));

        renderTransactions();
    } catch (err) {
        console.error(err);
    }
}

/* ---------- STATUS ---------- */

function mapStatus(t) {
    if (t.status === "completed") return "completed";

    if (t.status === "in_progress" && !t.dropoff_confirmed)
        return "waiting_dropoff";

    if (t.dropoff_confirmed && !t.collection_confirmed)
        return "waiting_pickup";

    return "pending";
}

function formatDate(date) {
    return new Date(date).toLocaleDateString();
}

/* ---------- PROGRESS (USES YOUR CSS) ---------- */

function getStepIndex(status) {
    switch (status) {
        case "pending": return 1;
        case "waiting_dropoff": return 2;
        case "waiting_pickup": return 3;
        case "completed": return 4;
        default: return 1;
    }
}

function renderProgress(step) {
    const labels = ["Pending", "Drop-Off", "Pick-Up", "Completed"];

    return `
        <div class="progress-row">
            ${labels.map((label, i) => {
                const s = i + 1;

                return `
                    <div class="progress-step ${s <= step ? "active" : ""}">
                        <div class="step-circle">${s}</div>
                        <span class="step-label">${label}</span>
                    </div>
                    ${s < 4 ? `<div class="progress-line"></div>` : ""}
                `;
            }).join("")}
        </div>
    `;
}

/* ---------- ACTION BUTTON ---------- */

function renderActionButton(t) {
    if (t.status === "waiting_dropoff") {
        return `<button onclick="updateTransaction('${t.id}','dropoff')" class="action-btn primary-btn">Confirm Drop-Off</button>`;
    }

    if (t.status === "waiting_pickup") {
        return `<button onclick="updateTransaction('${t.id}','complete')" class="action-btn secondary-btn">Mark Completed</button>`;
    }

    return "";
}

/* ---------- UPDATE ---------- */

async function updateTransaction(id, action) {
    try {
        await fetch(`/transactions/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action })
        });

        fetchTransactions();
    } catch (err) {
        console.error(err);
    }
}

/* ---------- FILTER ---------- */

function getFilteredTransactions() {
    const searchValue = searchInput.value.toLowerCase();
    const selectedType = typeFilter.value;

    return transactions.filter(t => {
        const matchesStatus =
            activeStatusFilter === "all" ||
            t.status === activeStatusFilter;

        const matchesType =
            selectedType === "all" ||
            t.type === selectedType;

        const searchText = [
            t.id,
            t.listingTitle,
            t.buyer,
            t.seller
        ].join(" ").toLowerCase();

        return matchesStatus && matchesType && searchText.includes(searchValue);
    });
}

/* ---------- RENDER ---------- */

function renderTransactions() {
    const filtered = getFilteredTransactions();

    if (!filtered.length) {
        transactionsContainer.innerHTML = `<p>No transactions found.</p>`;
        return;
    }

    transactionsContainer.innerHTML = filtered.map(t => {
        const step = getStepIndex(t.status);

        return `
        <article class="transaction-card">

            <div class="transaction-card-header">
                <div class="transaction-title-group">
                    <h3>${t.id.slice(0, 10)}</h3>
                    <span class="type-badge">${t.type}</span>
                </div>
                <span class="badge badge-${t.status.replace("_", "")}">
                    ${t.status.replace("_", " ")}
                </span>
            </div>

            <div class="transaction-details-grid">
                <div class="detail-block">
                    <span class="detail-label">Listing</span>
                    <strong>${t.listingTitle}</strong>
                </div>

                <div class="detail-block">
                    <span class="detail-label">Date</span>
                    <strong>${t.slotDate}</strong>
                </div>

                <div class="detail-block">
                    <span class="detail-label">Buyer</span>
                    <strong>${t.buyer}</strong>
                </div>

                <div class="detail-block">
                    <span class="detail-label">Seller</span>
                    <strong>${t.seller}</strong>
                </div>
            </div>

            ${renderProgress(step)}

            <div class="actions-row">
                ${renderActionButton(t)}
            </div>

        </article>
        `;
    }).join("");
}

/* ---------- EVENTS ---------- */

tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        tabButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeStatusFilter = btn.dataset.filter;
        renderTransactions();
    });
});

searchInput.addEventListener("input", renderTransactions);
typeFilter.addEventListener("change", renderTransactions);

document.addEventListener("DOMContentLoaded", fetchTransactions);