const transactionsContainer = document.getElementById("transactions-container");
const feedbackMessage = document.getElementById("feedback-message");
const searchInput = document.getElementById("search-input");
const typeFilter = document.getElementById("type-filter");
const tabButtons = document.querySelectorAll(".tab-btn");

let activeStatusFilter = "all";

let mockTransactions = [
    {
        id: "TXN-2026-001",
        type: "sale",
        status: "waiting_dropoff",
        listingTitle: "iPhone 13 Pro - 128GB",
        category: "Electronics",
        buyer: "Michael Smith",
        seller: "Lisa Brown",
        slotDate: "23 Apr 2026",
        slotTime: "09:00 - 11:00",
        dropoffConfirmed: false,
        collectionConfirmed: false
    },
    {
        id: "TXN-2026-002",
        type: "sale",
        status: "waiting_pickup",
        listingTitle: "Engineering Mathematics Textbook",
        category: "Books",
        buyer: "Khumo Dube",
        seller: "Anele Moyo",
        slotDate: "23 Apr 2026",
        slotTime: "11:00 - 13:00",
        dropoffConfirmed: true,
        collectionConfirmed: false
    },
    {
        id: "TXN-2026-003",
        type: "trade",
        status: "in_progress",
        listingTitle: "Wits Hoodie for Calculator Trade",
        category: "Fashion",
        buyer: "Naledi Molefe",
        seller: "Sizwe Nkosi",
        slotDate: "24 Apr 2026",
        slotTime: "13:00 - 15:00",
        dropoffConfirmed: false,
        collectionConfirmed: false
    },
    {
        id: "TXN-2026-004",
        type: "sale",
        status: "completed",
        listingTitle: "Scientific Calculator",
        category: "Study Tools",
        buyer: "Lerato Maseko",
        seller: "Kamo Mthembu",
        slotDate: "22 Apr 2026",
        slotTime: "14:00 - 16:00",
        dropoffConfirmed: true,
        collectionConfirmed: true
    }
];

function showMessage(message, type) {
    feedbackMessage.textContent = message;
    feedbackMessage.className = `feedback-message ${type}`;
}

function clearMessage() {
    feedbackMessage.textContent = "";
    feedbackMessage.className = "feedback-message";
}

function getStatusLabel(status) {
    switch (status) {
        case "pending":
            return "Pending";
        case "in_progress":
            return "In Progress";
        case "waiting_dropoff":
            return "Waiting Drop-Off";
        case "waiting_pickup":
            return "Waiting Pick-Up";
        case "completed":
            return "Completed";
        case "cancelled":
            return "Cancelled";
        default:
            return status;
    }
}

function getStatusClass(status) {
    switch (status) {
        case "waiting_dropoff":
            return "badge badge-dropoff";
        case "waiting_pickup":
            return "badge badge-pickup";
        case "in_progress":
            return "badge badge-progress";
        case "completed":
            return "badge badge-completed";
        case "cancelled":
            return "badge badge-cancelled";
        default:
            return "badge badge-pending";
    }
}

function getTypeClass(type) {
    return type === "sale"
        ? "type-badge type-sale"
        : "type-badge type-trade";
}

function updateQuickStats(transactions) {
    document.getElementById("stat-total").textContent =
        transactions.length;

    document.getElementById("stat-progress").textContent =
        transactions.filter(
            t => t.status === "in_progress"
        ).length;

    document.getElementById("stat-dropoff").textContent =
        transactions.filter(
            t => t.status === "waiting_dropoff"
        ).length;

    document.getElementById("stat-pickup").textContent =
        transactions.filter(
            t => t.status === "waiting_pickup"
        ).length;

    document.getElementById("stat-completed").textContent =
        transactions.filter(
            t => t.status === "completed"
        ).length;
}

function getFilteredTransactions() {
    const searchValue =
        searchInput.value.trim().toLowerCase();

    const selectedType = typeFilter.value;

    return mockTransactions.filter(transaction => {

        const matchesStatus =
            activeStatusFilter === "all" ||
            transaction.status === activeStatusFilter;

        const matchesType =
            selectedType === "all" ||
            transaction.type === selectedType;

        const searchText = [
            transaction.id,
            transaction.listingTitle,
            transaction.category,
            transaction.buyer,
            transaction.seller
        ].join(" ").toLowerCase();

        const matchesSearch =
            searchText.includes(searchValue);

        return (
            matchesStatus &&
            matchesType &&
            matchesSearch
        );
    });
}

