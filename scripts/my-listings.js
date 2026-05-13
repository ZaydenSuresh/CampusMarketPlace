import { createListingCard } from "../components/card.js";

const container = document.getElementById("my-listings-container");

async function loadMyListings() {
  try {
    // INSERT FILTER LOGIC HERE
    const statusFilter = document.getElementById("status-filter").value;
    const url = `/listings/search?user_id=me${statusFilter !== "All" ? "&status=" + statusFilter : ""}`;

    const response = await fetch(url);
    const data = await response.json();
    const listings = data.listings || [];

    container.innerHTML = "";

    if (listings.length === 0) {
      container.innerHTML = "<p>You haven't posted any items yet.</p>";
      return;
    }

    listings.forEach((listing) => {
      const card = createListingCard(listing);

      // Clean up any default buttons (like Buy Now)
      const buyerButtons = card.querySelectorAll(".buy-btn, .reserve-btn");
      buyerButtons.forEach((btn) => btn.remove());

      // Find or create the actions container
      let actions = card.querySelector(".card-actions");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "card-actions";
        card.appendChild(actions);
      }

      // Create the new styled button
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete Listing";
      deleteBtn.className = "delete-btn-styled";
      deleteBtn.onclick = () => deleteItem(listing.id);

      actions.appendChild(deleteBtn);
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Error loading listings:", error);
    container.innerHTML = "<p>Failed to load listings.</p>";
  }
}

async function deleteItem(id) {
  if (!confirm("Are you sure?")) return;

  try {
    const response = await fetch(`/listings/${id}`, { method: "DELETE" });
    const result = await response.json();

    if (response.ok) {
      showToast("Listing deleted successfully", "success");
      loadMyListings();
    } else {
      const errorMsg = result.error.includes("foreign key")
        ? "Cannot delete: This item is part of a transaction."
        : result.error;
      showToast(errorMsg, "error");
    }
  } catch (error) {
    showToast("An error occurred", "error");
  }
}

function showToast(message, type) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Automatically remove after 3 second
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

loadMyListings();

document
  .getElementById("status-filter")
  .addEventListener("change", () => loadMyListings());
