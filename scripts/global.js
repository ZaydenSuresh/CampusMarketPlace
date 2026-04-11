

const APP_CONFIG = {
  API_BASE:
    window.API_BASE ||
    `${window.location.protocol}//${window.location.hostname}:3000/api`,
  LOGIN_PAGE:     '/pages/login.html',
  DASHBOARD_PAGE: '/pages/dashboard.html',
  TOKEN_KEY:      'cm_token',
  USER_KEY:       'cm_user'
};
// STORAGE / SESSION HELPERS

function saveToken(token) {
  localStorage.setItem(APP_CONFIG.TOKEN_KEY, token);
}

function getToken() {
  return localStorage.getItem(APP_CONFIG.TOKEN_KEY);
}

function saveUser(user) {
  localStorage.setItem(APP_CONFIG.USER_KEY, JSON.stringify(user));
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(APP_CONFIG.USER_KEY));
  } catch (error) {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(APP_CONFIG.TOKEN_KEY);
  localStorage.removeItem(APP_CONFIG.USER_KEY);
}

function isLoggedIn() {
  return !!getToken();
}

function logoutUser(redirect = true) {
  clearSession();
  if (redirect) {
    window.location.href = APP_CONFIG.LOGIN_PAGE;
  }
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = APP_CONFIG.LOGIN_PAGE;
  }
}

function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.href = APP_CONFIG.DASHBOARD_PAGE;
  }
}

// API HELPERS

async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const config = {
    method: options.method || 'GET',
    headers
  };

  if (options.body !== undefined) {
    config.body = isFormData ? options.body : JSON.stringify(options.body);
  }

  try {
    const response    = await fetch(`${APP_CONFIG.API_BASE}${endpoint}`, config);
    const status      = response.status;
    const contentType = response.headers.get('content-type') || '';

    const result = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (status === 401) {
      clearSession();
      showToast('Session expired. Please log in again.', 'error');
      window.location.href = `${APP_CONFIG.LOGIN_PAGE}?session=expired`;
      return { data: null, error: 'Session expired.', status };
    }

    if (!response.ok) {
      return {
        data:  null,
        error: result?.message || result || `Request failed with status ${status}`,
        status
      };
    }

    return { data: result, error: null, status };

  } catch (error) {
    console.error('[API ERROR]', endpoint, error);
    return {
      data:   null,
      error:  'Network error. Please check your connection.',
      status: 0
    };
  }
}

const api = {
  get:    (endpoint)       => apiRequest(endpoint, { method: 'GET' }),
  post:   (endpoint, body) => apiRequest(endpoint, { method: 'POST',   body }),
  put:    (endpoint, body) => apiRequest(endpoint, { method: 'PUT',    body }),
  patch:  (endpoint, body) => apiRequest(endpoint, { method: 'PATCH',  body }),
  delete: (endpoint)       => apiRequest(endpoint, { method: 'DELETE' })
};

// VALIDATION HELPERS

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return typeof password === 'string' && password.trim().length >= 6;
}

function isRequired(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function isPositiveNumber(value) {
  return !isNaN(value) && Number(value) > 0;
}

// FORM ERROR HELPERS

function showFieldError(inputEl, message) {
  if (!inputEl) return;
  inputEl.classList.add('error');
  const errorEl = inputEl.closest('.form-group')?.querySelector('.form-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('visible');
  }
}

function clearFieldError(inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove('error');
  const errorEl = inputEl.closest('.form-group')?.querySelector('.form-error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }
}

function clearAllErrors(formEl) {
  if (!formEl) return;
  formEl
    .querySelectorAll('.form-input, .form-select, .form-textarea, input, select, textarea')
    .forEach(clearFieldError);
}

// BUTTON / LOADING HELPERS
function setButtonLoading(button, loadingText = 'Loading...') {
  if (!button) return;
  button.dataset.originalText = button.dataset.originalText || button.textContent;
  button.disabled = true;
  button.classList.add('loading');
  button.textContent = loadingText;
}

function clearButtonLoading(button, fallbackText = 'Submit') {
  if (!button) return;
  button.disabled = false;
  button.classList.remove('loading');
  button.textContent = button.dataset.originalText || fallbackText;
}

// TOAST NOTIFICATIONS

function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');

  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');

  toast.addEventListener('click', () => toast.remove());
  container.appendChild(toast);

  setTimeout(() => { toast.style.opacity = '0'; }, duration);
  setTimeout(() => { toast.remove(); },            duration + 400);
}


function formatPrice(amount) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR'
  }).format(Number(amount) || 0);
}

function formatDate(dateValue) {
  if (!dateValue) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(new Date(dateValue));
}

function formatDateTime(dateValue) {
  if (!dateValue) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(dateValue));
}

function truncate(text, maxLength = 80) {
  if (!text) return '';
  return text.length > maxLength
    ? `${text.slice(0, maxLength).trimEnd()}…`
    : text;
}


function debounce(fn, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

function qsa(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

// Populates navbar/account elements if they exist on the page.

function populateUserUI() {
  const user = getUser();
  if (!user) return;

  const avatarEl = qs('[data-user-avatar]');
  const nameEl   = qs('[data-user-name]');
  const emailEl  = qs('[data-user-email]');

  if (avatarEl) {
    avatarEl.textContent = (user.name || user.email || 'U')
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  if (nameEl)  nameEl.textContent  = user.name  || 'User';
  if (emailEl) emailEl.textContent = user.email || '';
}

function bindLogoutButtons() {
  qsa('[data-logout]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      logoutUser(true);
    });
  });
}


document.addEventListener('DOMContentLoaded', () => {
  populateUserUI();
  bindLogoutButtons();
});
//Global exports:)

window.APP_CONFIG         = APP_CONFIG;
window.api                = api;
window.saveToken          = saveToken;
window.getToken           = getToken;
window.saveUser           = saveUser;
window.getUser            = getUser;
window.clearSession       = clearSession;
window.isLoggedIn         = isLoggedIn;
window.logoutUser         = logoutUser;
window.requireAuth        = requireAuth;
window.redirectIfLoggedIn = redirectIfLoggedIn;
window.isValidEmail       = isValidEmail;
window.isValidPassword    = isValidPassword;
window.isRequired         = isRequired;
window.isPositiveNumber   = isPositiveNumber;
window.showFieldError     = showFieldError;
window.clearFieldError    = clearFieldError;
window.clearAllErrors     = clearAllErrors;
window.setButtonLoading   = setButtonLoading;
window.clearButtonLoading = clearButtonLoading;
window.showToast          = showToast;
window.formatPrice        = formatPrice;
window.formatDate         = formatDate;
window.formatDateTime     = formatDateTime;
window.truncate           = truncate;
window.debounce           = debounce;
window.qs                 = qs;
window.qsa                = qsa;
