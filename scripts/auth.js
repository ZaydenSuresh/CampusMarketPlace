const API_BASE = "/auth";

const loginTab = document.getElementById("tab-login");
const registerTab = document.getElementById("tab-register");

const loginPanel = document.getElementById("panel-login");
const registerPanel = document.getElementById("panel-register");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const googleLoginBtn = document.getElementById("google-login-btn");
const errorBox = document.getElementById("error-message");

function showError(message) {
  if (!errorBox) {
    alert(message);
    return;
  }

  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  if (!errorBox) return;
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function showLoginPanel() {
  if (loginPanel) loginPanel.classList.remove("hidden");
  if (registerPanel) registerPanel.classList.add("hidden");

  if (loginTab) loginTab.classList.add("active");
  if (registerTab) registerTab.classList.remove("active");

  clearError();
}

function showRegisterPanel() {
  if (registerPanel) registerPanel.classList.remove("hidden");
  if (loginPanel) loginPanel.classList.add("hidden");

  if (registerTab) registerTab.classList.add("active");
  if (loginTab) loginTab.classList.remove("active");

  clearError();
}

async function handleResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    console.error("Non-JSON response from server:", text);
    throw new Error("Server returned HTML instead of JSON.");
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

async function registerUser({ name, email, password }) {
  const response = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
  });

  return handleResponse(response);
}

async function loginUser({ email, password }) {
  const response = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  return handleResponse(response);
}

export async function logoutUser() {
  try {
    await fetch(`${API_BASE}/logout`, {
      method: "POST",
    });
  } catch (err) {
    console.error("Logout request failed:", err);
  }

  localStorage.removeItem("token");
  window.location.href = "/login.html";
}

export function isAuthenticated() {
  return !!localStorage.getItem("token");
}

export function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

if (loginTab) {
  loginTab.addEventListener("click", showLoginPanel);
}

if (registerTab) {
  registerTab.addEventListener("click", showRegisterPanel);
}

if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", () => {
    window.location.href = `${API_BASE}/google`;
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const name = document.getElementById("reg-name")?.value.trim();
    const email = document.getElementById("reg-email")?.value.trim();
    const password = document.getElementById("reg-password")?.value;
    const confirm = document.getElementById("reg-confirm")?.value;

    if (!name || !email || !password || !confirm) {
      showError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      showError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      showError("Passwords do not match.");
      return;
    }

    try {
      await registerUser({ name, email, password });
      alert("Account created successfully. You can now log in.");
      registerForm.reset();
      showLoginPanel();
    } catch (err) {
      console.error("Register error:", err.message);
      showError(err.message);
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const email = document.getElementById("login-email")?.value.trim();
    const password = document.getElementById("login-password")?.value;

    if (!email || !password) {
      showError("Please enter your email and password.");
      return;
    }

    try {
      const data = await loginUser({ email, password });

      if (data?.session?.access_token) {
        localStorage.setItem("token", data.session.access_token);
      }

      window.location.href = "/dashboard.html";
    } catch (err) {
      console.error("Login error:", err.message);
      showError(err.message);
    }
  });
}