/**
 * PARCELS VIEW - Global Parcel Management
 * ========================================
 */
import { getParcels, createParcel, updateParcel, transferParcel, getDepartures, updateParcelStatus, deleteParcel, getAgencies, getEmployees } from '../../js/services/api.js';
import { isSuperAdmin, isManager, getDefaultAgencyId } from '../../js/utils/user-state.js';
import { createAgencySelector } from '../../js/utils/agency-selector.js';
import { exportToExcel, exportToPDF } from '../../js/utils/export-utils.js';
import { DatePicker } from '../../js/components/date-picker.js';
import { createEmployeeSelector } from '../../js/utils/employee-selector.js';
import { Cache } from '../../js/services/cache.js';
import { CONFIG } from '../../js/config.js';

let allParcels = [];
let currentFilter = 'all';
let selectedParcel = null;
let selectedAgencyId = null;
let currentTransferId = null;
let dateFromPicker = null;
let dateToPicker = null;
let employeeSelector = null;
let selectedEmployeeId = null;
let currentPage = 1;
let totalPages = 1;
const LIMIT = 20;

// ============================================================================
// INITIALIZATION
// ============================================================================

export async function init() {
    console.log("Parcels View Initialized");

    // Set default agency for filtering (crucial for RBAC)
    selectedAgencyId = getDefaultAgencyId();

    setupAdvancedFilters();

    // Non-blocking Agency Selector
    setupAgencySelector();

    setupEventListeners();

    // Initial Load (will be refreshed if agency selector sets an ID)
    loadParcels();

    setupExports();
    setupPagination();
}

async function setupAdvancedFilters() {
    // Date Pickers
    dateFromPicker = new DatePicker({
        container: '#date-from-container',
        placeholder: 'Début',
        allowClear: true,
        onChange: (date, val) => {
            currentPage = 1;
            loadParcels();
        }
    });

    dateToPicker = new DatePicker({
        container: '#date-to-container',
        placeholder: 'Fin',
        allowClear: true,
        onChange: (date, val) => {
            currentPage = 1;
            loadParcels();
        }
    });

    // Employee Selector
    const empContainer = document.getElementById('employee-filter-container');
    if (empContainer) {
        employeeSelector = await createEmployeeSelector(empContainer, {
            onSelect: (val) => {
                selectedEmployeeId = val;
                currentPage = 1;
                loadParcels();
            }
        });

        if (!isSuperAdmin() && !isManager()) {
            employeeSelector.loadEmployees();
        }
    }

    // Reset Button
    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            dateFromPicker.clear();
            dateToPicker.clear();
            if (employeeSelector) {
                employeeSelector.setValue('');
                selectedEmployeeId = null;
            }
            currentFilter = 'all';
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('[data-filter="all"]').forEach(t => t.classList.add('active'));
            document.getElementById('search-parcel').value = '';

            currentPage = 1;
            loadParcels();
        });
    }
}

async function setupAgencySelector() {
    const headerActions = document.querySelector('.page-header .header-actions');
    if (headerActions && (isSuperAdmin() || isManager())) {
        const selectorContainer = document.createElement('div');
        selectorContainer.className = 'agency-filter-container';
        if (headerActions.firstChild) {
            headerActions.insertBefore(selectorContainer, headerActions.firstChild);
        } else {
            headerActions.appendChild(selectorContainer);
        }

        await createAgencySelector(selectorContainer, (agencyId) => {
            selectedAgencyId = agencyId;
            currentPage = 1;
            if (employeeSelector) employeeSelector.loadEmployees(agencyId);
            loadParcels();
        });

        selectedAgencyId = getDefaultAgencyId();
        if (employeeSelector && selectedAgencyId) employeeSelector.loadEmployees(selectedAgencyId);
    }
}

// ============================================================================
// PAGINATION & EXPORTS
// ============================================================================

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
                loadParcels();
            }
        };
        document.getElementById('next-btn').onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadParcels();
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

