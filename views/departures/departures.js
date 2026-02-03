/**
 * Departures View
 * Enhanced with Pagination and Advanced Filters
 */

import { getDepartures, createDeparture, updateDeparture, deleteDeparture, getDrivers, getVehicles, getRoutes } from '../../js/services/api.js';
import { DatePicker } from '../../js/components/date-picker.js';
import { Cache } from '../../js/services/cache.js';

let allDepartures = [];
let allDrivers = [];
let allVehicles = [];
let allRoutes = [];
let currentFilter = 'all';
let dateFromPicker = null;
let dateToPicker = null;

// Pagination
let currentPage = 1;
let totalPages = 1;
const LIMIT = 20;

import { isSuperAdmin, isManager } from '../../js/utils/user-state.js';

export function init() {

    // RBAC: Hide Add Button
    if (!isSuperAdmin() && !isManager()) {
        const btnAdd = document.getElementById('btn-new-departure');
        if (btnAdd) btnAdd.style.display = 'none';

        // Hide delete selected if exists
        const btnDel = document.getElementById('btn-delete-selected');
        if (btnDel) btnDel.style.display = 'none';
    }

    // Parallel SWR
    // Resources (Drivers, Vehicles, Routes) - rarely change, good for cache
    Cache.swr('all_drivers', getDrivers, (data) => { allDrivers = data; populateSelects(); });
    Cache.swr('all_vehicles', getVehicles, (data) => { allVehicles = data; populateSelects(); });
    Cache.swr('all_routes', getRoutes, (data) => { allRoutes = data; populateSelects(); });

    // Initial Departures Load (Default filters)
    loadDepartures();

    setupFilters();
    setupPagination();
    setupActions();
    setupDynamicLogic();
}

function loadDepartures() {
    const tbody = document.getElementById('departures-table');
    // Only show loading if we really have no data and no cache will hit?
    // With SWR, we trust the callback to come eventually.
    // We can show a discreet loading indicator if needed, but avoiding table replacement is key.

    let filters = { page: currentPage, limit: LIMIT };

    if (currentFilter !== 'all') {
        filters.status = currentFilter;
    }

    // Advanced Filters
    if (dateFromPicker) {
        const val = dateFromPicker.getValue();
        if (val) filters.startDate = val;
    }
    if (dateToPicker) {
        const val = dateToPicker.getValue();
        if (val) filters.endDate = val;
    }

    // Cache key based on filters to enable " Back" button caching
    const cacheKey = `departures_${JSON.stringify(filters)}`;

    Cache.swr(cacheKey, () => getDepartures(filters), (response) => {
        if (response.data && response.meta) {
            allDepartures = response.data;
            currentPage = response.meta.page;
            totalPages = response.meta.last_page;
        } else if (Array.isArray(response)) {
            // Fallback for non-paginated API or mock
            allDepartures = response;
            currentPage = 1;
            totalPages = 1;
        } else {
            allDepartures = [];
        }

        renderTable();
        updatePaginationUI();
    });
}

// loadResources is now split in init() via SWR calls
// function loadResources() { ... } deleted

function populateSelects() {
    // Populate Drivers
    const driverSelect = document.getElementById('dep-driver');
    if (driverSelect && allDrivers.length) {
        fillSelect(driverSelect, allDrivers, d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.name;
            opt.dataset.preferredVehicle = d.preferredVehicleId || '';
            return opt;
        });
    }

    // Populate Vehicles
    const vehicleSelect = document.getElementById('dep-vehicle');
    if (vehicleSelect && allVehicles.length) {
        fillSelect(vehicleSelect, allVehicles, v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `${v.type} - ${v.plate} (${v.capacity || '?'} pl.)`;
            opt.dataset.plate = v.plate;
            opt.dataset.type = v.type;
            opt.dataset.capacity = v.capacity || 30; // Default fallback
            return opt;
        });
    }

    // Populate Routes
    const routeSelect = document.getElementById('dep-route');
    if (routeSelect) {
        fillSelect(routeSelect, allRoutes, r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = `${r.origin} ➝ ${r.destination}`;
            opt.dataset.origin = r.origin;
            opt.dataset.destination = r.destination;
            opt.dataset.price = r.pricePax;
            return opt;
        });
    }
}

