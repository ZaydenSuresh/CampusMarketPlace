// frontend/scripts/listings.js

import { filterListings } from "../components/search.js";

let allListings = [];

/**
 * Fetch listings from backend API
 */
export async function loadListings() {
    try {
        const res = await fetch("/listings");
        const data = await res.json();

        allListings = data.listings || data;

        displayListings(allListings);

    } catch (err) {
        console.error("Error fetching listings:", err);
    }
}

/**
 * Render listings into dashboard UI
 */
function displayListings(listings) {
    const container = document.getElementById("listings-container");
    if (!container) return;

    container.innerHTML = "";

    if (!listings.length) {
        container.innerHTML = `
            <p class="text-muted">No listings available</p>
        `;
        return;
    }

    listings.forEach(listing => {
        const card = document.createElement("div");
        card.className = "item-card";

        card.innerHTML = `
            <div class="item-img">
                No Image Provided
            </div>

            <div class="item-details">

                <span
                    style="
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-size: 0.7rem;
                        font-weight: bold;
                        background: rgba(0, 200, 0, 0.1);
                        color: green;
                    "
                >
                    ACTIVE
                </span>

                <h3 style="margin-top: 10px;">
                    ${escapeHtml(listing.title)}
                </h3>

                <p class="item-price">
                    R ${Number(listing.price).toFixed(2)}
                </p>

                <p class="text-small text-muted">
                    ${escapeHtml(listing.description || "")}
                </p>

            </div>
        `;

        container.appendChild(card);
    });
}

/**
 * Search functionality
 */
function setupSearch() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
        const query = e.target.value;
        const filtered = filterListings(allListings, query);
        displayListings(filtered);
    });
}

/**
 * Escape HTML to prevent breaking UI
 */
function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * Init page
 */
export function initListingsPage() {
    loadListings();
    setupSearch();
}

/**
 * Auto-run
 */
initListingsPage();