function setupExports() {
    const headerActions = document.querySelector('.page-header');
    if (!headerActions) return;
    if (document.getElementById('btn-export-excel')) return;

    const btnContainer = document.createElement('div');
    btnContainer.className = 'export-actions';
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '8px';
    btnContainer.style.marginRight = '12px';

    btnContainer.innerHTML = `
        <button id="btn-export-excel" class="btn btn-text" title="Excel">Excel</button>
        <button id="btn-export-pdf" class="btn btn-text" title="PDF">PDF</button>
    `;

    let actionsContainer = headerActions.querySelector('.header-actions');
    if (!actionsContainer) {
        headerActions.appendChild(btnContainer);
    } else {
        actionsContainer.prepend(btnContainer);
    }

    document.getElementById('btn-export-excel').addEventListener('click', () => {
        exportToExcel(allParcels, 'colis_export', {
            'id': 'ID', 'sender.name': 'Expéditeur', 'recipient.name': 'Destinataire',
            'origin': 'Origine', 'destination': 'Destination', 'price': 'Prix', 'status': 'Statut'
        });
    });

    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        exportToPDF(allParcels, 'Liste des Colis', {
            'id': 'ID', 'sender.name': 'Expéditeur', 'recipient.name': 'Destinataire',
            'origin': 'Départ', 'destination': 'Arrivée', 'price': 'Prix (FCFA)', 'status': 'Statut'
        }, 'colis_export');
    });
}

function setupEventListeners() {
    // Filter tabs
    document.querySelectorAll('.filter-tab[data-filter]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            currentPage = 1;
            loadParcels();
        });
    });

    // Search input
    const searchInput = document.getElementById('search-parcel');
    if (searchInput) {
        let timeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                currentPage = 1;
                loadParcels();
            }, 500);
        });
    }

    // Mark delivered button
    const btnDelivered = document.getElementById('btn-mark-delivered');
    if (btnDelivered) {
        btnDelivered.addEventListener('click', markAsDelivered);
    }

    // Close modals
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) modal.classList.remove('active');
        });
    });

    // Quick Pickup
    const btnQuickPickup = document.getElementById('btn-quick-pickup');
    if (btnQuickPickup) {
        btnQuickPickup.addEventListener('click', () => {
            document.getElementById('modal-pickup').classList.add('active');
            const codeInput = document.getElementById('pickup-code');
            if (codeInput) {
                codeInput.value = '';
                codeInput.focus();
            }
            const res = document.getElementById('pickup-result');
            if (res) res.style.display = 'none';
        });
    }

    const btnSubmitPickup = document.getElementById('btn-submit-pickup');
    if (btnSubmitPickup) {
        btnSubmitPickup.addEventListener('click', submitPickup);
    }

    // New Parcel
    const btnNewParcel = document.getElementById('btn-new-parcel');
    if (btnNewParcel) {
        btnNewParcel.addEventListener('click', openCreateModal);
    }

    const btnSaveParcel = document.getElementById('btn-save-parcel');
    if (btnSaveParcel) {
        btnSaveParcel.addEventListener('click', submitCreateParcel);
    }

    // Transfer Action (in Detail Modal)
    const btnTransferAction = document.getElementById('btn-transfer-action');
    if (btnTransferAction) {
        btnTransferAction.addEventListener('click', () => {
            if (selectedParcel) {
                openTransferModal(selectedParcel.id);
            }
        });
    }

    // Confirm Transfer
    const btnConfirmTransfer = document.getElementById('btn-confirm-transfer');
    if (btnConfirmTransfer) {
        btnConfirmTransfer.addEventListener('click', submitTransfer);
    }
}

