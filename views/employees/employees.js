import { getEmployees, getDrivers, createEmployee, updateEmployee, deleteEmployee, createDriver, updateDriver, deleteDriver, getAgencies, getVehicles } from '../../js/services/api.js';
import { createAgencySelector, getDefaultAgencyId } from '../../js/components/agency-selector.js';
import { isSuperAdmin, isManager } from '../../js/utils/user-state.js';

// State
let state = {
    employees: [],
    agencyId: null,
    filter: 'all',
    search: ''
};

export function init() {
    console.log('[Phase 4] Init - CRUD Ready');
    clearEmployeeCache(); // Force refresh on load to prevent stale empty states

    // Reset State
    state = { employees: [], agencyId: null, filter: 'all', search: '' };

    // Clear Search Input
    const searchInput = document.getElementById('search-employee');
    if (searchInput) searchInput.value = '';

    // Setup UI
    setupAgencySelector();
    setupFilters();
    setupSearch();
    setupModals();
    setupPermissions();

    // Initial Load
    const defaultAgency = getDefaultAgencyId();
    if (defaultAgency) {
        state.agencyId = defaultAgency;
    }

    loadData();
}

function setupPermissions() {
    if (!isSuperAdmin() && !isManager()) {
        const btnAdd = document.getElementById('btn-add-employee');
        if (btnAdd) btnAdd.style.display = 'none';
    }
}

// ... (Existing Filter/Search/Agency Setup kept clean)

function setupFilters() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const target = e.currentTarget;
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            target.classList.add('active');
            state.filter = target.dataset.filter || 'all';
            render();
        });
    });
}

function setupSearch() {
    const input = document.getElementById('search-employee');
    if (input) {
        input.addEventListener('input', (e) => {
            state.search = e.target.value.toLowerCase();
            render();
        });
    }
}

async function setupAgencySelector() {
    const headerActions = document.querySelector('.page-header .header-actions');
    if (headerActions && (isSuperAdmin() || isManager())) {
        if (headerActions.querySelector('.agency-selector-wrapper')) return;

        const container = document.createElement('div');
        container.className = 'agency-filter-container';
        if (headerActions.firstChild) headerActions.insertBefore(container, headerActions.firstChild);
        else headerActions.appendChild(container);

        try {
            await createAgencySelector(container, (newId) => {
                state.agencyId = newId;
                loadData();
            });
        } catch (e) { console.warn('Agency Selector fail:', e); }
    }
}

// ----------------------------------------------------------------------------
// CACHING
// ----------------------------------------------------------------------------
const CACHE_PREFIX = 'van_emp_v1_';
const CACHE_TTL = 10 * 60 * 1000; // 10 Minutes

function getCacheKey(agencyId) {
    return `${CACHE_PREFIX}${agencyId || 'all'}`;
}

function loadFromCache(agencyId) {
    try {
        const key = getCacheKey(agencyId);
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;

        const cached = JSON.parse(raw);
        if (Date.now() - cached.timestamp > CACHE_TTL) {
            sessionStorage.removeItem(key);
            return null;
        }
        console.log('[Cache] Hit:', key);
        return cached.data;
    } catch (e) {
        return null;
    }
}

function saveToCache(agencyId, data) {
    try {
        const key = getCacheKey(agencyId);
        const payload = {
            timestamp: Date.now(),
            data: data
        };
        sessionStorage.setItem(key, JSON.stringify(payload));
    } catch (e) {
        console.warn('Cache save failed', e);
    }
}

function clearEmployeeCache() {
    // Clear all employee related keys to be safe (invalidates All + Specifics)
    Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
            sessionStorage.removeItem(key);
        }
    });
    console.log('[Cache] Cleared');
}

// ----------------------------------------------------------------------------
// DATA LOADING
// ----------------------------------------------------------------------------

