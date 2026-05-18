// Get form elements
const form = document.getElementById("createListingForm");
const formMessage = document.getElementById("formMessage");
const submitBtn = document.getElementById("submitBtn");
const deleteBtn = document.getElementById("deleteBtn");
const imageInput = document.getElementById("image");
const pageTitle = document.getElementById("pageTitle");
const pageDescription = document.getElementById("pageDescription");

// Target category and condition dropdown elements specifically
const categorySelect = document.getElementById("category");
const conditionSelect = document.getElementById("condition");
const priceInput = document.getElementById("price");

// Create and insert a <p> element for the suggestion text right after the category dropdown
const suggestionText = document.createElement("p");
suggestionText.id = "priceSuggestionText";
suggestionText.style.fontSize = "0.85rem";
suggestionText.style.marginTop = "4px";
suggestionText.style.fontWeight = "600";
if (categorySelect && categorySelect.parentNode) {
  categorySelect.parentNode.insertBefore(
    suggestionText,
    categorySelect.nextSibling,
  );
}

// Detect mode
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode");
const listingId = params.get("id");
const isEditMode = mode === "edit" && !!listingId;

/**
 * Show message helper
 */
function showMessage(message, type = "error") {
  formMessage.textContent = message;
  formMessage.className = "message";
  if (type) {
    formMessage.classList.add(type);
  }
}

/**
 * Fetch and display price suggestions based on South African market data
 */
async function updatePriceSuggestion() {
  const category = categorySelect.value;
  const condition = conditionSelect.value;

  // Clear suggestion display if values aren't fully selected
  if (!category || category === "All" || !condition || condition === "All") {
    suggestionText.textContent = "";
    return;
  }

  try {
    // Hit the endpoint layout: GET /listings/price-suggestion/:category?condition=:condition
    const response = await fetch(
      `/listings/price-suggestion/${encodeURIComponent(category)}?condition=${encodeURIComponent(condition)}`,
      {
        method: "GET",
        credentials: "include",
      },
    );

    if (!response.ok) return; // Silently ignore fetch failures

    const data = await response.json();

    if (data.ok && data.suggestion) {
      const adjustedPrice = data.suggestion.adjusted_price;
      suggestionText.textContent = `Suggested price: R${adjustedPrice} (based on SA market data)`;
      suggestionText.style.color = "var(--wits-gold, #D4AF37)"; // Give it a noticeable premium theme color

      // Optionally auto-fill the price input field if it's currently empty
      if (priceInput && !priceInput.value.trim()) {
        priceInput.value = adjustedPrice;
      }
    } else {
      // Suggestion returned null
      suggestionText.textContent =
        "No price suggestion available for this category";
      suggestionText.style.color = "#777777";
    }
  } catch (error) {
    // Silently ignore failures; do not block or break the listing form workspace
    console.error("Price suggestion fetch failed:", error);
  }
}

// Attach event listeners to trigger live calculation on selection changes
if (categorySelect && conditionSelect) {
  categorySelect.addEventListener("change", updatePriceSuggestion);
  conditionSelect.addEventListener("change", updatePriceSuggestion);
}

/**
 * Convert image file to base64 string
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Safely parse JSON responses
 */
async function parseJsonResponse(response) {
  const rawText = await response.text();
  console.log("RAW response:", rawText);

  let data = {};

  try {
    data = JSON.parse(rawText);
  } catch (parseError) {
    throw new Error(`Server returned non-JSON response: ${rawText}`);
  }

  console.log("Parsed response:", data);

  if (!response.ok) {
    throw new Error(
      data.message ||
        data.error ||
        `Request failed with status ${response.status}`,
    );
  }

  return data;
}

/**
 * Load listing for edit mode
 */