function fillSelect(select, data, createOptionFn) {
    const defaultOpt = select.querySelector('option[value=""]');
    select.innerHTML = '';
    if (defaultOpt) select.appendChild(defaultOpt);
    data.forEach(item => {
        select.appendChild(createOptionFn(item));
    });
}

function setupDynamicLogic() {
    const driverSelect = document.getElementById('dep-driver');
    const vehicleSelect = document.getElementById('dep-vehicle');
    const routeSelect = document.getElementById('dep-route');

    // Auto-select vehicle based on driver preference
    if (driverSelect && vehicleSelect) {
        driverSelect.addEventListener('change', () => {
            const selectedOption = driverSelect.options[driverSelect.selectedIndex];
            const preferredId = selectedOption.dataset.preferredVehicle;
            if (preferredId && vehicleSelect.querySelector(`option[value="${preferredId}"]`)) {
                vehicleSelect.value = preferredId;
            }
        });
    }

    // Auto-fill details based on Route selection
    if (routeSelect) {
        routeSelect.addEventListener('change', () => {
            const selectedOption = routeSelect.options[routeSelect.selectedIndex];
            if (selectedOption.value) {
                document.getElementById('dep-origin').value = selectedOption.dataset.origin;
                document.getElementById('dep-destination').value = selectedOption.dataset.destination;
                document.getElementById('dep-price').value = selectedOption.dataset.price || 0;
            }
        });
    }
}

function setupFilters() {
    // Status Tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            currentPage = 1;
            loadDepartures();
        });
    });

    // Date Pickers
    dateFromPicker = new DatePicker({
        container: '#date-from-container',
        placeholder: 'Début',
        allowClear: true,
        onChange: () => { currentPage = 1; loadDepartures(); }
    });

    dateToPicker = new DatePicker({
        container: '#date-to-container',
        placeholder: 'Fin',
        allowClear: true,
        onChange: () => { currentPage = 1; loadDepartures(); }
    });

    // Reset
    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            dateFromPicker.clear();
            dateToPicker.clear();
            currentFilter = 'all';
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('[data-filter="all"]').forEach(t => t.classList.add('active'));
            currentPage = 1;
            loadDepartures();
        });
    }
}

function setupPagination() {
    const card = document.querySelector('.card');
    if (!document.getElementById('pagination-controls')) {
        const div = document.createElement('div');
        div.id = 'pagination-controls';
        div.style.cssText = 'display: flex; justify-content: flex-end; align-items: center; padding: 16px; border-top: 1px solid var(--border); gap: 12px;';
        div.innerHTML = `
            <span id="page-info" style="font-size: 0.9rem; color: var(--text-muted);">Page 1 sur 1</span>
            <div style="display: flex; gap: 8px;">
                <button id="prev-btn" class="btn btn-secondary" style="padding: 0 12px;">&lt;</button>
                <button id="next-btn" class="btn btn-secondary" style="padding: 0 12px;">&gt;</button>
            </div>
        `;
        card.appendChild(div);

        document.getElementById('prev-btn').onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                loadDepartures();
            }
        };
        document.getElementById('next-btn').onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadDepartures();
            }
        };
    }
}

function updatePaginationUI() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');

    if (prevBtn && nextBtn && pageInfo) {
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
        pageInfo.textContent = `Page ${currentPage} sur ${totalPages || 1}`;
    }
}

function setupActions() {
    const btnAdd = document.getElementById('btn-add-departure');
    if (btnAdd) btnAdd.addEventListener('click', () => openDepartureModal());

    const btnSave = document.getElementById('btn-save-departure');
    if (btnSave) btnSave.addEventListener('click', saveDepartureHandler);

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) modal.classList.remove('active');
        });
    });
}

