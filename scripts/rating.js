let selectedRating = 0;

const stars = document.querySelectorAll("#stars button");
const reviewText = document.getElementById("reviewText");
const submitBtn = document.getElementById("submitRatingBtn");
const message = document.getElementById("ratingMessage");

const transactionIdText = document.getElementById("transactionIdText");
const sellerIdText = document.getElementById("sellerIdText");

const params = new URLSearchParams(window.location.search);

const transactionId = params.get("transactionId");
const sellerId = params.get("sellerId");

if (transactionId) {
    transactionIdText.textContent = transactionId;
}

if (sellerId) {
    sellerIdText.textContent = sellerId;
}

if (!transactionId || !sellerId) {
    message.textContent = "Missing transaction or seller details.";
    message.className = "error-message";
    submitBtn.disabled = true;
}

stars.forEach((star) => {
    star.addEventListener("click", () => {
        selectedRating = Number(star.dataset.value);

        stars.forEach((s) => {
            if (Number(s.dataset.value) <= selectedRating) {
                s.classList.add("active");
            } else {
                s.classList.remove("active");
            }
        });

        message.textContent = "";
        message.className = "";
    });
});

submitBtn.addEventListener("click", () => {
    const review = reviewText.value.trim();

    if (selectedRating === 0) {
        message.textContent = "Please select a rating.";
        message.className = "error-message";
        return;
    }


    const ratingData = {
        transactionId: transactionId,
        sellerId: sellerId,
        rating: selectedRating,
        review: review
    };

    console.log("Rating ready to send:", ratingData);

    message.textContent = "Rating submitted successfully.";
    message.className = "success-message";

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitted";
});