async function loadData() {
    const tbody = document.getElementById('employees-table');
    if (!tbody) return;

    // 1. Try Cache
    const cachedData = loadFromCache(state.agencyId);
    if (cachedData && cachedData.length > 0) {
        state.employees = cachedData;
        render(); // Instant render
        return;
    }
    // If cache is empty or null, continue to fetch

    if (state.employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">Chargement des équipes...</td></tr>';
    }

    try {
        const filters = {};
        if (state.agencyId && state.agencyId !== 'null') {
            filters.agencyId = state.agencyId;
        }

        // Parallel Fetch: Users + Fleet Drivers
        const [usersData, driversData] = await Promise.all([
            getEmployees(filters),
            getDrivers(filters)
        ]).catch(err => {
            console.warn('Partial load error:', err);
            return [[], []]; // Handle partial failure gracefully?
        });

        const users = Array.isArray(usersData) ? usersData : (usersData.data || []);

        // Normalize Fleet Drivers
        const drivers = (Array.isArray(driversData) ? driversData : (driversData.data || [])).map(d => ({
            id: d.id,
            name: d.name,
            role: 'driver',
            agencyName: d.currentAgencyName || d.agencyName || 'N/A', // Try both keys
            phone: d.phone,
            status: d.status,
            email: d.email || '-',
            performance: d.rating ? Math.round(d.rating * 20) : 0, // 5 stars -> 100%
            isFleet: true // Flag to identify source
        }));

        state.employees = [...users, ...drivers];

        // Save to Cache
        saveToCache(state.agencyId, state.employees);

        render();
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="7" style="color:red;text-align:center">Erreur: ${e.message}</td></tr>`;
    }
}

function render() {
    const tbody = document.getElementById('employees-table');
    if (!tbody) return;

    const filtered = state.employees.filter(emp => {
        if (state.filter !== 'all' && emp.role !== state.filter) return false;
        if (state.search) {
            const term = state.search;
            return (emp.name || '').toLowerCase().includes(term) || (emp.phone || '').includes(term);
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">Aucun résultat.</td></tr>';
        return;
    }

    // Role Map
    const roleLabels = { 'admin': 'Admin', 'superadmin': 'SuperAdmin', 'manager': 'Manager', 'agent': 'Guichetier', 'driver': 'Chauffeur', 'colis': 'Agent Colis', 'guichet': 'Guichetier' };
    const canEdit = isSuperAdmin() || isManager();

    tbody.innerHTML = filtered.map(emp => `
        <tr>
            <td>
                <div class="employee-cell">
                    <div class="employee-avatar">${getInitials(emp.name)}</div>
                    <div class="employee-info">
                        <span class="employee-name">${escapeHtml(emp.name)}</span>
                        ${emp.isFleet ? '<span class="text-xs text-blue-600">⚡ Flotte</span>' : `<span class="employee-id">${emp.id || ''}</span>`}
                    </div>
                </div>
            </td>
            <td><span class="role-badge ${emp.role}">${roleLabels[emp.role] || emp.role}</span></td>
            <td>${emp.agencyName || '-'}</td>
            <td>${emp.phone || '-'}</td>
            <td><span class="status-pill ${emp.status}">${emp.status === 'active' || emp.status === 'available' || emp.status === 'on_trip' ? 'Actif' : 'Inactif'}</span></td>
            <td>
                <div class="performance-bar">
                    <div class="perf-bar-bg">
                        <div class="perf-bar-fill ${getPerformanceClass(emp.performance ?? 0)}" style="width: ${emp.performance ?? 0}%"></div>
                    </div>
                    <span>${emp.performance != null ? emp.performance + '%' : '—'}</span>
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    ${emp.isFleet ?
            `<button class="btn-icon" onclick="window.editEmployee('${emp.id}')" title="Modifier le chauffeur">
                            <svg class="icon-svg" style="width:16px;height:16px" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>`
            :
            `<button class="btn-icon" onclick="window.editEmployee('${emp.id}')" title="Modifier">
                             <svg class="icon-svg" style="width:16px;height:16px" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>`
        }
                    ${canEdit && !emp.isFleet ? `
                    <button class="btn-icon danger" onclick="window.deleteEmployee('${emp.id}')" title="Supprimer">
                        <svg class="icon-svg" style="width:16px;height:16px" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

// ----------------------------------------------------------------------------
// CRUD MODALS
// ----------------------------------------------------------------------------

function setupModals() {
    // Open (Add)
    const btnAdd = document.getElementById('btn-add-employee');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            window.openEmployeeModal();
            loadAgenciesIntoModal();
        });
    }

    // Save
    const btnSave = document.getElementById('btn-save-employee');
    if (btnSave) {
        btnSave.addEventListener('click', handleSaveEmployee);
    }

    // Close
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const overlay = e.target.closest('.modal-overlay');
            if (overlay) overlay.classList.remove('active');
        });
    });

    // Role Change Listener
    const roleSelect = document.getElementById('employee-role');
    if (roleSelect) {
        roleSelect.addEventListener('change', (e) => {
            const role = e.target.value;
            const singleContainer = document.getElementById('single-agency-container');
            const multiContainer = document.getElementById('managed-agencies-container');
            const driverFields = document.getElementById('driver-fields');

            // Driver Fields Toggle
            if (driverFields) driverFields.style.display = role === 'driver' ? 'block' : 'none';

            // Agency Selector Toggle
            if (role === 'manager') {
                if (singleContainer) singleContainer.style.display = 'none';
                if (multiContainer) multiContainer.style.display = 'block';
            } else {
                if (singleContainer) singleContainer.style.display = 'block';
                if (multiContainer) multiContainer.style.display = 'none';
            }
        });
    }
}

window.openEmployeeModal = async function (employeeId = null) {
    const modal = document.getElementById('modal-employee');
    const title = document.getElementById('modal-employee-title');

    // Clear Form
    document.querySelectorAll('#modal-employee input').forEach(i => i.value = '');
    document.querySelectorAll('#modal-employee select').forEach(s => s.value = '');
    document.getElementById('driver-fields').style.display = 'none';

    // Populate Agency & Vehicle Selects
    await Promise.all([
        populateAgencyOptions(),
        loadVehiclesIntoModal()
    ]);

    if (employeeId) {
        // Edit Mode
        const emp = state.employees.find(e => e.id === employeeId);
        if (emp) {
            title.textContent = 'Modifier Employé';
            document.getElementById('employee-id').value = emp.id;
            document.getElementById('employee-name').value = emp.name;
            document.getElementById('employee-email').value = emp.email || '';
            document.getElementById('employee-phone').value = emp.phone || '';
            document.getElementById('employee-role').value = emp.role;
            if (emp.role === 'driver') document.getElementById('driver-fields').style.display = 'block';

            // Set agency directly (options are loaded)
            const agencyVal = emp.agency_id || emp.agencyId || '';
            document.getElementById('employee-agency').value = agencyVal;

            if (emp.role === 'driver') {
                document.getElementById('employee-license').value = emp.license || '';
                document.getElementById('employee-vehicle').value = emp.preferredVehicleId || '';
            }
        }
    } else {
        // Add Mode
        title.textContent = 'Nouvel Employé';
        if (state.agencyId) {
            document.getElementById('employee-agency').value = state.agencyId;
        }
    }

    modal.classList.add('active');
};

window.editEmployee = function (id) {
    // Clear Checkboxes
    document.querySelectorAll('.agency-checkbox').forEach(cb => cb.checked = false);

    // Reset UI state
    const singleContainer = document.getElementById('single-agency-container');
    const multiContainer = document.getElementById('managed-agencies-container');
    if (singleContainer) singleContainer.style.display = 'block';
    if (multiContainer) multiContainer.style.display = 'none';

    window.openEmployeeModal(id); // Basic open

    // If Edit, populate checkboxes
    if (id) {
        const emp = state.employees.find(e => e.id === id);
        if (emp && emp.role === 'manager') {
            loadAgenciesIntoModal().then(() => {
                // Determine managed agencies. If not in listing, we might need a fetch?
                // Assuming emp object has them or we assume all are unchecked initially.
                // NOTE: The current listing might NOT include managedAgencies list details.
                // We might need to fetch detailed user info if missing.
                // For now, let's try to check `managedAgencies` if present, or just the primary `agencyId`.

                // Trigger change to show multi-select
                const roleSelect = document.getElementById('employee-role');
                if (roleSelect) {
                    roleSelect.value = 'manager';
                    roleSelect.dispatchEvent(new Event('change'));
                }

                if (emp.managedAgencies) { // If present in object
                    emp.managedAgencies.forEach(a => {
                        const cb = document.querySelector(`.agency-checkbox[value="${a.id}"]`);
                        if (cb) cb.checked = true;
                    });
                } else if (emp.agencyId) {
                    const cb = document.querySelector(`.agency-checkbox[value="${emp.agencyId}"]`);
                    if (cb) cb.checked = true;
                }
            });
        }
    }
};

window.deleteEmployee = async function (id) {
    if (!confirm('Supprimer cet employé ?')) return;
    try {
        if (id.startsWith('drv-')) {
            await deleteDriver(id);
        } else {
            await deleteEmployee(id);
        }
        window.showAlert('Succès', 'Supprimé', 'success');
        clearEmployeeCache(); // Invalidate
        loadData();
    } catch (e) {
        window.showAlert('Erreur', e.message, 'error');
    }
};

async function populateAgencyOptions() {
    const select = document.getElementById('employee-agency');
    const multiContainer = document.getElementById('managed-agencies-container');

    if (!select && !multiContainer) return;

    try {
        const data = await getAgencies(); // Assumes API returns array or {data:[]}
        const list = Array.isArray(data) ? data : (data.data || []);

        // 1. Populate Single Select
        if (select) {
            select.innerHTML = '<option value="">Choisir...</option>';
            list.forEach(a => {
                const opt = document.createElement('option');
                opt.value = a.id;
                opt.textContent = a.name;
                select.appendChild(opt);
            });
        }

        // 2. Populate Multi Checkboxes
        if (multiContainer) {
            if (list.length === 0) {
                multiContainer.innerHTML = '<div class="text-muted small">Aucune agence disponible</div>';
            } else {
                multiContainer.innerHTML = list.map(a => `
                    <div style="margin-bottom: 6px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" class="agency-checkbox" value="${a.id}" style="margin-right: 8px;">
                            <span>${a.name}</span>
                        </label>
                    </div>
                `).join('');
            }
        }

    } catch (e) {
        console.error(e);
        if (select) select.innerHTML = '<option value="">Erreur chargement</option>';
        if (multiContainer) multiContainer.innerHTML = '<div class="text-error small">Erreur chargement</div>';
    }
}

async function handleSaveEmployee() {
    const id = document.getElementById('employee-id').value;
    const name = document.getElementById('employee-name').value;
    const email = document.getElementById('employee-email').value;
    const role = document.getElementById('employee-role').value;
    const password = document.getElementById('employee-password').value.trim();

    if (!name || !email || !role) {
        window.showAlert('Erreur', 'Champs obligatoires manquants', 'error');
        return;
    }

    const payload = {
        name, email, role,
        phone: document.getElementById('employee-phone').value
    };
    if (password) payload.password = password;

    // Handle Agency
    if (role === 'manager') {
        const checked = Array.from(document.querySelectorAll('.agency-checkbox:checked')).map(cb => cb.value);
        if (checked.length === 0) {
            // Warn but allow? No, usually required.
            window.showAlert('Erreur', 'Sélectionnez au moins une agence gérée', 'error');
            return;
        }
        payload.managedAgencies = checked;
        payload.agencyId = checked[0]; // Primary
    } else {
        const agId = document.getElementById('employee-agency').value;
        if (!agId && role !== 'driver') {
            window.showAlert('Erreur', 'Agence requise', 'error');
            return;
        }
        payload.agencyId = agId || null;
    }

    // Handle Driver Specifics
    if (role === 'driver') {
        payload.license = document.getElementById('employee-license').value;
        const vehId = document.getElementById('employee-vehicle').value;
        if (vehId) payload.preferredVehicleId = vehId;
    }

    try {
        const btn = document.getElementById('btn-save-employee');
        btn.disabled = true;
        btn.textContent = '...';

        if (id) {
            if (role === 'driver' || id.startsWith('drv-')) {
                await updateDriver(id, payload);
            } else {
                await updateEmployee(id, payload);
            }
            window.showAlert('Succès', 'Modifié', 'success');
        } else {
            if (role === 'driver') {
                await createDriver(payload);
            } else {
                await createEmployee(payload);
            }
            window.showAlert('Succès', 'Créé', 'success');
        }

        document.getElementById('modal-employee').classList.remove('active');
        clearEmployeeCache(); // Invalidate
        loadData();
    } catch (e) {
        window.showAlert('Erreur', e.message || 'Erreur API', 'error');
    } finally {
        const btn = document.getElementById('btn-save-employee');
        btn.disabled = false;
        btn.textContent = 'Enregistrer';
    }
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function getInitials(name) {
    if (!name) return '?';
    return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getPerformanceClass(score) {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
}

async function loadAgenciesIntoModal() {
    try {
        const agencies = await getAgencies(); // Assumes API returns array
        const list = Array.isArray(agencies) ? agencies : (agencies.data || []);

        const select = document.getElementById('employee-agency');
        const checkboxContainer = document.getElementById('managed-agencies-container');

        // Populate Select
        if (select) {
            const currentVal = select.value;
            select.innerHTML = '<option value="">Sélectionner...</option>' +
                list.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
            if (currentVal) select.value = currentVal;
        }

        // Populate Checkboxes
        if (checkboxContainer) {
            checkboxContainer.innerHTML = list.map(a => `
                <div style="margin-bottom: 5px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" class="agency-checkbox" value="${a.id}" style="margin-right: 8px;">
                        <span>${a.name}</span>
                    </label>
                </div>
             `).join('');
        }
    } catch (e) {
        console.error('Failed to load modal agencies', e);
    }
}

async function loadVehiclesIntoModal() {
    const select = document.getElementById('employee-vehicle');
    if (!select) return;

    try {
        // Fetch only active vehicles
        const vehicles = await getVehicles({ status: 'active' });
        const list = Array.isArray(vehicles) ? vehicles : (vehicles.data || []);

        const currentVal = select.value;
        select.innerHTML = '<option value="">Aucun</option>' +
            list.map(v => `<option value="${v.id}">${v.model} (${v.plate})</option>`).join('');

        if (currentVal) select.value = currentVal;

    } catch (e) {
        console.warn('Failed to load vehicles', e);
        select.innerHTML = '<option value="">Erreur chargement</option>';
    }
}
