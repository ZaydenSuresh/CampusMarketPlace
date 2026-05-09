import { createListingCard } from "../components/card.js";

const container = document.getElementById("my-listings-container");

async function loadMyListings() {
  try {
    // Fetch only listings where user_id = me
    const response = await fetch("/listings/search?user_id=me");
    const data = await response.json();
    const listings = data.listings || [];

    container.innerHTML = "";

    if (listings.length === 0) {
      container.innerHTML = "<p>You haven't posted any items yet.</p>";
      return;
    }

    listings.forEach((listing) => {
      // Reuse the createListingCard function
      const card = createListingCard(listing);
      const actions = card.querySelector(".card-actions");

      // Add the Delete button specifically for this page
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.className = "edit-btn";
      deleteBtn.style.backgroundColor = "#ff4444";
      deleteBtn.style.marginLeft = "10px";

      deleteBtn.addEventListener("click", () => deleteItem(listing.id));

      actions.appendChild(deleteBtn);
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Error loading listings:", error);
    container.innerHTML = "<p>Failed to load listings.</p>";
  }
}

async function deleteItem(id) {
  // Confirm dialog before deletion
  if (
    !confirm(
      "Are you sure you want to delete this listing? This cannot be undone.",
    )
  )
    return;

  try {
    const response = await fetch(`/listings/${id}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (response.ok) {
      alert("Listing deleted successfully.");
      loadMyListings();
    } else {
      // Prevent deleting if active transactions exist
      alert(result.error || "Could not delete item.");
    }
  } catch (error) {
    alert("An error occurred while deleting.");
  }
}

loadMyListings();
