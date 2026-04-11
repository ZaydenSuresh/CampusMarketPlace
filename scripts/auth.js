
const API_BASE = 'http://localhost:3000/api/auth';


async function handleResponse(response) {
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
    }

    return data;
}


export async function registerUser({ name, email, password }) {
    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await handleResponse(response);

        console.log(' Registered:', data);

        
        window.location.href = '/login.html';

    } catch (err) {
        console.error(' Register error:', err.message);
        showError(err.message);
    }
}


export async function loginUser({ email, password }) {
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await handleResponse(response);

        console.log(' Login success:', data);

        localStorage.setItem('token', data.token);

        window.location.href = '/dashboard.html';

    } catch (err) {
        console.error('Login error:', err.message);
        showError(err.message);
    }
}


export function logoutUser() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}


export function isAuthenticated() {
    return !!localStorage.getItem('token');
}


export function authHeader() {
    const token = localStorage.getItem('token');

    return token
        ? { Authorization: `Bearer ${token}` }
        : {};
}

function showError(message) {
    const errorBox = document.getElementById('error-message');

    if (errorBox) {
        errorBox.textContent = message;
        errorBox.style.display = 'block';
    } else {
        alert(message);
    }
}