function renderTable() {
    const tbody = document.getElementById('departures-table');
    if (!tbody) return;

    if (allDepartures.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">Aucun départ trouvé</td></tr>`;
        return;
    }

    tbody.innerHTML = allDepartures.map(d => {
        const capacity = d.vehicleCapacity || d.totalSeats || 0;
        const seatsPercent = capacity ? (d.bookedSeats / capacity) * 100 : 0;
        const seatsClass = seatsPercent >= 100 ? 'full' : seatsPercent < 50 ? 'low' : '';

        return `
            <tr>
                <td>
                    <div class="route-cell">
                        ${d.origin}
                        <svg class="icon-svg" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        ${d.destination}
                    </div>
                </td>
                <td>${formatDate(d.date)}</td>
                <td>${d.departureTime}</td>
                <td>${d.driverName || 'Non assigné'}</td>
                <td>${d.vehicleType || 'Bus'} - <span class="text-xs text-muted">${d.vehiclePlate || 'N/A'}</span></td>
                <td>
                    <div class="seats-progress">
                        <div class="seats-bar">
                            <div class="seats-fill ${seatsClass}" style="width: ${Math.min(seatsPercent, 100)}%"></div>
                        </div>
                        <span>${d.bookedSeats}/${capacity}</span>
                    </div>
                </td>
                <td><span class="badge ${getStatusClass(d.status)}">${getStatusLabel(d.status)}</span></td>
                <td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn view" onclick="window.location.hash='#/departure-details/${d.id}'" title="Détails">
                            <svg class="icon-svg" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        ${(isSuperAdmin() || isManager()) ? `
                        <button class="action-btn edit" onclick="window.editDeparture('${d.id}')" title="Modifier">
                            <svg class="icon-svg" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        ${d.status === 'pending' ? `
                        <button class="action-btn delete" onclick="window.deleteDeparture('${d.id}')" title="Supprimer">
                            <svg class="icon-svg" viewBox="0 0 24 24" style="color:var(--error)"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>` : ''}
                        ` : ''}
                    </div>
                </td>
                </td>
            </tr>
        `;
    }).join('');
}

