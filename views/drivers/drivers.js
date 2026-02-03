/**
 * Drivers View
 */

import { getDrivers, createDriver, updateDriver, deleteDriver } from '../../js/services/api.js';
import { createAgencySelector } from '../../js/utils/agency-selector.js';
import { isSuperAdmin, isManager, getDefaultAgencyId } from '../../js/utils/user-state.js';
import { exportToExcel, exportToPDF } from '../../js/utils/export-utils.js';
import { Cache } from '../../js/services/cache.js';

let allDrivers = [];
let currentFilter = 'all';
let selectedAgencyId = null;

export async function init() {
    await setupAgencySelector();
    loadDrivers(); // SWR
    setupFilters();
    setupActions();
    setupExports();
}

// ... setupExports ...

async function setupAgencySelector() {
    const headerActions = document.querySelector('.page-header .header-actions');
    if (headerActions && (isSuperAdmin() || isManager())) {
        const selectorContainer = document.createElement('div');
        selectorContainer.className = 'agency-filter-container';
        headerActions.insertBefore(selectorContainer, headerActions.firstChild);

        await createAgencySelector(selectorContainer, (agencyId) => {
            selectedAgencyId = agencyId;
            loadDrivers();
        });

        selectedAgencyId = getDefaultAgencyId();
    }
}

async function loadDrivers() {
    const filters = {};
    if (selectedAgencyId) {
        filters.agencyId = selectedAgencyId;
    }

    const cacheKey = `drivers_${JSON.stringify(filters)}`;

    Cache.swr(cacheKey, () => getDrivers(filters), (data) => {
        allDrivers = data || [];
        renderTable();
    });
}


function setupFilters() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderTable();
        });
    });

    const searchInput = document.getElementById('search-driver');
    if (searchInput) {
        searchInput.addEventListener('input', renderTable);
    }
}

function setupActions() {
    // Add button
    const btnAdd = document.getElementById('btn-add-driver');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => openDriverModal());
    }

    // Save button
    const btnSave = document.getElementById('btn-save-driver');
    if (btnSave) {
        btnSave.addEventListener('click', saveDriver);
    }

    // Modal close
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) modal.classList.remove('active');
        });
    });
}

function renderTable() {
    const tbody = document.getElementById('drivers-table');
    if (!tbody) return;

    let filtered = allDrivers;

    // Filter by status
    if (currentFilter !== 'all') {
        filtered = filtered.filter(d => d.status === currentFilter);
    }

    // Filter by search
    const searchTerm = document.getElementById('search-driver')?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(d =>
            d.name.toLowerCase().includes(searchTerm) ||
            d.phone.includes(searchTerm)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    Aucun chauffeur trouvé
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(d => `
        <tr>
            <td>
                <div class="driver-cell">
                    <div class="avatar">${getInitials(d.name)}</div>
                    <div style="display:flex; flex-direction:column">
                        <span class="name">${d.name}</span>
                        <span class="text-xs text-muted">Permis: ${d.license || 'N/A'}</span>
                    </div>
                </div>
            </td>
            <td>${d.phone}</td>
            <td>
                <div class="rating-cell">
                    <svg viewBox="0 0 24 24">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    ${d.rating} <span style="font-size:0.8em; color:#888; font-weight:normal;">(${d.ratingCount || 0})</span>
                </div>
            </td>
            <td>${d.trips}</td>
            <td><span class="badge ${getStatusClass(d.status)}">${getStatusLabel(d.status)}</span></td>
            <td>
                <div class="action-btns">
                    <button class="action-btn edit" onclick="window.editDriver('${d.id}')" title="Modifier">
                        <svg class="icon-svg" viewBox="0 0 24 24">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="action-btn danger" onclick="window.deleteDriver('${d.id}')" title="Supprimer">
                        <svg class="icon-svg" viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ============================================================================
// MODAL LOGIC
// ============================================================================

function openDriverModal(driverId = null) {
    const modal = document.getElementById('modal-driver');
    const title = document.getElementById('modal-driver-title');

    // Reset
    document.getElementById('driver-id').value = '';
    document.getElementById('driver-name').value = '';
    document.getElementById('driver-phone').value = '';
    document.getElementById('driver-license').value = '';
    document.getElementById('driver-status').value = 'available';
    document.getElementById('driver-exp').value = '2';

    if (driverId) {
        const d = allDrivers.find(drv => drv.id === driverId);
        if (d) {
            title.textContent = 'Modifier Chauffeur';
            document.getElementById('driver-id').value = d.id;
            document.getElementById('driver-name').value = d.name;
            document.getElementById('driver-phone').value = d.phone;
            document.getElementById('driver-license').value = d.license || '';
            document.getElementById('driver-status').value = d.status;
        }
    } else {
        title.textContent = 'Nouveau Chauffeur';
    }

    modal.classList.add('active');
}

async function saveDriver() {
    const data = {
        name: document.getElementById('driver-name').value,
        phone: document.getElementById('driver-phone').value,
        license: document.getElementById('driver-license').value,
        status: document.getElementById('driver-status').value, // 'available' or 'offline' mostly
        rating: 5.0, // Default
        trips: 0
    };

    if (!data.name || !data.phone) {
        window.showAlert('Erreur', 'Nom et téléphone obligatoires', 'error');
        return;
    }

    const id = document.getElementById('driver-id').value;

    const btnSave = document.getElementById('btn-save-driver');

    try {
        window.setBtnLoading(btnSave, true);
        if (id) {
            await updateDriver(id, data);
            window.showAlert('Succès', 'Chauffeur mis à jour', 'success');
        } else {
            await createDriver(data);
            window.showAlert('Succès', 'Nouveau chauffeur créé', 'success');
        }

        await loadDrivers();
        document.getElementById('modal-driver').classList.remove('active');
    } catch (error) {
        console.error(error);
        window.showAlert('Erreur', 'Impossible d\'enregistrer le chauffeur', 'error');
    } finally {
        window.setBtnLoading(btnSave, false);
    }
}

// Global functions
window.editDriver = (id) => openDriverModal(id);
window.deleteDriver = async (id) => {
    const d = allDrivers.find(drv => drv.id === id);
    if (d) {
        const confirm = await window.showConfirm('Confirmation', `Supprimer le chauffeur ${d.name} ?`);
        if (confirm) {
            try {
                await deleteDriver(id);
                await loadDrivers();
                window.showAlert('Supprimé', 'Chauffeur supprimé avec succès.');
            } catch (error) {
                console.error(error);
                window.showAlert('Erreur', 'Impossible de supprimer', 'error');
            }
        }
    }
};

// ============================================================================
// HELPERS
// ============================================================================

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function getStatusClass(status) {
    const classes = { 'on_trip': 'warning', 'available': 'success', 'offline': 'error' };
    return classes[status] || 'info';
}

function getStatusLabel(status) {
    const labels = { 'on_trip': 'En course', 'available': 'Disponible', 'offline': 'Hors ligne' };
    return labels[status] || status;
}
