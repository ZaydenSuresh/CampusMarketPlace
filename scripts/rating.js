let selectedRating = 0;

const stars = document.querySelectorAll("#stars button");
const reviewText = document.getElementById("reviewText");
const submitBtn = document.getElementById("submitRatingBtn");
const message = document.getElementById("ratingMessage");

const pageHeading = document.getElementById("pageHeading");
const itemTitleText = document.getElementById("itemTitleText");
const ratedNameText = document.getElementById("ratedNameText");

const params = new URLSearchParams(window.location.search);

const transactionId = params.get("transactionId");
const ratedId = params.get("ratedId");
const ratedName = params.get("ratedName");
const itemTitle = params.get("itemTitle");
const ratedRole = params.get("ratedRole");

if (ratedRole) {
    pageHeading.textContent = "Rate " + (ratedRole === "buyer" ? "Buyer" : "Seller");
}

if (itemTitle) {
    itemTitleText.textContent = decodeURIComponent(itemTitle);
}

if (ratedName) {
    ratedNameText.textContent = decodeURIComponent(ratedName);
}

if (!transactionId || !ratedId) {
    message.textContent = "Missing transaction or rating details.";
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

submitBtn.addEventListener("click", async () => {
    const review = reviewText.value.trim();

    if (selectedRating === 0) {
        message.textContent = "Please select a rating.";
        message.className = "error-message";
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
        const res = await fetch("/ratings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rated_id: ratedId,
                transaction_id: transactionId,
                rating: selectedRating,
                review: review || null
            })
        });

        const data = await res.json();

        if (!res.ok) {
            message.textContent = data.error || "Failed to submit rating.";
            message.className = "error-message";
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Rating";
            return;
        }

        message.textContent = "Rating submitted successfully!";
        message.className = "success-message";
        submitBtn.textContent = "Submitted";

        setTimeout(() => {
            window.location.href = "/student-transactions.html";
        }, 1500);
    } catch (err) {
        message.textContent = "Something went wrong. Please try again.";
        message.className = "error-message";
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Rating";
    }
});