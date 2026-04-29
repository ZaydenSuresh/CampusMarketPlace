/**
 * Creates a listing card component
 * @param {Object} listing - listing data from database
 * @returns {HTMLElement} card element
 */
export function createListingCard(listing) {
    const currentUserId = localStorage.getItem("user_id");

    const card = document.createElement("div");
    card.className = "item-card";

    const imageUrl =
        listing.image_url && listing.image_url.trim() !== ""
            ? listing.image_url
            : "https://via.placeholder.com/150";

    card.innerHTML = `
        <div class="item-img">
            <img src="${imageUrl}" 
                 alt="listing image" 
                 style="width:100%; height:180px; object-fit:contain; background:white;" />
        </div>

        <div class="item-details">
            <span style="
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 0.7rem;
                font-weight: bold;
                background: rgba(0, 200, 0, 0.1);
                color: green;
            ">
                ${listing.category || "UNCATEGORIZED"}
            </span>

            <h3 style="margin-top: 10px;">
                ${escapeHtml(listing.title)}
            </h3>

            <p class="item-price">
                R ${Number(listing.price || 0).toFixed(2)}
            </p>

            <p class="text-small text-muted">
                ${escapeHtml(listing.description || "")}
            </p>

            <p class="text-small">
                Condition: ${listing.condition || "N/A"}
            </p>

            <p class="text-small">
                Status: ${listing.status || "available"}
            </p>

            <div class="card-actions"></div>
        </div>
    `;

    const actions = card.querySelector(".card-actions");

    const isOwner =
        currentUserId &&
        listing.user_id &&
        String(currentUserId) === String(listing.user_id);

    // EDIT BUTTON ONLY FOR OWNER
    if (isOwner) {
        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.className = "edit-btn";

        editBtn.addEventListener("click", () => {
            window.location.href = `/create-listing.html?mode=edit&id=${listing.id}`;
        });

        actions.appendChild(editBtn);
    }

    // BUY / RESERVE BUTTONS ONLY FOR NON-OWNERS AND AVAILABLE LISTINGS
    if (!isOwner && (listing.status === "available" || !listing.status)) {

        if (listing.sale_type === "Sale" || listing.sale_type === "Either") {
            const buyBtn = document.createElement("button");
            buyBtn.textContent = "Buy Now";
            buyBtn.className = "edit-btn";

            buyBtn.addEventListener("click", () => {
                reserveListing(listing, "sale", actions);
            });

            actions.appendChild(buyBtn);
        }

        if (listing.sale_type === "Trade" || listing.sale_type === "Either") {
            const reserveBtn = document.createElement("button");
            reserveBtn.textContent = "Reserve";
            reserveBtn.className = "edit-btn";

            reserveBtn.addEventListener("click", () => {
                reserveListing(listing, "trade", actions);
            });

            actions.appendChild(reserveBtn);
        }
    }

    return card;
}

/**
 * Calls backend reserve endpoint.
 * Replaces buttons with status message
 */
async function reserveListing(listing, transactionType, actionsContainer) {
    try {
        // loading state
        actionsContainer.innerHTML = `<span style="color: gray;">Processing...</span>`;

        const response = await fetch(`/listings/${listing.id}/reserve`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transaction_type: transactionType,
            }),
        });

        const data = await response.json();

        // ❌ error (already reserved etc)
        if (!response.ok || !data.ok) {
            actionsContainer.innerHTML = `
                <span style="color: red; font-weight: bold;">
                    Already selected
                </span>
            `;
            alert(data.error || data.message || "You already selected this listing");
            return;
        }

        // ✅ success → replace buttons
        actionsContainer.innerHTML = `
            <span style="color: green; font-weight: bold;">
                ${transactionType === "sale" ? "Purchase Pending" : "Reserved"}
            </span>
        `;

    } catch (err) {
        console.error("Reserve listing error:", err);

        actionsContainer.innerHTML = `
            <span style="color: red;">
                Something went wrong
            </span>
        `;

        alert("Something went wrong while reserving this listing");
    }
}

/**
 * Escape HTML to prevent UI breaking
 */
function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}