/* ---------- PROGRESS STEPS ---------- */

function renderProgressSteps(transaction) {

    /* TRADE = 3 STEPS */

    if (transaction.type === "trade") {

        const step1 =
            transaction.status !== "pending"
                ? "progress-step active"
                : "progress-step";

        const step2 =
            transaction.status === "in_progress" ||
            transaction.status === "completed"
                ? "progress-step active"
                : "progress-step";

        const step3 =
            transaction.status === "completed"
                ? "progress-step active"
                : "progress-step";

        return `
        <section class="progress-row">

            <section class="${step1}">
                <span class="step-circle">1</span>
                <span class="step-label">Pending</span>
            </section>

            <section class="progress-line"></section>

            <section class="${step2}">
                <span class="step-circle">2</span>
                <span class="step-label">
                    Drop-Off / Pick-Up
                </span>
            </section>

            <section class="progress-line"></section>

            <section class="${step3}">
                <span class="step-circle">3</span>
                <span class="step-label">Completed</span>
            </section>

        </section>
        `;
    }

    /* SALE = 4 STEPS */

    const step1 =
        transaction.status !== "pending"
            ? "progress-step active"
            : "progress-step";

    const step2 =
        transaction.dropoffConfirmed ||
        transaction.status === "completed"
            ? "progress-step active"
            : "progress-step";

    const step3 =
        transaction.collectionConfirmed ||
        transaction.status === "completed"
            ? "progress-step active"
            : "progress-step";

    const step4 =
        transaction.status === "completed"
            ? "progress-step active"
            : "progress-step";

    return `
    <section class="progress-row">

        <section class="${step1}">
            <span class="step-circle">1</span>
            <span class="step-label">Pending</span>
        </section>

        <section class="progress-line"></section>

        <section class="${step2}">
            <span class="step-circle">2</span>
            <span class="step-label">Drop-Off</span>
        </section>

        <section class="progress-line"></section>

        <section class="${step3}">
            <span class="step-circle">3</span>
            <span class="step-label">Pick-Up</span>
        </section>

        <section class="progress-line"></section>

        <section class="${step4}">
            <span class="step-circle">4</span>
            <span class="step-label">Completed</span>
        </section>

    </section>
    `;
}

/* ---------- ACTION BUTTONS ---------- */

function renderSaleActions(transaction) {

    const dropoffDisabled =
        transaction.dropoffConfirmed ||
        transaction.status === "completed";

    const collectionDisabled =
        !transaction.dropoffConfirmed ||
        transaction.collectionConfirmed ||
        transaction.status === "completed";

    return `
    <section class="actions-row">

        <button
            class="action-btn primary-btn"
            type="button"
            data-action="dropoff"
            data-id="${transaction.id}"
            ${dropoffDisabled ? "disabled" : ""}
        >
            Confirm Drop-Off
        </button>

        <button
            class="action-btn secondary-btn"
            type="button"
            data-action="collection"
            data-id="${transaction.id}"
            ${collectionDisabled ? "disabled" : ""}
        >
            Confirm Collection
        </button>

    </section>
    `;
}

function renderTradeActions(transaction) {

    const disabled =
        transaction.status === "completed";

    return `
    <section class="actions-row">

        <button
            class="action-btn primary-btn"
            type="button"
            data-action="trade-complete"
            data-id="${transaction.id}"
            ${disabled ? "disabled" : ""}
        >
            Complete Trade Exchange
        </button>

    </section>
    `;
}

/* ---------- MAIN RENDER ---------- */

