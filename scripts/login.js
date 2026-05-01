import { loginUser, registerUser, logoutUser, getCurrentUser } from "./auth.js";

const loginTab = document.getElementById("tab-login");
const registerTab = document.getElementById("tab-register");

const loginPanel = document.getElementById("panel-login");
const registerPanel = document.getElementById("panel-register");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const googleLoginBtns = document.querySelectorAll(".google-btn");
const errorBox = document.getElementById("error-message");

const cardHeading = document.getElementById("card-heading");
const cardSubheading = document.getElementById("card-subheading");

// Replaces button text with spinner during async operations
function setButtonLoading(btn, loading) {
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<span class="btn-spinner"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText;
    btn.disabled = false;
  }
}

// Reset button states when page is restored from Alt+←
window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    googleLoginBtns.forEach((btn) => {
      if (btn.disabled) setButtonLoading(btn, false);
    });
    if (document.getElementById("login-submit-btn")?.disabled) {
      setButtonLoading(document.getElementById("login-submit-btn"), false);
    }
    if (document.getElementById("register-submit-btn")?.disabled) {
      setButtonLoading(document.getElementById("register-submit-btn"), false);
    }
  }
});

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
  if (registerPanel) {
    registerPanel.style.opacity = "0";
    registerPanel.style.transform = "translateX(10px)";
  }

  if (loginTab) loginTab.classList.add("active");
  if (registerTab) registerTab.classList.remove("active");

  // Reset register button spinner when switching tabs
  const regBtn = document.getElementById("register-submit-btn");
  if (regBtn?.disabled) setButtonLoading(regBtn, false);

  if (cardHeading && cardSubheading) {
    cardHeading.style.opacity = 0;
    cardHeading.style.transform = "translateX(-10px)";
    cardSubheading.style.opacity = 0;
    cardSubheading.style.transform = "translateX(-10px)";
    setTimeout(() => {
      cardHeading.textContent = loginHeading;
      cardSubheading.textContent = loginSubheading;
      cardHeading.style.opacity = 1;
      cardHeading.style.transform = "translateX(0)";
      cardSubheading.style.opacity = 1;
      cardSubheading.style.transform = "translateX(0)";
    }, 200);
  }

  setTimeout(() => {
    if (loginPanel) {
      loginPanel.style.opacity = "0";
      loginPanel.style.transform = "translateX(-10px)";
      loginPanel.classList.remove("hidden");
      setTimeout(() => {
        loginPanel.style.opacity = "1";
        loginPanel.style.transform = "translateX(0)";
      }, 50);
    }
    if (registerPanel) registerPanel.classList.add("hidden");
  }, 200);

  const slider = document.querySelector(".toggle-slider");
  if (slider) slider.style.transform = "translateX(0)";

  clearError();
}

const signupHeading = "Join Our Community!";
const signupSubheading =
  "Create an account to start trading with your campus community";

function showRegisterPanel() {
  if (loginPanel) {
    loginPanel.style.opacity = "0";
    loginPanel.style.transform = "translateX(10px)";
  }

  if (registerTab) registerTab.classList.add("active");
  if (loginTab) loginTab.classList.remove("active");

  if (cardHeading && cardSubheading) {
    cardHeading.style.opacity = 0;
    cardHeading.style.transform = "translateX(-10px)";
    cardSubheading.style.opacity = 0;
    cardSubheading.style.transform = "translateX(-10px)";
    setTimeout(() => {
      cardHeading.textContent = signupHeading;
      cardSubheading.textContent = signupSubheading;
      cardHeading.style.opacity = 1;
      cardHeading.style.transform = "translateX(0)";
      cardSubheading.style.opacity = 1;
      cardSubheading.style.transform = "translateX(0)";
    }, 200);
  }

  setTimeout(() => {
    if (registerPanel) {
      registerPanel.style.opacity = "0";
      registerPanel.style.transform = "translateX(-10px)";
      registerPanel.classList.remove("hidden");
      setTimeout(() => {
        registerPanel.style.opacity = "1";
        registerPanel.style.transform = "translateX(0)";
      }, 50);
    }
    if (loginPanel) loginPanel.classList.add("hidden");
  }, 200);

  const slider = document.querySelector(".toggle-slider");
  if (slider) slider.style.transform = "translateX(100%)";

  clearError();
}

// Toggle tabs
if (loginTab) {
  loginTab.addEventListener("click", showLoginPanel);
}

if (registerTab) {
  registerTab.addEventListener("click", showRegisterPanel);
}

// google button event handler
for (const googleLoginBtn of googleLoginBtns) {
  googleLoginBtn.addEventListener("click", () => {
    setButtonLoading(googleLoginBtn, true);
    setTimeout(() => {
      window.location.href = `/auth/google`;
    }, 100);
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const name = document.getElementById("reg-name")?.value.trim();
    const email = document.getElementById("reg-email")?.value.trim();
    const password = document.getElementById("reg-password")?.value;
    const submitBtn = document.getElementById("register-submit-btn");

    if (!name || !email || !password) {
      showError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      showError("Password must be at least 6 characters.");
      return;
    }

    setButtonLoading(submitBtn, true);

    try {
      await registerUser({ name, email, password });
      alert("Account created successfully. You can now log in.");
      registerForm.reset();
      showLoginPanel();
    } catch (err) {
      console.error("Register error:", err.message);
      showError(err.message);
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const email = document.getElementById("login-email")?.value.trim();
    const password = document.getElementById("login-password")?.value;
    const submitBtn = document.getElementById("login-submit-btn");

    if (!email || !password) {
      showError("Please enter your email and password.");
      return;
    }

    setButtonLoading(submitBtn, true);

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
      } else if (user.role === "Admin") {
        window.location.href = "/admin-dashboard.html";
      }
    } catch (err) {
      console.error("Login error:", err.message);
      showError(err.message);
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}
