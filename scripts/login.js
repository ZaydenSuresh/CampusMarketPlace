import { loginUser, registerUser, logoutUser } from './auth.js';

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

// login form event handlers

// show login form
if (loginTab) {
  loginTab.addEventListener("click", showLoginPanel);
}

// show register form
if (registerTab) {
  registerTab.addEventListener("click", showRegisterPanel);
}

// google button event handler
if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", () => {
    window.location.href = `/auth/google`;
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

      window.location.href = "/dashboard.html";
    } catch (err) {
      console.error("Login error:", err.message);
      showError(err.message);
    }
  });
}
