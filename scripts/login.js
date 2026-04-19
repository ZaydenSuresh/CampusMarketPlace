import { loginUser, registerUser, logoutUser, getCurrentUser } from "./auth.js";

const loginTab = document.getElementById("tab-login");
const registerTab = document.getElementById("tab-register");

const loginPanel = document.getElementById("panel-login");
const registerPanel = document.getElementById("panel-register");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const googleLoginBtn = document.getElementById("google-login-btn");
const errorBox = document.getElementById("error-message");

const cardHeading = document.getElementById("card-heading");
const cardSubheading = document.getElementById("card-subheading");

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

const loginHeading = "Welcome Back!";
const loginSubheading = "Sign in to start trading with your campus community";

function showLoginPanel() {
  if (loginPanel) loginPanel.classList.remove("hidden");
  if (registerPanel) registerPanel.classList.add("hidden");

  if (loginTab) loginTab.classList.add("active");
  if (registerTab) registerTab.classList.remove("active");

  cardHeading.textContent = loginHeading;
  cardSubheading.textContent = loginSubheading;

  clearError();
}

const signupHeading = "Join Our Community!";
const signupSubheading =
  "Create an account to start trading with your campus community";

function showRegisterPanel() {
  if (registerPanel) registerPanel.classList.remove("hidden");
  if (loginPanel) loginPanel.classList.add("hidden");

  if (registerTab) registerTab.classList.add("active");
  if (loginTab) loginTab.classList.remove("active");

  cardHeading.textContent = signupHeading;
  cardSubheading.textContent = signupSubheading;

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

    if (!name || !email || !password) {
      showError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      showError("Password must be at least 6 characters.");
      return;
    }

    try {
      await registerUser({ name, email, password });
      // TODO: make the alert align with page design
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
      const user = await getCurrentUser();

      if (!user) {
        console.error("Login error: User not found.");
        showError("User not found.");
        return;
      }

      if (user.role === "Student") {
        window.location.href = "/dashboard.html";
      } else if (user.role === "Trade Facility Staff") {
        window.location.href = "/manage-slots.html";
      }
    } catch (err) {
      console.error("Login error:", err.message);
      showError(err.message);
    }
  });
}