function renderTransactions() {

    clearMessage();

    const filteredTransactions =
        getFilteredTransactions();

    updateQuickStats(mockTransactions);

    if (!filteredTransactions.length) {
        transactionsContainer.innerHTML = `
        <article class="transaction-card">
            <p>No transactions found.</p>
        </article>
        `;
        return;
    }

    transactionsContainer.innerHTML =
        filteredTransactions.map(transaction => {

            return `
            <article class="transaction-card">

                <header class="transaction-card-header">

                    <section class="transaction-title-group">

                        <h3>${transaction.id}</h3>

                        <span class="${getStatusClass(transaction.status)}">
                            ${getStatusLabel(transaction.status)}
                        </span>

                    </section>

                    <span class="${getTypeClass(transaction.type)}">
                        ${transaction.type === "sale"
                            ? "Sale"
                            : "Trade"}
                    </span>

                </header>

                <section class="transaction-details-grid">

                    <section class="detail-block">
                        <span class="detail-label">Listing</span>
                        <strong>${transaction.listingTitle}</strong>
                        <span class="detail-subtext">
                            ${transaction.category}
                        </span>
                    </section>

                    <section class="detail-block">
                        <span class="detail-label">Trade Slot</span>
                        <strong>${transaction.slotDate}</strong>
                        <span class="detail-subtext">
                            ${transaction.slotTime}
                        </span>
                    </section>

                    <section class="detail-block">
                        <span class="detail-label">Buyer</span>
                        <strong>${transaction.buyer}</strong>
                    </section>

                    <section class="detail-block">
                        <span class="detail-label">Seller</span>
                        <strong>${transaction.seller}</strong>
                    </section>

                </section>

                ${renderProgressSteps(transaction)}

                ${
                    transaction.type === "sale"
                        ? renderSaleActions(transaction)
                        : renderTradeActions(transaction)
                }

            </article>
            `;

        }).join("");

    attachActionHandlers();
}

/* ---------- BUTTON EVENTS ---------- */

function attachActionHandlers() {

    document
        .querySelectorAll('[data-action="dropoff"]')
        .forEach(button => {
            button.onclick = () =>
                confirmDropoff(button.dataset.id);
        });

    document
        .querySelectorAll('[data-action="collection"]')
        .forEach(button => {
            button.onclick = () =>
                confirmCollection(button.dataset.id);
        });

    document
        .querySelectorAll('[data-action="trade-complete"]')
        .forEach(button => {
            button.onclick = () =>
                completeTrade(button.dataset.id);
        });
}

/* ---------- LOGIC ---------- */

function confirmDropoff(id) {

    const transaction =
        mockTransactions.find(t => t.id === id);

    if (!transaction) return;

    if (transaction.dropoffConfirmed) {
        showMessage(
            "Drop-off already confirmed.",
            "error"
        );
        return;
    }

    transaction.dropoffConfirmed = true;
    transaction.status = "waiting_pickup";

    showMessage(
        `${id} drop-off confirmed.`,
        "success"
    );

    renderTransactions();
}

function confirmCollection(id) {

    const transaction =
        mockTransactions.find(t => t.id === id);

    if (!transaction) return;

    if (!transaction.dropoffConfirmed) {
        showMessage(
            "Cannot confirm collection before drop-off.",
            "error"
        );
        return;
    }

    transaction.collectionConfirmed = true;
    transaction.status = "completed";

    showMessage(
        `${id} collection confirmed.`,
        "success"
    );

    renderTransactions();
}

function completeTrade(id) {

    const transaction =
        mockTransactions.find(t => t.id === id);

    if (!transaction) return;

    transaction.dropoffConfirmed = true;
    transaction.collectionConfirmed = true;
    transaction.status = "completed";

    showMessage(
        `${id} trade completed.`,
        "success"
    );

    renderTransactions();
}

/* ---------- FILTER EVENTS ---------- */

tabButtons.forEach(button => {

    button.addEventListener("click", () => {

        tabButtons.forEach(tab =>
            tab.classList.remove("active")
        );

        button.classList.add("active");

        activeStatusFilter =
            button.dataset.filter;

        renderTransactions();
    });
});

searchInput.addEventListener(
    "input",
    renderTransactions
);

typeFilter.addEventListener(
    "change",
    renderTransactions
);

/* ---------- START ---------- */

document.addEventListener(
    "DOMContentLoaded",
    renderTransactions
);