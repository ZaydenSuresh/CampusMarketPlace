/* get HTML containers/elements from transactions page. */

const transactionsContainer =
document.getElementById("transactions-container");

const feedbackMessage =
document.getElementById("feedback-message");

const searchInput =
document.getElementById("search-input");

const typeFilter =
document.getElementById("type-filter");

/* gets all status filter buttons */
const tabButtons =
document.querySelectorAll(".tab-btn");


/* current active filter */
let activeStatusFilter = "all";

/* stores transactions fetched from database */
let transactions = [];


/* FETCH TRANSACTIONS */

async function fetchTransactions() {

    try {

        const res = await fetch("/transactions");
        const data = await res.json();
        /*The two lines above sends GET request to routes, then convert response to Javascript usable format */

        /* reshape database data into cleaner frontend objects */
        transactions = data.map(t => ({
            id: t.id,
            type: t.type === "either"
                ? "trade"
                : t.type,
            status: mapStatus(t),
            listingTitle:
                t.listings?.title ||
                "Unknown Listing",
            buyer:
                t.buyer?.name ||
                "Unknown Buyer",

            seller:
                t.seller?.name ||
                "Unknown Seller",

            slotDate:
                formatDate(t.created_at),

            /* database booleans */
            dropoffConfirmed:
                t.dropoff_confirmed,

            collectionConfirmed:
                t.collection_confirmed
        }));

        /* render cards after fetch */
        renderTransactions();

    } catch (err) {

        /* prevent app crash if fetch fails */
        console.error(err);
    }
}


/*  STATUS LOGIC  */

function mapStatus(t) {

    /* cancelled transactions */
    if (t.status === "cancelled")
        return "cancelled";

    /* completed transaction */
    if (t.status === "completed")
        return "completed";

    /* waiting for dropoff */
    if (
        t.status === "in_progress" &&
        !t.dropoff_confirmed
    )
        return "waiting_dropoff";

    /* waiting for pickup */
    if (
        t.dropoff_confirmed &&
        !t.collection_confirmed
    )
        return "waiting_pickup";

    /* default */
    return "pending";
}

function formatDate(date) {

    return new Date(date)
        .toLocaleDateString();
}


/*  PROGRESS TRACKER (convert status to step numberS) */

function getStepIndex(status) {

    /* converts status into progress step number */

    switch (status) {

        case "pending":
            return 1;

        case "waiting_dropoff":
            return 2;

        case "waiting_pickup":
            return 3;

        case "completed":
            return 4;

        default:
            return 1;
    }
}


/* builds visual progress circles(takes the step number generated above and the type of transaction) */

function renderProgress(step, type) {

    /* trade has different flow from sale */
    const labels =

        type === "trade"

            ? [
                "Pending",
                "Exchange",
                "Completed"
            ]

            : [
                "Pending",
                "Drop-Off",
                "Pick-Up",
                "Completed"
            ];

    /* generate progress HTML dynamically */

    return `

        <div class="progress-row">

            ${labels.map((label, i) => {

                /* current step number */
                const s = i + 1;

                return `

                    <div class="progress-step ${s <= step ? "active" : ""}">

                        <!-- filled dark if completed -->
                        <div class="step-circle">
                            ${s}
                        </div>

                        <!-- step name -->
                        <span class="step-label">
                            ${label}
                        </span>

                    </div>

                    <!-- line between circles -->
                    ${s < labels.length
                        ? `<div class="progress-line"></div>`
                        : ""
                    }

                `;
            }).join("")}

        </div>

    `;
}


/*  ACTION BUTTONS  */

function renderActionButton(t) {

    /* trade transaction logic */

    if (t.type === "trade") {

        /* exchange confirmation */
        if (t.status === "waiting_dropoff") {

            return `

                <button
                    onclick="updateTransaction('${t.id}','complete')"
                    class="action-btn primary-btn"
                >

                    Confirm Exchange

                </button>

            `;
        }

        return "";
    }


    /* sale transaction dropoff stage */

    if (t.status === "waiting_dropoff") {

        return `

            <button
                onclick="updateTransaction('${t.id}','dropoff')"
                class="action-btn primary-btn"
            >

                Confirm Drop-Off

            </button>

        `;
    }


    /* sale transaction completion stage */

    if (t.status === "waiting_pickup") {

        return `

            <button
                onclick="updateTransaction('${t.id}','complete')"
                class="action-btn secondary-btn"
            >

                Mark Completed

            </button>

        `;
    }

    return "";
}


