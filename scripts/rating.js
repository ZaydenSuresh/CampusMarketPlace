//store rating user clicks on
let selectedRating = 0;

const stars = document.querySelectorAll("#stars button");//star btns from page
const reviewText = document.getElementById("reviewText");
const submitBtn = document.getElementById("submitRatingBtn");
const message = document.getElementById("ratingMessage");//error+success
//text areas js updates
const pageHeading = document.getElementById("pageHeading");
const itemTitleText = document.getElementById("itemTitleText");
const ratedNameText = document.getElementById("ratedNameText");

// Read all query params passed from student-transactions page
const params = new URLSearchParams(window.location.search);

const transactionId = params.get("transactionId");
const ratedId = params.get("ratedId");
const ratedName = params.get("ratedName");
const itemTitle = params.get("itemTitle");
const ratedRole = params.get("ratedRole");

// Show heading: "Rate Buyer" or "Rate Seller" based on who the user is rating
if (ratedRole) {
    pageHeading.textContent = "Rate " + (ratedRole === "buyer" ? "Buyer" : "Seller");//short way of writing if/else
}

//display item name on rating card
if (itemTitle) {
    itemTitleText.textContent = decodeURIComponent(itemTitle);//conv url-senc text into normal readable txt
}
//name of person being rate
if (ratedName) {
    ratedNameText.textContent = decodeURIComponent(ratedName);
}

//cant submit if required params are missing
if (!transactionId || !ratedId) {
    message.textContent = "Missing transaction or rating details.";
    message.className = "error-message";
    submitBtn.disabled = true;
}

// Star selection: highlight all stars up to the clicked one
stars.forEach((star) => {
    star.addEventListener("click", () => {
        selectedRating = Number(star.dataset.value);//conv text into no.

        stars.forEach((s) => {//loop thru each star
            if (Number(s.dataset.value) <= selectedRating) {//verify if star=supposed to be active
                s.classList.add("active");//change color
            } else {
                s.classList.remove("active");
            }
        });
        message.textContent = "";
        message.className = "";
    });
});

// Submit the rating to the backend
submitBtn.addEventListener("click", async () => {
    const review = reviewText.value.trim();

    // Require the user to select a star before submitting
    if (selectedRating === 0) {
        message.textContent = "Please select a rating.";
        message.className = "error-message";
        return;
    }

    // Disable button during submission to prevent double-clicks
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
        const res = await fetch("/ratings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // rater_id is NOT sent from the client — the backend gets it from the session
            body: JSON.stringify({
                rated_id: ratedId,
                transaction_id: transactionId,
                rating: selectedRating,
                review: review || null
            })
        });

        const data = await res.json();

        // Show server-side error if the request failed
        if (!res.ok) {
            message.textContent = data.error || "Failed to submit rating.";
            message.className = "error-message";
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Rating";
            return;
        }

        // On success, show confirmation then redirect back to transactions
        message.textContent = "Rating submitted successfully!";
        message.className = "success-message";
        submitBtn.textContent = "Submitted";

        setTimeout(() => {
            window.location.href = "/student-transactions.html";
        }, 1500);
    } catch (err) {
        // Network error or JSON parse failure
        message.textContent = "Something went wrong. Please try again.";
        message.className = "error-message";
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Rating";
    }
});