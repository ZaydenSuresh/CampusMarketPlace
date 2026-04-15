/**
 * Creates a listing card component
 * @param {Object} listing - listing data from database
 * @returns {HTMLElement} card element
 */
export function createListingCard(listing) {

    console.log("IMAGE:", listing.image_url);

    const currentUserId = localStorage.getItem("user_id");

    const card = document.createElement("div");
    card.className = "item-card";

    // Ensures a valid image is always shown (fallback if missing or empty)
    const imageUrl =
        listing.image_url && listing.image_url.trim() !== ""
            ? listing.image_url
            : "https://via.placeholder.com/150";

    card.innerHTML = `
        <div class="item-img">
            <img src="${imageUrl}" 
                 alt="listing image" 
                 style="width:100%; height:150px; object-fit:cover;" />
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

        </div>
    `;

    // EDIT BUTTON ONLY FOR OWNER
    if (
        currentUserId &&
        listing.user_id &&
        String(currentUserId) === String(listing.user_id)
    ) {
        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.className = "edit-btn";

        editBtn.addEventListener("click", () => {
            if (typeof window.editListing === "function") {
                window.editListing(listing.id);
            }
        });

        card.appendChild(editBtn);
    }

    return card;
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