async function loadListingForEdit() {
  if (!isEditMode) return;

  try {
    if (pageTitle) {
      pageTitle.textContent = "Edit Listing";
    }

    if (pageDescription) {
      pageDescription.textContent =
        "Update the details below for your existing listing.";
    }

    if (submitBtn) {
      submitBtn.textContent = "Update Listing";
    }

    if (imageInput) {
      imageInput.required = false;
    }

    if (deleteBtn) {
      deleteBtn.classList.remove("hidden");
    }

    const response = await fetch(`/listings/${listingId}`, {
      method: "GET",
      credentials: "include",
    });

    const data = await parseJsonResponse(response);
    const listing = data.listing;

    if (!listing) {
      throw new Error("Listing not found.");
    }

    document.getElementById("title").value = listing.title || "";
    document.getElementById("price").value = listing.price ?? "";
    document.getElementById("category").value = listing.category || "";
    document.getElementById("condition").value = listing.condition || "";
    document.getElementById("sale_type").value = listing.sale_type || "";
    document.getElementById("description").value = listing.description || "";

    // Automatically calculate price advice based on the loaded edit data
    updatePriceSuggestion();
  } catch (error) {
    console.error("Load listing for edit error:", error);
    showMessage(
      error.message || "Failed to load listing for editing.",
      "error",
    );
  }
}

/**
 * Get current user from backend
 */
async function getCurrentUser() {
  const res = await fetch("/auth/me", {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Not authenticated");
  }

  const data = await res.json();
  return data.user;
}

/**
 * Delete listing
 */
if (deleteBtn) {
  deleteBtn.addEventListener("click", async () => {
    if (!isEditMode || !listingId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this listing?",
    );

    if (!confirmed) return;

    try {
      deleteBtn.disabled = true;
      submitBtn.disabled = true;
      showMessage("");

      const response = await fetch(`/listings/${listingId}`, {
        method: "DELETE",
        credentials: "include",
      });

      await parseJsonResponse(response);

      showMessage("Listing deleted successfully.", "success");

      setTimeout(() => {
        window.location.href = "/dashboard.html";
      }, 1000);
    } catch (error) {
      console.error("Delete listing error:", error);
      showMessage(error.message || "Failed to delete listing.", "error");
      deleteBtn.disabled = false;
      submitBtn.disabled = false;
    }
  });
}

/**
 * Handle form submit
 */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("title").value.trim();
  const price = document.getElementById("price").value.trim();
  const category = document.getElementById("category").value;
  const condition = document.getElementById("condition").value;
  const sale_type = document.getElementById("sale_type").value;
  const description = document.getElementById("description").value.trim();
  const imageFile = imageInput.files[0];

// 5MB limit (change if you want)
const MAX_SIZE = 5 * 1024 * 1024;

if (imageFile && imageFile.size > MAX_SIZE) {
  showMessage("Image too large. Maximum allowed size is 5MB.", "error");
  submitBtn.disabled = false;
  if (deleteBtn) deleteBtn.disabled = false;
  return;
}

  formMessage.textContent = "";
  formMessage.className = "message";
  submitBtn.disabled = true;
  if (deleteBtn) deleteBtn.disabled = true;

  try {
    await getCurrentUser();

    if (
      !title ||
      !price ||
      !category ||
      !condition ||
      !sale_type ||
      !description
    ) {
      throw new Error("Please fill in all fields.");
    }

    if (isEditMode) {
      const body = {
        title,
        price: Number(price),
        category,
        condition,
        sale_type,
        description,
      };

      if (imageFile) {
        const imageBase64 = await fileToBase64(imageFile);
        body.imageName = imageFile.name;
        body.imageType = imageFile.type;
        body.imageBase64 = imageBase64;
      }

      const response = await fetch(`/listings/${listingId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      await parseJsonResponse(response);

      showMessage("Listing updated successfully.", "success");
    } else {
      if (!imageFile) {
        throw new Error("Please upload an image.");
      }

      const imageBase64 = await fileToBase64(imageFile);

      const response = await fetch("/listings", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          price: Number(price),
          category,
          condition,
          sale_type,
          description,
          imageName: imageFile.name,
          imageType: imageFile.type,
          imageBase64,
        }),
      });

      await parseJsonResponse(response);

      showMessage("Listing created successfully.", "success");
      form.reset();

      // Clear out the advisory text node since the form fields are now empty
      suggestionText.textContent = "";
    }

    setTimeout(() => {
      window.location.href = "/dashboard.html";
    }, 1200);
  } catch (err) {
    console.error("Create/edit listing error:", err);
    showMessage(err.message || "Something went wrong.", "error");
  } finally {
    submitBtn.disabled = false;
    if (deleteBtn) deleteBtn.disabled = false;
  }
});

// Load edit data if needed
loadListingForEdit();