function openDepartureModal(departureId = null) {
    const modal = document.getElementById('modal-departure');
    const title = document.getElementById('modal-departure-title');

    // Reset form
    document.getElementById('departure-id').value = '';
    document.getElementById('dep-route').value = '';
    document.getElementById('dep-origin').value = '';
    document.getElementById('dep-destination').value = '';
    document.getElementById('dep-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('dep-time').value = '08:00';
    document.getElementById('dep-driver').value = '';
    document.getElementById('dep-vehicle').value = '';
    document.getElementById('dep-price').value = '';

    if (departureId) {
        // Since allDepartures is paginated, we might not have the item if not on current page.
        // Ideally fetch detailed by ID if not found, but for now check list
        let dep = allDepartures.find(d => d.id === departureId);

        if (dep) {
            title.textContent = 'Modifier Départ';
            document.getElementById('departure-id').value = dep.id;

            // ... (fill logic same as before, assuming fields match)
            if (dep.routeId) {
                document.getElementById('dep-route').value = dep.routeId;
            } else {
                const matchingRoute = allRoutes.find(r => r.origin === dep.origin && r.destination === dep.destination);
                if (matchingRoute) document.getElementById('dep-route').value = matchingRoute.id;
            }

            document.getElementById('dep-origin').value = dep.origin;
            document.getElementById('dep-destination').value = dep.destination;
            document.getElementById('dep-date').value = dep.date.split('T')[0];
            document.getElementById('dep-time').value = dep.departureTime;
            document.getElementById('dep-price').value = dep.price;

            if (dep.driverId) {
                document.getElementById('dep-driver').value = dep.driverId;
            } else {
                const driverOpt = Array.from(document.getElementById('dep-driver').options).find(o => o.text === dep.driverName);
                if (driverOpt) document.getElementById('dep-driver').value = driverOpt.value;
            }

            if (dep.vehicleId) {
                document.getElementById('dep-vehicle').value = dep.vehicleId;
            } else {
                const vehicleSelect = document.getElementById('dep-vehicle');
                const vehicleOpt = Array.from(vehicleSelect.options).find(o => o.dataset.plate === dep.vehiclePlate);
                if (vehicleOpt) vehicleSelect.value = vehicleOpt.value;
            }
        }
    } else {
        title.textContent = 'Nouveau Départ';
    }

    modal.classList.add('active');
}

async function saveDepartureHandler() {
    const routeSelect = document.getElementById('dep-route');
    const driverSelect = document.getElementById('dep-driver');
    const vehicleSelect = document.getElementById('dep-vehicle');

    const selectedDriverName = driverSelect.options[driverSelect.selectedIndex]?.text;
    const selectedVehicleOpt = vehicleSelect.options[vehicleSelect.selectedIndex];

    let origin = document.getElementById('dep-origin').value;
    let destination = document.getElementById('dep-destination').value;

    if (!origin && routeSelect.value) {
        const routeOpt = routeSelect.options[routeSelect.selectedIndex];
        origin = routeOpt.dataset.origin;
        destination = routeOpt.dataset.destination;
    }

    const data = {
        routeId: routeSelect.value,
        origin: origin,
        destination: destination,
        date: document.getElementById('dep-date').value,
        departureTime: document.getElementById('dep-time').value,
        driverId: driverSelect.value,
        driverName: selectedDriverName !== 'Sélectionner...' ? selectedDriverName : 'Non assigné',
        vehicleId: vehicleSelect.value,
        vehicleType: selectedVehicleOpt?.dataset.type || 'Bus',
        vehiclePlate: selectedVehicleOpt?.dataset.plate || '',
        price: parseInt(document.getElementById('dep-price').value) || 0,
        status: 'pending',
        bookedSeats: 0,
        totalSeats: parseInt(selectedVehicleOpt?.dataset.capacity) || 30
    };

    const id = document.getElementById('departure-id').value;
    const btnSave = document.getElementById('btn-save-departure');

    if (!data.routeId || !data.date) {
        window.showAlert('Erreur', 'Veuillez sélectionner une route et une date', 'error');
        return;
    }

    try {
        window.setBtnLoading(btnSave, true);

        if (id) {
            await updateDeparture(id, data);
            window.showAlert('Succès', 'Départ mis à jour', 'success');
        } else {
            await createDeparture(data);
            window.showAlert('Succès', 'Nouveau départ créé', 'success');
        }
        loadDepartures(); // Stay on current page? Or reset?
        document.getElementById('modal-departure').classList.remove('active');
    } catch (error) {
        console.error(error);
        window.showAlert('Erreur', 'Impossible d\'enregistrer', 'error');
    } finally {
        window.setBtnLoading(btnSave, false);
    }
}

window.editDeparture = (id) => openDepartureModal(id);
window.deleteDeparture = async (id) => {
    const confirmed = await window.showConfirm('Suppression', 'Voulez-vous vraiment supprimer ce départ ?');
    if (confirmed) {
        try {
            window.showLoading('Suppression en cours...');
            await deleteDeparture(id);
            loadDepartures();
            window.hideLoading();
            window.showAlert('Succès', 'Départ supprimé', 'success');
        } catch (error) {
            window.hideLoading();
            console.error(error);
            window.showAlert('Erreur', 'Impossible de supprimer le départ', 'error');
        }
    }
};

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function getStatusClass(status) {
    return { 'in_progress': 'warning', 'pending': 'info', 'completed': 'success' }[status] || 'info';
}

function getStatusLabel(status) {
    return { 'in_progress': 'En cours', 'pending': 'À venir', 'completed': 'Terminé' }[status] || status;
}
