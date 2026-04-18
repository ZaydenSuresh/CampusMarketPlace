const API_BASE = "/auth";

// Helper function to handle API responses - throws an error for non-JSON responses or failed requests
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

/**
 * Role-based access control helper
 * @param {string[]} allowedRoles - Array of roles that can access the page
 * @returns {object|null} - Returns user object if authorized, null if redirected
 *
 * If user is not logged in -> redirect to /login.html
 * If user role is not in allowedRoles -> redirect to appropriate page
 */
export async function requireRole(allowedRoles) {
  const user = await getCurrentUser();

  // User not logged in -> send to login
  if (!user) {
    window.location.href = "/login.html";
    return null;
  }

  // User role not in allowed list -> redirect based on their role
  if (!allowedRoles.includes(user.role)) {
    if (user.role === "Trade Facility Staff") {
      // Trade Facility Staff trying to access Student page -> go to their page
      window.location.href = "/manage-slots.html";
    } else {
      // Everyone else -> go to dashboard (default Student page)
      window.location.href = "/dashboard.html";
    }
    return null;
  }

  // User is authorized -> return user object
  return user;
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
