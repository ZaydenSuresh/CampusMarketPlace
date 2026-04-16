const API_BASE = "/auth";

async function handleResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    console.error("Non-JSON response from server:", text);
    throw new Error("Server returned HTML instead of JSON.");
  }

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

export async function registerUser({ name, email, password }) {
  const response = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
  });

  return handleResponse(response);
}

export async function loginUser({ email, password }) {
  const response = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  return handleResponse(response);
}

export async function getCurrentUser() {
  const response = await fetch(`${API_BASE}/me`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.ok ? data.user : null;
}

export async function logoutUser() {
  try {
    await fetch(`${API_BASE}/logout`, {
      method: "POST",
    });
    window.location.href = "/login.html";
  } catch (err) {
    console.error("Logout request failed:", err);
  }
}
