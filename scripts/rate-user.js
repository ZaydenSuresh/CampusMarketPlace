const API = "http://localhost:3000";

const form = document.getElementById("rating-form");
const feedbackMessage = document.getElementById("feedback-message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    // Temporary placeholder until login/auth is fully connected
    const raterId = localStorage.getItem("user_id") || "demo-user-123";

    const ratedUserId = document.getElementById("rated_user_id").value.trim();
    const listingId = document.getElementById("listing_id").value.trim();
    const score = document.getElementById("score").value;
    const review = document.getElementById("review").value.trim();

    const response = await fetch(`${API}/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        rater_id: raterId,
        rated_user_id: ratedUserId,
        listing_id: listingId || null,
        score: Number(score),
        review
      })
    });

    const result = await response.json();

    if (!response.ok) {
      feedbackMessage.textContent = result.error || "Failed to submit rating";
      feedbackMessage.style.color = "red";
      return;
    }

    feedbackMessage.textContent = "Rating submitted successfully";
    feedbackMessage.style.color = "green";
    form.reset();
  } catch (err) {
    feedbackMessage.textContent = "Something went wrong";
    feedbackMessage.style.color = "red";
  }
});