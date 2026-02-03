/**
 * Fleet Management View
 */

import { getVehicles, createVehicle, updateVehicle, deleteVehicle } from '../../js/services/api.js';
import { createAgencySelector } from '../../js/utils/agency-selector.js';
import { isSuperAdmin, isManager, getDefaultAgencyId } from '../../js/utils/user-state.js';
import { Cache } from '../../js/services/cache.js';

let allVehicles = [];
let currentFilter = 'all';
let selectedAgencyId = null;

export async function init() {
    await setupAgencySelector();
    loadVehicles(); // SWR
    setupFilters();
    setupActions();
}

async function setupAgencySelector() {
    const headerActions = document.querySelector('.page-header .header-actions');
    if (headerActions && (isSuperAdmin() || isManager())) {
        const selectorContainer = document.createElement('div');
        selectorContainer.className = 'agency-filter-container';
        headerActions.insertBefore(selectorContainer, headerActions.firstChild);

        await createAgencySelector(selectorContainer, (agencyId) => {
            selectedAgencyId = agencyId;
            loadVehicles();
        });

        selectedAgencyId = getDefaultAgencyId();
    }
}

async function loadVehicles() {
    const filters = {};
    if (selectedAgencyId) {
        filters.agencyId = selectedAgencyId;
    }

    const cacheKey = `vehicles_${JSON.stringify(filters)}`;

    Cache.swr(cacheKey, () => getVehicles(filters), (data) => {
        allVehicles = data || [];
        renderStats();
        renderTable();
    });
}

function renderStats() {
    const total = allVehicles.length;
    const active = allVehicles.filter(v => v.status === 'active').length;
    const maintenance = allVehicles.filter(v => v.status === 'maintenance').length;

    setText('stat-total-vehicles', total);
    setText('stat-active-vehicles', active);
    setText('stat-maintenance-vehicles', maintenance);
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
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

    const searchInput = document.getElementById('search-vehicle');
    if (searchInput) {
        searchInput.addEventListener('input', renderTable);
    }
}

function setupActions() {
    const btnAdd = document.getElementById('btn-add-vehicle');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => openVehicleModal());
    }

    const btnSave = document.getElementById('btn-save-vehicle');
    if (btnSave) {
        btnSave.addEventListener('click', saveVehicleHandler);
    }

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) modal.classList.remove('active');
        });
    });
}

