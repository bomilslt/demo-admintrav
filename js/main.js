/**
 * INTERCITY Admin - Main Application
 */
import { isSuperAdmin, isManager } from './utils/user-state.js';
import { apiCall } from './services/api.js';
import './utils/ui-utils.js'; // Register global UI helpers

// Routes - Maps URL hash to view folder name
// To add a new view: 1) Add route here 2) Create views/[name]/ folder with html/js/css
const routes = {
    'dashboard': 'dashboard',
    'departures': 'departures',
    'departure-details': 'departure-details',
    'drivers': 'drivers',
    'bookings': 'bookings',
    'clients': 'clients',
    'settings': 'settings',
    // New views
    'routes': 'routes',             // Routes & Prices
    'reports': 'reports',           // Global stats and reports
    'employees': 'employees',       // Staff management (drivers, agents)
    'agencies': 'agencies',         // Branch/agency management
    'fleet': 'fleet',               // Vehicle management
    'parcels': 'parcels',           // Parcel tracking view
    'profile': 'profile',           // User profile settings
    'notifications': 'notifications', // System alerts
    'map': 'map',                   // Live Map of vehicles
    'refunds': 'refunds'            // Refund management
};

// App State
const state = {
    currentRoute: null,
    sidebarOpen: false
};

/**
 * Initialize
 */
function init() {
    // Safety Timeout for Splash Screen (5s)
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash && !splash.classList.contains('hidden')) {
            console.warn('Splash screen timeout - Forcing hide');
            splash.classList.add('hidden');
        }
    }, 5000);

    // Initial check
    if (!checkAuth()) return; // Redirects if failed

    applyRBAC(); // Keep existing call
    setupEventListeners(); // Keep existing call   
    setupUserProfile().finally(() => {
        // Hide splash screen when profile loads (or fails but handled)
        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('hidden');
    });

    initToastContainer();
    handleRoute();
}

/**
 * Fetch and Display User Profile
 */
async function setupUserProfile() {
    try {
        // console.log('Loading user profile...');
        const user = await apiCall('/auth/me');
        // console.log('User profile loaded:', user);

        const nameEl = document.getElementById('header-user-name');
        const avatarEl = document.getElementById('header-user-avatar');

        if (user) {
            if (nameEl) nameEl.textContent = user.name || 'Utilisateur'; // Use name

            const agencyEl = document.getElementById('header-user-agency');
            if (agencyEl) {
                let agencyText = user.agency_name || user.agencyName || '';
                if (user.role === 'superadmin') agencyText = 'Super Admin';
                else if (user.role === 'manager') {
                    if (user.managed_agencies && user.managed_agencies.length > 1) {
                        agencyText = `Multi-Agences (${user.managed_agencies.length})`;
                    } else if (user.managed_agencies && user.managed_agencies.length === 1) {
                        const match = user.managed_agencies.find(a => a.id === user.agency_id);
                        if (match) agencyText = match.name;
                    }
                }
                agencyEl.textContent = agencyText;
            }

            if (avatarEl) {
                const initials = (user.name || '?')
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                avatarEl.textContent = initials;

                // Optional: Color code based on role
                if (user.role === 'superadmin') avatarEl.style.backgroundColor = '#dc2626'; // Red
                else if (user.role === 'manager') avatarEl.style.backgroundColor = '#d97706'; // Amber
                else avatarEl.style.backgroundColor = '#2563eb'; // Blue
            }
        }
    } catch (e) {
        console.error('Failed to load user profile:', e);
        const nameEl = document.getElementById('header-user-name');
        if (nameEl) {
            // Show specific error to debug
            nameEl.textContent = `Err: ${e.message}`;
            nameEl.style.color = '#ef4444';
            nameEl.title = e.message; // Tooltip
        }
    }
}

/**
 * Initialize Toast Container
 */
function initToastContainer() {
    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
}

/**
 * Show Toast Notification
 * @param {string} title 
 * @param {string} message 
 * @param {string} type 'success', 'error', 'warning', 'info'
 */