async function submitPickup() {
    const codeInput = document.getElementById('pickup-code');
    const resultDiv = document.getElementById('pickup-result');
    const code = codeInput.value.trim();

    if (!code) {
        window.showAlert('Erreur', 'Veuillez saisir un code', 'error');
        return;
    }

    try {
        window.showLoading('Vérification...');
        const token = localStorage.getItem('adminToken');
        

        // ... (inside the file)

        const res = await fetch(`${CONFIG.API_URL}/operations/parcels/deliver-by-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Tenant-ID': 'tenant-default-001'
            },
            body: JSON.stringify({ code })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Erreur inconnue');
        }

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <strong>Succès !</strong><br>
            Colis #${data.parcel.id} marqué comme LIVRÉ.<br>
            Destinataire : ${data.parcel.recipient}
        `;
        codeInput.value = '';
        loadParcels();

    } catch (e) {
        window.showAlert('Erreur', e.message, 'error');
    } finally {
        window.hideLoading();
    }
}

// ============================================================================
// DATA LOADING
// ============================================================================

function loadParcels() {
    const tbody = document.getElementById('parcels-table');
    // Only show full loading on first load or manual refresh to avoid flicker
    if (!allParcels.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Chargement...</td></tr>';
    }

    let filters = { page: currentPage, limit: LIMIT };

    if (currentFilter === 'unassigned') {
        filters.unassigned = true;
    } else if (currentFilter !== 'all') {
        filters.status = currentFilter;
    }

    if (selectedAgencyId) {
        filters.agencyId = selectedAgencyId;
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
    if (selectedEmployeeId) {
        filters.employeeId = selectedEmployeeId;
    }

    const searchTerm = document.getElementById('search-parcel')?.value;
    if (searchTerm) filters.search = searchTerm;

    const cacheKey = `parcels_${JSON.stringify(filters)}`;

    Cache.swr(cacheKey, () => getParcels(filters), (response) => {
        if (response.data && response.meta) {
            allParcels = response.data;
            currentPage = response.meta.page;
            totalPages = response.meta.last_page;
            renderStats(response.meta);
        } else if (Array.isArray(response)) {
            allParcels = response;
            currentPage = 1;
            totalPages = 1;
            renderStats({});
        } else {
            allParcels = [];
        }

        renderTable();
        updatePaginationUI();
    }).catch(error => {
        console.warn('LoadParcels Error:', error);
        allParcels = [];
        renderStats({});
        const tbody = document.getElementById('parcels-table');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--danger);">
                ${error.message && error.message.includes('403')
                    ? '🚫 Accès non autorisé (Agence externe)'
                    : '❌ Erreur de chargement: ' + (error.message || 'Inconnue')}
            </td></tr>`;
        }
    });
}

// ============================================================================
// LOGIC: CREATE & TRANSFER
// ============================================================================

async function openCreateModal() {
    document.getElementById('modal-create-parcel').classList.add('active');
    // Reset form
    document.getElementById('new-sender-name').value = '';
    document.getElementById('new-sender-phone').value = '';
    document.getElementById('new-recipient-name').value = '';
    document.getElementById('new-recipient-phone').value = '';
    document.getElementById('new-origin').value = '';
    document.getElementById('new-destination').value = '';
    document.getElementById('new-desc').value = '';
    document.getElementById('new-price').value = '1000';

    await loadDeparturesForSelect('new-parcel-departure');
}

async function submitCreateParcel() {
    const data = {
        sender: {
            name: document.getElementById('new-sender-name').value,
            phone: document.getElementById('new-sender-phone').value
        },
        recipient: {
            name: document.getElementById('new-recipient-name').value,
            phone: document.getElementById('new-recipient-phone').value
        },
        origin: document.getElementById('new-origin').value,
        destination: document.getElementById('new-destination').value,
        description: document.getElementById('new-desc').value,
        price: parseInt(document.getElementById('new-price').value) || 0,
        departureId: document.getElementById('new-parcel-departure').value || null
    };

    if (!data.sender.name || !data.recipient.name) {
        window.showAlert('Erreur', 'Noms expéditeur et destinataire requis.', 'error');
        return;
    }

    try {
        window.showLoading('Création...');
        await createParcel(data);
        window.hideLoading();
        window.showAlert('Succès', 'Colis créé avec succès', 'success');
        document.getElementById('modal-create-parcel').classList.remove('active');
        loadParcels();
    } catch (e) {
        window.hideLoading();
        window.showAlert('Erreur', e.message, 'error');
    }
}

async function openTransferModal(parcelId) {
    currentTransferId = parcelId;
    document.getElementById('modal-parcel-detail').classList.remove('active');
    document.getElementById('modal-transfer-parcel').classList.add('active');
    document.getElementById('transfer-parcel-info').textContent = `Transfert du colis #${parcelId}`;
    await loadDeparturesForSelect('transfer-departure-select');
}

async function submitTransfer() {
    const departureId = document.getElementById('transfer-departure-select').value;
    try {
        window.showLoading('Transfert...');
        await transferParcel(currentTransferId, departureId || null);
        window.hideLoading();
        window.showAlert('Succès', 'Colis transféré', 'success');
        document.getElementById('modal-transfer-parcel').classList.remove('active');
        loadParcels();
    } catch (e) {
        window.hideLoading();
        window.showAlert('Erreur', e.message, 'error');
    }
}

async function loadDeparturesForSelect(selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Chargement...</option>';
    try {
        const deps = await getDepartures({ status: 'pending' });
        select.innerHTML = '<option value="">-- Non assigné --</option>';
        deps.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = `${d.date} ${d.departureTime} - ${d.origin} > ${d.destination}`;
            select.appendChild(opt);
        });
    } catch (e) {
        select.innerHTML = '<option value="">Erreur chargement</option>';
    }
}

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

function renderStats(meta) {
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    const pending = allParcels.filter(p => p.status === 'pending').length;
    const transit = allParcels.filter(p => p.status === 'transit' || p.status === 'in_transit').length;
    const delivered = allParcels.filter(p => p.status === 'delivered').length;

    setText('stat-pending', pending);
    setText('stat-transit', transit);
    setText('stat-delivered', delivered);

    // Revenue: only show figures for own-agency parcels
    // Backend returns collected_revenue = own-agency only for colis role
    if (meta && meta.collected_revenue !== undefined) {
        const el = document.getElementById('stat-revenue-collected');
        if (el) el.textContent = formatCompact(meta.collected_revenue);
    } else {
        const ownTotal = allParcels
            .filter(p => p.isOwnAgency !== false)  // include if flag absent (non-colis roles)
            .reduce((sum, p) => sum + (p.price || 0), 0);
        const el = document.getElementById('stat-revenue-collected');
        if (el) el.textContent = formatCompact(ownTotal);
    }
}

function renderTable() {
    const tbody = document.getElementById('parcels-table');
    if (!tbody) return;

    if (allParcels.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">Aucun colis trouvé</td></tr>';
        return;
    }

    // No client-side filtering needed here as API filters everything
    // Except maybe search highlight?

    tbody.innerHTML = allParcels.map(p => {
        const isReadOnly = p.readOnly === true;
        const priceCell = isReadOnly
            ? `<td><span style="color:var(--text-muted);font-size:0.8rem;font-style:italic;">-</span></td>`
            : `<td>${formatPrice(p.price)}</td>`;
        const agencyBadge = isReadOnly
            ? `<span style="font-size:0.7rem;background:var(--surface-hover);color:var(--text-muted);padding:2px 6px;border-radius:4px;margin-left:4px;">Lecture seule</span>`
            : '';
        const actionBtns = isReadOnly
            ? `<button class="btn-icon" onclick="window.viewParcel('${p.id}')" title="Consulter">
                <svg class="icon-svg" style="width:16px;height:16px" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
               </button>`
            : `<button class="btn-icon" onclick="window.viewParcel('${p.id}')" title="Détails">
                <svg class="icon-svg" style="width:16px;height:16px" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
               </button>
               ${p.status !== 'delivered' ? `<button class="btn-icon" onclick="window.markDelivered('${p.id}')" title="Livré">
                <svg class="icon-svg" style="width:16px;height:16px;color:green" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
               </button>` : ''}`;

        return `
        <tr style="${isReadOnly ? 'opacity:0.85;background:var(--surface-alt,inherit);' : ''}">
            <td><span class="parcel-id">${p.id.substring(0, 10)}...</span></td>
            <td>
                <div class="contact-cell">
                    <span class="contact-name">${p.sender.name}</span>
                    <span class="contact-phone">${p.sender.phone}</span>
                </div>
            </td>
            <td>
                <div class="contact-cell">
                    <span class="contact-name">${p.recipient.name}</span>
                    <span class="contact-phone">${p.recipient.phone}</span>
                </div>
            </td>
            <td>
                <div class="route-cell">
                    ${p.origin} → ${p.destination}${agencyBadge}
                </div>
                <div class="text-xs text-muted">${p.registeredBy?.agency || '-'}</div>
            </td>
            ${priceCell}
            <td><span class="status-pill ${p.status}">${getStatusLabel(p.status)}</span></td>
            <td>${formatDate(p.createdAt)}</td>
            <td>
                <div class="action-buttons">${actionBtns}</div>
            </td>
        </tr>`;
    }).join('');
}

// ============================================================================
// MODAL & ACTIONS
// ============================================================================

function openParcelDetail(parcelId) {
    selectedParcel = allParcels.find(p => p.id === parcelId);
    if (!selectedParcel) return;

    const content = document.getElementById('parcel-detail-content');
    if (!content) return;

    content.innerHTML = `
        <div class="detail-section">
            <h4>📤 Expéditeur</h4>
            <div class="detail-value">${selectedParcel.sender.name}</div>
            <div class="text-muted">${selectedParcel.sender.phone}</div>
        </div>
        <div class="detail-section">
            <h4>📥 Destinataire</h4>
            <div class="detail-value">${selectedParcel.recipient.name}</div>
            <div class="text-muted">${selectedParcel.recipient.phone}</div>
        </div>
        <div class="detail-section">
            <h4>🚌 Trajet</h4>
            <div class="detail-value">${selectedParcel.origin} → ${selectedParcel.destination}</div>
            <div class="text-muted">${selectedParcel.departureName || 'Non assigné'}</div>
        </div>
        <div class="detail-section">
            <h4>📝 Description</h4>
            <div class="detail-value">${selectedParcel.description || 'Non spécifiée'}</div>
        </div>
        <div class="detail-section">
            <h4>💰 Prix</h4>
            <div class="detail-value">${formatPrice(selectedParcel.price)}</div>
        </div>
        <div class="detail-section">
            <h4>👤 Enregistré par</h4>
            <div class="detail-value">${selectedParcel.registeredBy?.user || '-'}</div>
            <div class="text-muted">${selectedParcel.registeredBy?.agency || '-'}</div>
        </div>
    `;

    const btnDelivered = document.getElementById('btn-mark-delivered');
    if (btnDelivered) {
        const canAct = selectedParcel.status !== 'delivered' && !selectedParcel.readOnly;
        btnDelivered.style.display = canAct ? 'flex' : 'none';
    }
    const btnTransfer = document.getElementById('btn-transfer-action');
    if (btnTransfer) {
        btnTransfer.style.display = selectedParcel.readOnly ? 'none' : 'flex';
    }

    document.getElementById('modal-parcel-detail').classList.add('active');
}

async function markAsDelivered() {
    if (!selectedParcel) return;

    const confirmed = await window.showConfirm(
        'Confirmation',
        `Marquer le colis ${selectedParcel.id} comme livré ?`
    );

    if (confirmed) {
        try {
            window.showLoading('Validation en cours...');
            await updateParcel(selectedParcel.id, { status: 'delivered' });
            selectedParcel.status = 'delivered'; // Optimistic update

            renderStats();
            renderTable();
            document.getElementById('modal-parcel-detail').classList.remove('active');

            window.showAlert('Succès', 'Colis marqué comme livré !', 'success');
        } finally {
            window.hideLoading();
        }
    }
}

// Global functions
window.viewParcel = (id) => openParcelDetail(id);
window.markDelivered = async (id) => {
    selectedParcel = allParcels.find(p => p.id === id);
    if (selectedParcel) markAsDelivered();
};

// ============================================================================
// HELPERS
// ============================================================================

function formatPrice(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

function formatCompact(amount) {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
    if (amount >= 1000) return (amount / 1000).toFixed(0) + 'K';
    return amount.toString();
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getStatusLabel(status) {
    const labels = { pending: 'En attente', transit: 'En transit', delivered: 'Livré', cancelled: 'Annulé' };
    return labels[status] || status;
}