function renderTable() {
    const tbody = document.getElementById('vehicles-table');
    if (!tbody) return;

    let filtered = allVehicles;

    if (currentFilter !== 'all') {
        filtered = filtered.filter(v => v.status === currentFilter);
    }

    const searchTerm = document.getElementById('search-vehicle')?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(v =>
            v.plate.toLowerCase().includes(searchTerm) ||
            v.model.toLowerCase().includes(searchTerm)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    Aucun véhicule trouvé
                </td>
            </tr>
        `;
        return;
    }

    // ICONS (3D PNGs)
    const ICONS = {
        bus: '<img src="images/vehicles/bus.png" style="width:30px;height:30px;object-fit:contain;">',
        minibus: '<img src="images/vehicles/minibus.png" style="width:28px;height:28px;object-fit:contain;">',
        van: '<img src="images/vehicles/van.png" style="width:26px;height:26px;object-fit:contain;">'
    };

    function getIconSVG(cat) {
        const t = (cat || '').toLowerCase();
        if (t.includes('van') || t.includes('hiace')) return ICONS.van;
        if (t.includes('mini') || t.includes('coaster')) return ICONS.minibus;
        return ICONS.bus;
    }

    tbody.innerHTML = filtered.map(v => `
        <tr>
            <td title="Category: ${v.category}"><div style="display:flex;align-items:center;justify-content:center">${getIconSVG(v.category)}</div></td>
            <td>
                <div class="vehicle-info">${v.plate}</div>
                <div class="vehicle-sub">${v.model}</div>
            </td>
            <td><span class="badge info">${v.type}</span></td>
            <td>${v.capacity} pl.</td>
            <td>${new Intl.NumberFormat('fr-FR').format(v.mileage || 0)} km</td>
            <td>${renderStatus(v.status)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn" onclick="window.editVehicle('${v.id}')" title="Modifier">
                        <svg class="icon-svg" style="width:16px;height:16px" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="action-btn danger" onclick="window.deleteVehicleHandler('${v.id}')" title="Supprimer">
                        <svg class="icon-svg" style="width:16px;height:16px" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2 2H7V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderStatus(status) {
    if (status === 'active') return '<span class="badge success">Actif</span>';
    if (status === 'maintenance') return '<span class="badge warning">Maintenance</span>';
    return '<span class="badge error">Inactif</span>';
}

// ============================================================================
// MODAL LOGIC
// ============================================================================

function openVehicleModal(vehicleId = null) {
    const modal = document.getElementById('modal-vehicle');
    const title = document.getElementById('modal-vehicle-title');

    // Reset
    document.getElementById('vehicle-id').value = '';
    document.getElementById('vehicle-plate').value = '';
    document.getElementById('vehicle-model').value = '';
    document.getElementById('vehicle-type').value = 'Standard';
    document.getElementById('vehicle-category').value = 'bus'; // Default Icon
    document.getElementById('vehicle-capacity').value = '';
    document.getElementById('vehicle-mileage').value = '';
    document.getElementById('vehicle-status').value = 'active';

    if (vehicleId) {
        const v = allVehicles.find(veh => veh.id === vehicleId);
        if (v) {
            title.textContent = 'Modifier Véhicule';
            document.getElementById('vehicle-id').value = v.id;
            document.getElementById('vehicle-plate').value = v.plate;
            document.getElementById('vehicle-model').value = v.model;
            document.getElementById('vehicle-type').value = v.type;
            document.getElementById('vehicle-category').value = v.category || 'bus'; // Load Category
            document.getElementById('vehicle-capacity').value = v.capacity;
            document.getElementById('vehicle-mileage').value = v.mileage;
            document.getElementById('vehicle-status').value = v.status;
        }
    } else {
        title.textContent = 'Nouveau Véhicule';
    }

    modal.classList.add('active');
}

async function saveVehicleHandler() {
    const data = {
        plate: document.getElementById('vehicle-plate').value,
        model: document.getElementById('vehicle-model').value,
        type: document.getElementById('vehicle-type').value,
        category: document.getElementById('vehicle-category').value, // Save Category
        capacity: parseInt(document.getElementById('vehicle-capacity').value) || 0,
        mileage: parseInt(document.getElementById('vehicle-mileage').value) || 0,
        status: document.getElementById('vehicle-status').value
    };

    if (!data.plate || !data.model || !data.capacity) {
        window.showAlert('Erreur', 'Veuillez remplir les champs obligatoires (*)', 'error');
        return;
    }

    const id = document.getElementById('vehicle-id').value;

    const btnSave = document.getElementById('btn-save-vehicle');

    try {
        window.setBtnLoading(btnSave, true);
        if (id) {
            await updateVehicle(id, data);
            window.showAlert('Succès', 'Véhicule mis à jour', 'success');
        } else {
            await createVehicle(data);
            window.showAlert('Succès', 'Nouveau véhicule créé', 'success');
        }
        await loadVehicles();
        document.getElementById('modal-vehicle').classList.remove('active');
    } catch (error) {
        console.error(error);
        window.showAlert('Erreur', 'Opération échouée', 'error');
    } finally {
        window.setBtnLoading(btnSave, false);
    }
}

// Global functions
window.editVehicle = (id) => openVehicleModal(id);
window.deleteVehicleHandler = async (id) => {
    const v = allVehicles.find(veh => veh.id === id);
    if (v) {
        const confirm = await window.showConfirm('Confirmation', `Supprimer le véhicule ${v.plate} ?`);
        if (confirm) {
            await deleteVehicle(id);
            await loadVehicles();
            window.showAlert('Supprimé', 'Véhicule supprimé du parc.');
        }
    }
};