/*  UPDATE TRANSACTION  */

async function updateTransaction(id, action) {

    try {

        /* send PUT request to backend */

        await fetch(`/transactions/${id}`, {

            /* PUT updates existing data */
            method: "PUT",

            headers: {
                "Content-Type": "application/json"
            },

            /* send action to backend */
            body: JSON.stringify({
                action
            })
        });

        /* reload updated transactions */
        fetchTransactions();

    } catch (err) {

        console.error(err);
    }
}


/* ================= FILTERING ================= */

function getFilteredTransactions() {

    /* live search text */
    const searchValue =
        searchInput.value.toLowerCase();

    /* sale/trade filter */
    const selectedType =
        typeFilter.value;

    /* return only matching transactions */

    return transactions.filter(t => {

        /* status filter check */
        const matchesStatus =

            activeStatusFilter === "all" ||

            t.status === activeStatusFilter;


        /* type filter check */
        const matchesType =

            selectedType === "all" ||

            t.type === selectedType;


        /* combine searchable text */
        const searchText = [

            t.id,
            t.listingTitle,
            t.buyer,
            t.seller

        ].join(" ").toLowerCase();


        /* final filter condition */
        return (

            matchesStatus &&
            matchesType &&
            searchText.includes(searchValue)

        );
    });
}


/* ================= RENDER TRANSACTION CARDS ================= */

function renderTransactions() {

    /* get filtered results */
    const filtered =
        getFilteredTransactions();


    /* empty state */
    if (!filtered.length) {

        transactionsContainer.innerHTML = `
            <p>No transactions found.</p>
        `;

        return;
    }


    /* build transaction cards dynamically */

    transactionsContainer.innerHTML =

        filtered.map(t => {

            /* determine progress step */
            const step =
                getStepIndex(t.status);

            return `

            <article class="transaction-card">

                <!-- top section -->
                <div class="transaction-card-header">

                    <div class="transaction-title-group">

                        <!-- shortened id -->
                        <h3>
                            ${t.id.slice(0, 10)}
                        </h3>

                        <!-- sale/trade badge -->
                        <span class="type-badge">
                            ${t.type}
                        </span>

                    </div>

                    <!-- status badge -->
                    <span class="badge badge-${t.status.replace("_", "")}">

                        ${t.status.replace("_", " ")}

                    </span>

                </div>


                <!-- details section -->
                <div class="transaction-details-grid">

                    <div class="detail-block">

                        <span class="detail-label">
                            Listing
                        </span>

                        <strong>
                            ${t.listingTitle}
                        </strong>

                    </div>

                    <div class="detail-block">

                        <span class="detail-label">
                            Date
                        </span>

                        <strong>
                            ${t.slotDate}
                        </strong>

                    </div>

                    <div class="detail-block">

                        <span class="detail-label">
                            Buyer
                        </span>

                        <strong>
                            ${t.buyer}
                        </strong>

                    </div>

                    <div class="detail-block">

                        <span class="detail-label">
                            Seller
                        </span>

                        <strong>
                            ${t.seller}
                        </strong>

                    </div>

                </div>


                <!-- progress tracker -->
                ${renderProgress(step, t.type)}

                <!-- action buttons -->
                <div class="actions-row">

                    ${renderActionButton(t)}

                </div>

            </article>

            `;

        }).join("");
}


/* ================= EVENT LISTENERS ================= */


/* status filter buttons */

tabButtons.forEach(btn => {

    btn.addEventListener("click", () => {

        /* remove active styling */
        tabButtons.forEach(b =>
            b.classList.remove("active")
        );

        /* highlight selected button */
        btn.classList.add("active");

        /* update active filter */
        activeStatusFilter =
            btn.dataset.filter;

        /* re-render transactions */
        renderTransactions();
    });
});


/* live search while typing */
searchInput.addEventListener(
    "input",
    renderTransactions
);


/* sale/trade dropdown change */
typeFilter.addEventListener(
    "change",
    renderTransactions
);


/* fetch data once HTML fully loads */
document.addEventListener(
    "DOMContentLoaded",
    fetchTransactions
);


/* expose function globally for onclick */
window.updateTransaction =
    updateTransaction;