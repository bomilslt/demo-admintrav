/**
 * AGENCIES VIEW - Branch Management
 * ==================================
 */

import { getAgencies, createAgency, updateAgency, deleteAgency } from '../../js/services/api.js';
import { Cache } from '../../js/services/cache.js';

let allAgencies = [];

// ============================================================================
// INITIALIZATION
// ============================================================================

export function init() {
    setupEventListeners();
    loadAgencies(); // SWR
}

function setupEventListeners() {
    // Add agency button
    const btnAdd = document.getElementById('btn-add-agency');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => openAgencyModal());
    }

    // Save agency
    const btnSave = document.getElementById('btn-save-agency');
    if (btnSave) {
        btnSave.addEventListener('click', saveAgencyHandler);
    }

    // Close modals
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) modal.classList.remove('active');
        });
    });
}

// ============================================================================
// DATA LOADING
// ============================================================================

function loadAgencies() {
    Cache.swr('all_agencies', getAgencies, (data) => {
        allAgencies = data || [];
        renderStats();
        renderGrid();
    });
}

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

function renderStats() {
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    const activeAgencies = allAgencies.filter(a => a.status === 'active');
    const totalStaff = allAgencies.reduce((sum, a) => sum + (a.stats?.staff || 0), 0);

    setText('stat-total-agencies', allAgencies.length);
    setText('stat-active-agencies', activeAgencies.length);
    setText('stat-total-staff', totalStaff);
}

function renderGrid() {
    const grid = document.getElementById('agencies-grid');
    if (!grid) return;

    if (allAgencies.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Aucune agence trouvée.</div>`;
        return;
    }

    grid.innerHTML = allAgencies.map(agency => `
        <div class="agency-card">
            <div class="agency-header">
                <div class="agency-icon">
                    <svg class="icon-svg" style="width:24px;height:24px" viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l8-4 8 4v14M8 21v-4h8v4"></path></svg>
                </div>
                <span class="agency-status ${agency.status}">${agency.status === 'active' ? 'Active' : 'Inactive'}</span>
            </div>
            
            <div class="agency-name">${agency.name}</div>
            <div class="agency-location">
                <svg class="icon-svg" style="width:14px;height:14px" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                ${agency.city}, ${agency.district}
            </div>
            
            <div class="agency-details">
                <div class="agency-detail">
                    <svg class="icon-svg" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    ${agency.phone || 'Non renseigné'}
                </div>
                <div class="agency-detail">
                    <svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    ${agency.hours || 'Non renseigné'}
                </div>
                <div class="agency-detail">
                    <svg class="icon-svg" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    ${agency.manager || 'Aucun manager'}
                </div>
            </div>
            
            <div class="agency-stats-mini">
                <div class="agency-stat">
                    <span class="agency-stat-value">${agency.stats?.staff || 0}</span>
                    <span class="agency-stat-label">Équipe</span>
                </div>
                <div class="agency-stat">
                    <span class="agency-stat-value">${formatCompact(agency.stats?.revenue || 0)}</span>
                    <span class="agency-stat-label">Rev.</span>
                </div>
            </div>
            
            <div class="agency-actions">
                <button onclick="window.editAgency('${agency.id}')">
                    <svg class="icon-svg" style="width:14px;height:14px" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Modifier
                </button>
                <button class="danger" onclick="window.deleteAgencyHandler('${agency.id}')">
                    <svg class="icon-svg" style="width:14px;height:14px" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Supprimer
                </button>
            </div>
        </div>
    `).join('');
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

function openAgencyModal(agencyId = null) {
    const modal = document.getElementById('modal-agency');
    const title = document.getElementById('modal-agency-title');

    // Reset form
    ['agency-id', 'agency-name', 'agency-city', 'agency-district',
        'agency-address', 'agency-phone', 'agency-hours', 'agency-lat', 'agency-lng'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    document.getElementById('agency-status').value = 'active';

    if (agencyId) {
        const agency = allAgencies.find(a => a.id === agencyId);
        if (agency) {
            title.textContent = 'Modifier Agence';
            document.getElementById('agency-id').value = agency.id;
            document.getElementById('agency-name').value = agency.name;
            document.getElementById('agency-city').value = agency.city;
            document.getElementById('agency-district').value = agency.district;
            document.getElementById('agency-address').value = agency.address || '';
            document.getElementById('agency-phone').value = agency.phone || '';
            document.getElementById('agency-hours').value = agency.hours || '';
            document.getElementById('agency-lat').value = agency.lat || '';
            document.getElementById('agency-lng').value = agency.lng || '';
            document.getElementById('agency-status').value = agency.status;
        }
    } else {
        title.textContent = 'Nouvelle Agence';
    }

    modal.classList.add('active');
}

async function saveAgencyHandler() {
    const data = {
        name: document.getElementById('agency-name').value,
        city: document.getElementById('agency-city').value,
        district: document.getElementById('agency-district').value,
        address: document.getElementById('agency-address').value,
        phone: document.getElementById('agency-phone').value,
        hours: document.getElementById('agency-hours').value,
        lat: document.getElementById('agency-lat').value,
        lng: document.getElementById('agency-lng').value,
        status: document.getElementById('agency-status').value,
        manager: null // Placeholder
    };

    if (!data.name || !data.city || !data.district) {
        window.showToast('Erreur', 'Veuillez remplir tous les champs obligatoires (*)', 'warning');
        return;
    }

    const id = document.getElementById('agency-id').value;

    const btnSave = document.getElementById('btn-save-agency');

    try {
        window.setBtnLoading(btnSave, true);
        if (id) {
            await updateAgency(id, data);
            window.showToast('Succès', 'Agence mise à jour avec succès !', 'success');
        } else {
            await createAgency(data);
            window.showToast('Succès', 'Nouvelle agence créée !', 'success');
        }

        loadAgencies(); // Reload with SWR
        document.getElementById('modal-agency').classList.remove('active');
    } catch (error) {
        console.error(error);
        window.showToast('Erreur', error.message || 'Une erreur est survenue lors de l\'enregistrement', 'error');
    } finally {
        window.setBtnLoading(btnSave, false);
    }
}

// Global functions
window.editAgency = (id) => openAgencyModal(id);
window.deleteAgencyHandler = async (id) => {
    const agency = allAgencies.find(a => a.id === id);
    if (agency) {
        const confirmed = await window.showConfirm('Confirmation', `Supprimer l'agence ${agency.name} ?`);
        if (confirmed) {
            try {
                await deleteAgency(id);
                loadAgencies(); // Reload with SWR
                window.showToast('Supprimé', 'L\'agence a été supprimée.', 'success');
            } catch (error) {
                console.error("Delete Error", error);
                window.showToast('Erreur', error.message || 'Impossible de supprimer cette agence.', 'error');
            }
        }
    }
};

// ============================================================================
// HELPERS
// ============================================================================

function formatCompact(amount) {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
    if (amount >= 1000) return (amount / 1000).toFixed(0) + 'K';
    return amount.toString();
}
