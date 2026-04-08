/**
 * SmartFertify Auth v3.0
 * All user data stored in MongoDB Atlas via /api/auth/* endpoints.
 * Token stored in localStorage for session persistence.
 */

const API_BASE = '';   // same origin as the FastAPI server

// ── Token helpers ─────────────────────────────────────────────────────────────
function saveSession(token, username, email) {
    localStorage.setItem('sf_token',    token);
    localStorage.setItem('sf_username', username);
    localStorage.setItem('sf_email',    email);
}

function clearSession() {
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_username');
    localStorage.removeItem('sf_email');
}

function getToken()    { return localStorage.getItem('sf_token'); }
function getUsername() { return localStorage.getItem('sf_username'); }
function getEmail()    { return localStorage.getItem('sf_email'); }
function isLoggedIn()  { return !!getToken(); }

// ── API calls ─────────────────────────────────────────────────────────────────
async function registerUser(username, email, password) {
    try {
        const resp = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
        });
        const data = await resp.json();
        if (!resp.ok) {
            return { success: false, message: data.detail || 'Registration failed' };
        }
        return { success: true, message: data.message };
    } catch (e) {
        return { success: false, message: 'Network error: ' + e.message };
    }
}

async function loginUser(email, password) {
    try {
        const resp = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await resp.json();
        if (!resp.ok) {
            return { success: false, message: data.detail || 'Login failed' };
        }
        saveSession(data.token, data.username, data.email);
        return { success: true, message: data.message };
    } catch (e) {
        return { success: false, message: 'Network error: ' + e.message };
    }
}

function logoutUser() {
    clearSession();
    return { success: true, message: 'Logged out' };
}

// Fetch analysis history from MongoDB
async function fetchHistory() {
    const token = getToken();
    if (!token) return [];
    try {
        const resp = await fetch(`${API_BASE}/api/history`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!resp.ok) return [];
        return await resp.json();
    } catch { return []; }
}

// Delete a history record
async function deleteHistoryItem(docId) {
    const token = getToken();
    if (!token) return false;
    try {
        const resp = await fetch(`${API_BASE}/api/history/${docId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        return resp.ok;
    } catch { return false; }
}

// ── Nav update (called on every page load) ────────────────────────────────────
function updateNavAuth() {
    const nav = document.getElementById('authNavArea');
    if (!nav) return;
    if (isLoggedIn()) {
        nav.innerHTML = `
            <span class="nav-user-chip">
                <span class="nav-user-icon">👤</span>
                ${getUsername()}
            </span>
            <button class="float-nav-btn" onclick="showPage('profile')">Profile</button>
            <button class="float-nav-btn nav-logout-btn" onclick="handleLogout()">Logout</button>
        `;
    } else {
        nav.innerHTML = `
            <a href="auth.html" class="float-nav-btn nav-login-btn">Login / Register</a>
        `;
    }
}

function handleLogout() {
    logoutUser();
    window.location.href = 'auth.html';
}

document.addEventListener('DOMContentLoaded', updateNavAuth);
