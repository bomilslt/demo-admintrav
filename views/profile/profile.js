/**
 * PROFILE VIEW - User Settings
 * =============================
 * 
 * User profile settings and preferences.
 * 
 * API INTEGRATION GUIDE:
 * ----------------------
 * In api.js, add these functions:
 * 
 * - getCurrentUser()
 *   GET /admin/me
 *   Returns: { id, name, email, phone, role, avatar, preferences }
 * 
 * - updateProfile(data)
 *   PUT /admin/me
 *   Body: { name, email, phone, language }
 * 
 * - changePassword(currentPwd, newPwd)
 *   POST /admin/me/password
 *   Body: { currentPassword, newPassword }
 * 
 * - updateNotificationSettings(settings)
 *   PUT /admin/me/notifications
 *   Body: { email: true, critical: true, daily: false }
 */

let currentUser = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

export async function init() {
    await loadProfile();
    setupEventListeners();
}

function setupEventListeners() {
    // Save profile
    const btnSaveProfile = document.getElementById('btn-save-profile');
    if (btnSaveProfile) {
        btnSaveProfile.addEventListener('click', saveProfile);
    }

    // Change password
    const btnChangePassword = document.getElementById('btn-change-password');
    if (btnChangePassword) {
        btnChangePassword.addEventListener('click', changePassword);
    }

    // Notification toggles
    ['notif-email', 'notif-critical', 'notif-daily'].forEach(id => {
        const toggle = document.getElementById(id);
        if (toggle) {
            toggle.addEventListener('change', saveNotificationSettings);
        }
    });
}

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Load current user profile
 * In production: Replace with api.getCurrentUser()
 */
async function loadProfile() {
    // MOCK DATA - Replace with: currentUser = await api.getCurrentUser();
    currentUser = getMockUser();
    renderProfile();
}

/**
 * Mock user data
 */
function getMockUser() {
    return {
        id: 'admin-001',
        name: 'Admin User',
        email: 'admin@intercity.cm',
        phone: '+237 699 00 00 00',
        role: 'admin',
        language: 'fr',
        notifications: {
            email: true,
            critical: true,
            daily: false
        }
    };
}

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

function renderProfile() {
    if (!currentUser) return;

    // Avatar initials
    const avatar = document.getElementById('profile-avatar');
    if (avatar) {
        avatar.textContent = getInitials(currentUser.name);
    }

    // Profile info
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setText('profile-name', currentUser.name);
    setText('profile-email', currentUser.email);

    // Form fields
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setVal('setting-name', currentUser.name);
    setVal('setting-email', currentUser.email);
    setVal('setting-phone', currentUser.phone);
    setVal('setting-language', currentUser.language);

    // Notification toggles
    const setChecked = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = val;
    };

    setChecked('notif-email', currentUser.notifications?.email);
    setChecked('notif-critical', currentUser.notifications?.critical);
    setChecked('notif-daily', currentUser.notifications?.daily);
}

// ============================================================================
// ACTIONS
// ============================================================================

async function saveProfile() {
    const data = {
        name: document.getElementById('setting-name')?.value,
        email: document.getElementById('setting-email')?.value,
        phone: document.getElementById('setting-phone')?.value,
        language: document.getElementById('setting-language')?.value
    };

    if (!data.name || !data.email) {
        await window.showAlert('Erreur', 'Nom et email sont obligatoires', 'error');
        return;
    }

    // In production: await api.updateProfile(data)

    // Update local state
    currentUser = { ...currentUser, ...data };
    renderProfile();

    await window.showAlert('Succès', 'Profil mis à jour !', 'success');
}

async function changePassword() {
    const currentPwd = document.getElementById('current-password')?.value;
    const newPwd = document.getElementById('new-password')?.value;
    const confirmPwd = document.getElementById('confirm-password')?.value;

    if (!currentPwd || !newPwd || !confirmPwd) {
        await window.showAlert('Erreur', 'Veuillez remplir tous les champs', 'warning');
        return;
    }

    if (newPwd !== confirmPwd) {
        await window.showAlert('Erreur', 'Les mots de passe ne correspondent pas', 'error');
        return;
    }

    if (newPwd.length < 6) {
        await window.showAlert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères', 'warning');
        return;
    }

    // In production: await api.changePassword(currentPwd, newPwd)

    // Clear fields
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';

    await window.showAlert('Succès', 'Mot de passe changé avec succès !', 'success');
}

async function saveNotificationSettings() {
    const settings = {
        email: document.getElementById('notif-email')?.checked || false,
        critical: document.getElementById('notif-critical')?.checked || false,
        daily: document.getElementById('notif-daily')?.checked || false
    };

    // In production: await api.updateNotificationSettings(settings)

    currentUser.notifications = settings;
    console.log('Notification settings saved:', settings);
}

// ============================================================================
// HELPERS
// ============================================================================

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