window.showToast = function (title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            ${getToastIcon(type)}
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    // Auto remove after 5s
    setTimeout(() => {
        toast.style.animation = 'fadeOutRight 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
};

function getToastIcon(type) {
    const icons = {
        success: `<svg class="icon-svg" style="color:var(--success)" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
        error: `<svg class="icon-svg" style="color:var(--error)" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
        warning: `<svg class="icon-svg" style="color:var(--warning)" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        info: `<svg class="icon-svg" style="color:var(--info)" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };
    return icons[type] || icons.info;
}

/**
 * Check if user is authenticated
 */
function checkAuth() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/**
 * Apply Role-Based Access Control to Sidebar
 */
function applyRBAC() {
    // 1. Defined restricted routes (Menu Items)
    const restrictions = {
        'superadmin': [], // Can see everything
        'manager': ['agencies', 'settings'], // Can't see Agencies (global) or Settings (strict)
        'agent': ['fleet', 'drivers', 'employees', 'routes', 'reports', 'settings', 'refunds', 'agencies']
    };

    // Determine current role key
    let role = 'agent'; // Default to restrictive
    if (isSuperAdmin()) role = 'superadmin';
    else if (isManager()) role = 'manager';

    const restrictedItems = restrictions[role] || [];

    // Hide links
    document.querySelectorAll('.nav-link').forEach(link => {
        const route = link.getAttribute('data-route');
        if (route && restrictedItems.includes(route)) {
            link.style.display = 'none';
        }
    });
}


/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Route changes
    window.addEventListener('hashchange', handleRoute);

    // Mobile menu toggle
    document.getElementById('menu-toggle').addEventListener('click', toggleSidebar);

    // Close sidebar on link click (mobile)
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                closeSidebar();
            }
        });
    });

    // Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            if (await window.showConfirm('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', 'Déconnexion')) {
                localStorage.removeItem('adminToken');
                window.location.href = 'login.html';
            }
        });
    }
}

/**
 * Handle route changes
 */
async function handleRoute() {
    const hash = window.location.hash.slice(2) || 'dashboard';
    const [routeName, ...params] = hash.split('/');

    const viewName = routes[routeName];
    if (!viewName) {
        window.location.hash = '#/dashboard';
        return;
    }

    state.currentRoute = routeName;
    updateActiveNav(routeName);
    await loadView(viewName, params);
}

/**
 * Load view dynamically
 */
async function loadView(viewName, params = []) {
    const mainContent = document.getElementById('main-content');

    try {
        // Load HTML
        const response = await fetch(`views/${viewName}/${viewName}.html?v=${Date.now()}`);
        if (!response.ok) throw new Error('View not found');
        const html = await response.text();
        mainContent.innerHTML = html;

        // Load CSS
        loadViewCSS(viewName);

        // Load JS
        const module = await import(`/views/${viewName}/${viewName}.js?v=${Date.now()}`);
        if (module.init) {
            module.init(params);
        }
    } catch (error) {
        console.error(`Error loading view ${viewName}:`, error);
        mainContent.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <h2 style="color: var(--text-muted);">Vue non disponible</h2>
                <p style="color: var(--text-light);">${viewName}</p>
            </div>
        `;
    }
}

/**
 * Load view CSS
 */
function loadViewCSS(viewName) {
    const existing = document.querySelector(`link[data-view="${viewName}"]`);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `views/${viewName}/${viewName}.css?v=${Date.now()}`;
    link.dataset.view = viewName;
    document.head.appendChild(link);
}

/**
 * Update active nav
 */
function updateActiveNav(routeName) {
    document.querySelectorAll('.nav-link').forEach(link => {
        const route = link.dataset.route;
        link.classList.toggle('active', route === routeName);
    });
}

/**
 * Toggle sidebar (mobile)
 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
    state.sidebarOpen = !state.sidebarOpen;
}

/**
 * Close sidebar
 */
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    state.sidebarOpen = false;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
