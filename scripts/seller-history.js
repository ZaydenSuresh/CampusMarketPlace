//DOM element references

const sellerName = document.getElementById("seller-name");
const sellerMeta = document.getElementById("seller-meta");
const sellerRating = document.getElementById("seller-rating");
const reviewsList = document.getElementById("reviews-list");
const transactionsGrid = document.getElementById("transactions-grid");

//Getting the seller ID from the URL
const params = new URLSearchParams(window.location.search);
const sellerId = params.get("sellerId");

//Neat readable date 
function formatDate(dateString) {
  if (!dateString) return "Unknown date";

  return new Date(dateString).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatMonthYear(dateString) {
  if (!dateString) return "Unknown";

  return new Date(dateString).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
  });
}

function renderStars(rating) {
  const rounded = Math.round(Number(rating) || 0);
  return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}
// Error if seller history cannot be loaded for some reason
function showError(message) {
  sellerName.textContent = "Could not load seller";
  sellerMeta.textContent = message;
  sellerRating.textContent = "";
  reviewsList.innerHTML = `<p>${message}</p>`;
  transactionsGrid.innerHTML = `<p>${message}</p>`;
}

async function loadSellerHistory() {
  if (!sellerId) {
    showError("No seller specified.");
    return;
  }

  try {
    const response = await fetch(`/seller-history/${sellerId}`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to load seller history");
    }

    renderSellerHeader(data.seller, data.rating);
    renderReviews(data.reviews || [], data.seller.id);
    renderTransactions(data.completed_transactions || []);
  } catch (error) {
    console.error("Seller history page error:", error);
    showError("Failed to load seller history.");
  }
}

function renderSellerHeader(seller, rating) {
  sellerName.textContent = seller.name || "Unknown seller";
  sellerMeta.textContent = `Member since ${formatMonthYear(seller.member_since)}`;
  sellerRating.textContent = `${rating.average} / 5 rating from ${rating.total} review(s)`;
}

function renderReviews(reviews, currentSellerId) {
  if (reviews.length === 0) {
    reviewsList.innerHTML = `<p>No reviews yet.</p>`;
    return;
  }

  const loggedInUserId = localStorage.getItem("user_id");

  reviewsList.innerHTML = reviews
    .map((review) => {
      const isSellerViewingOwnPage = loggedInUserId === currentSellerId;

      const flagButton = isSellerViewingOwnPage
        ? ""
        : review.flagged
        ? `<button class="secondary-btn" disabled>Flagged</button>`
        : `<button class="secondary-btn flag-review-btn" data-rating-id="${review.id}">Flag</button>`;

      return `
        <article class="review-card">
          <div class="review-header">
            <strong>${review.reviewer_name}</strong>
            <span>${formatDate(review.date)}</span>
          </div>

          <p class="review-stars">${renderStars(review.rating)} (${review.rating}/5)</p>
          <p>${review.review || "No written review."}</p>

          <div class="review-actions">
            ${flagButton}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTransactions(transactions) {
  if (transactions.length === 0) {
    transactionsGrid.innerHTML = `<p>No completed transactions yet.</p>`;
    return;
  }

  transactionsGrid.innerHTML = transactions
    .map((transaction) => {
      return `
        <article class="transaction-card">
          <img 
            src="${transaction.item_image || "/images/placeholder.png"}" 
            alt="${transaction.item_title}" 
            class="transaction-image"
          />

          <div class="transaction-details">
            <h3>${transaction.item_title}</h3>
            <p>Price: R${Number(transaction.item_price).toFixed(2)}</p>
            <p>Buyer: ${transaction.buyer_name}</p>
            <p>Date: ${formatDate(transaction.date)}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

reviewsList.addEventListener("click", async (event) => {
  const button = event.target.closest(".flag-review-btn");

  if (!button) return;

  const ratingId = button.dataset.ratingId;

  try {
    button.disabled = true;
    button.textContent = "Flagging...";

    const response = await fetch(`/ratings/${ratingId}/flag`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to flag review");
    }

    button.textContent = "Flagged";
    button.classList.remove("flag-review-btn");
    alert("Review flagged for moderator review.");
  } catch (error) {
    console.error("Flag review error:", error);
    button.disabled = false;
    button.textContent = "Flag";
    alert("Could not flag review.");
  }
});

loadSellerHistory();