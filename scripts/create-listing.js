// Get form and message elements
const form = document.getElementById("createListingForm");
const formMessage = document.getElementById("formMessage");

// Handle form submission
form.addEventListener("submit", async (e) => {
  // Prevent default form submission (page reload)
  e.preventDefault();

  // Get form field values
  const title = document.getElementById("title").value.trim();
  const price = document.getElementById("price").value.trim();
  const category = document.getElementById("category").value;
  const condition = document.getElementById("condition").value;
  const sale_type = document.getElementById("sale_type").value;
  const description = document.getElementById("description").value.trim();
  const image_url = document.getElementById("image_url").value.trim();

  // Clear previous messages
  formMessage.textContent = "";
  formMessage.className = "message";

  try {
    // Get logged-in user's ID from /auth/me endpoint
    const authRes = await fetch('/auth/me');
    if (!authRes.ok) {
      throw new Error('Not authenticated. Please log in.');
    }
    const { user } = await authRes.json();

    // Send POST request to create listing
    const response = await fetch("/listings", {
      method: "POST",
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
        image_url,
        user_id: user.id  // Use actual logged-in user's ID from auth
      }),
    });

    const data = await response.json();

    // Handle error response
    if (!response.ok) {
      throw new Error(data.error || "Failed to create listing");
    }

    // Show success message
    formMessage.textContent = "Listing created successfully.";
    formMessage.classList.add("success");
    form.reset();

    // Redirect to dashboard after 1.2 seconds
    setTimeout(() => {
      window.location.href = "/dashboard.html";
    }, 1200);
  } catch (error) {
    // Show error message
    formMessage.textContent = error.message;
    formMessage.classList.add("error");
  }
});