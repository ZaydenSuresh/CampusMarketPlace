const form = document.getElementById("createListingForm");
const formMessage = document.getElementById("formMessage");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("title").value.trim();
  const price = document.getElementById("price").value.trim();
  const category = document.getElementById("category").value;
  const description = document.getElementById("description").value.trim();
  const image_url = document.getElementById("image_url").value.trim();

  formMessage.textContent = "";
  formMessage.className = "message";

  try {
    const response = await fetch("/listings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        price: Number(price),
        category,
        description,
        image_url,
        user_id: "2f089266-1b66-495a-b628-c37877c75716"
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to create listing");
    }

    formMessage.textContent = "Listing created successfully.";
    formMessage.classList.add("success");
    form.reset();

    setTimeout(() => {
      window.location.href = "/dashboard.html";
    }, 1200);
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.classList.add("error");
  }
});