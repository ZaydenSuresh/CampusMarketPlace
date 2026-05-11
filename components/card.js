/**
 * Creates a listing card component
 * @param {Object} listing - listing data from database
 * @returns {HTMLElement} card element
 */
export function createListingCard(listing) {
    const currentUserId = localStorage.getItem("user_id");

    // CHANGED: article instead of div because each listing is its own item/card
    const card = document.createElement("article");
    card.className = "item-card";

    const imageUrl =
        listing.image_url && listing.image_url.trim() !== ""
            ? listing.image_url
            : "https://via.placeholder.com/150";

    // CHANGED: updated card UI, added condition tag, seller name, and better semantic HTML
    card.innerHTML = `
        <figure class="item-img">
            <img src="${imageUrl}" 
                 alt="${escapeHtml(listing.title || "listing image")}" />
        </figure>

        <section class="item-details">
            <p class="listing-tags">
                <strong class="listing-tag category-tag">
                    ${listing.category || "UNCATEGORIZED"}
                </strong>

                <strong class="listing-tag condition-tag">
                    ${listing.condition || "N/A"}
                </strong>
            </p>

            <h3>
                ${escapeHtml(listing.title)}
            </h3>

            <p class="item-price">
                R ${Number(listing.price || 0).toFixed(2)}
            </p>

            <p class="text-small">
                ${escapeHtml(listing.description || "")}
            </p>

            <p class="seller-line">
                Seller: ${escapeHtml(listing.profiles?.name || listing.seller_name || "Unknown seller")}
            </p>

            <p class="seller-rating">
                ★ ${listing.seller_average_rating || "No ratings yet"}
                ${listing.seller_review_count ? `(${listing.seller_review_count} reviews)` : ""}
            </p>

            <p class="status-line">
                Status: ${listing.status || "available"}
            </p>

            <section class="card-actions"></section>
        </section>
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
        actionsContainer.innerHTML = `<p style="color: gray;">Processing...</p>`;

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

        // error
        if (!response.ok || !data.ok) {
            actionsContainer.innerHTML = `
                <p style="color: red; font-weight: bold;">
                    Already selected
                </p>
            `;

            alert(data.error || data.message || "You already selected this listing");
            return;
        }

        // success
        actionsContainer.innerHTML = `
            <p style="color: green; font-weight: bold;">
                ${transactionType === "sale" ? "Purchase Pending" : "Reserved"}
            </p>
        `;

    } catch (err) {
        console.error("Reserve listing error:", err);

        actionsContainer.innerHTML = `
            <p style="color: red;">
                Something went wrong
            </p>
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