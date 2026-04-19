// frontend/scripts/listings.js

import { filterListings } from "../components/search.js";
import { createListingCard } from "../components/card.js";

let allListings = [];

/**
 * Fetch listings from backend API
 */
export async function loadListings() {
    try {
        // Fetch ALL listings (not limited to 6)
        const res = await fetch("/listings/all");
        const data = await res.json();

        // Ensure correct data format
        allListings = data.listings || [];

        displayListings(allListings);

    } catch (err) {
        console.error("Error fetching listings:", err);
    }
}

/**
 * Render listings into dashboard UI
 * Uses reusable card component (card.js)
 */
function displayListings(listings) {
    const container = document.getElementById("listings-container");
    if (!container) return;

    container.innerHTML = "";

    if (!listings.length) {
        container.innerHTML = `<p class="text-muted">No listings available</p>`;
        return;
    }

    listings.forEach(listing => {
        const card = createListingCard(listing);
        container.appendChild(card);
    });
}

/**
 * EDIT + UPDATE LISTING (PUT request)
 * After update, we refresh listings so UI stays in sync with database
 */
async function editListing(id) {
    try {
        const newTitle = prompt("Enter new title:");
        const newPrice = prompt("Enter new price:");

        // Prevent empty updates (basic validation)
        if (!newTitle && !newPrice) return;

        await fetch(`/listings/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: newTitle,
                price: newPrice
            })
        });

        // Refresh UI after update
        await loadListings();

    } catch (err) {
        console.error("Error updating listing:", err);
    }
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

/**
 * Expose edit function globally for card button access
 */
window.editListing = editListing;