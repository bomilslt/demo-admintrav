/**
 * Bookings View
 */

import { getBookings, updateBookingStatus, transferBooking, getDepartures, deleteBooking, refundBooking } from '../../js/services/api.js';
import { createAgencySelector } from '../../js/utils/agency-selector.js';
import { isSuperAdmin, isManager, getDefaultAgencyId } from '../../js/utils/user-state.js';
import { exportToExcel, exportToPDF } from '../../js/utils/export-utils.js';
import { DatePicker } from '../../js/components/date-picker.js';
import { createEmployeeSelector } from '../../js/utils/employee-selector.js';
import { Cache } from '../../js/services/cache.js';

let allBookings = [];
let currentFilter = 'all';
let currentChannelFilter = 'all'; // Sale channel filter
let searchTimeout = null;
let bookingToCancel = null;
let bookingToTransfer = null;
let currentPage = 1;
let totalPages = 1;
let selectedAgencyId = null;
let dateFromPicker = null;
let dateToPicker = null;
let employeeSelector = null;
let selectedEmployeeId = null;
const LIMIT = 20;

export function init() {
    // Advanced Filters Setup
    setupAdvancedFilters();

    // Initialize agency selector for superadmin/manager
    // Don't await. Pass callback to reload when agency set.
    setupAgencySelector();

    loadBookings(); // SWR

    setupFilters();
    setupChannelFilters();
    setupSearch();
    setupModal();
    setupTransferModal();
    setupPagination();
    setupExports();
}

function loadBookings(searchTermArg, pageArg) {
    // Support legacy signature: loadBookings(searchTerm, page)
    // If pageArg is passed, update global currentPage
    if (pageArg) currentPage = pageArg;

    const tbody = document.getElementById('bookings-table');
    const searchTerm = searchTermArg !== undefined ? searchTermArg : (document.getElementById('booking-search')?.value || '');

    let filters = {
        page: currentPage,
        limit: LIMIT,
        status: currentFilter
    };

    if (currentChannelFilter !== 'all') {
        filters.channel = currentChannelFilter;
    }

    if (selectedAgencyId) {
        filters.agencyId = selectedAgencyId;
    }

    if (searchTerm) {
        filters.search = searchTerm;
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
        filters.createdBy = selectedEmployeeId;
    }

    const cacheKey = `bookings_${JSON.stringify(filters)}`;

    Cache.swr(cacheKey, () => getBookings(filters), (response) => {
        if (response.data && response.meta) {
            allBookings = response.data;
            currentPage = response.meta.page;
            totalPages = response.meta.last_page || response.meta.pages || 1;
        } else if (Array.isArray(response)) {
            allBookings = response;
            currentPage = 1;
            totalPages = 1;
        } else {
            allBookings = [];
        }

        renderTable();
        updatePaginationUI();
    });
}

// ... setupExports ... (omitted, assuming no change needed there, but sticking to block replacement)
// To keep it simple and safe, I will replace only up to loadBookings and add setupAdvancedFilters after setupAgencySelector

async function setupAdvancedFilters() {
    // Date Pickers
    dateFromPicker = new DatePicker({
        container: '#date-from-container',
        placeholder: 'Début',
        allowClear: true,
        onChange: (date, val) => {
            // Auto reload
            currentPage = 1;
            loadBookings(document.getElementById('booking-search')?.value || '', 1);
        }
    });

    dateToPicker = new DatePicker({
        container: '#date-to-container',
        placeholder: 'Fin',
        allowClear: true,
        onChange: (date, val) => {
            // Auto reload
            currentPage = 1;
            loadBookings(document.getElementById('booking-search')?.value || '', 1);
        }
    });

    // Employee Selector
    const empContainer = document.getElementById('employee-filter-container');
    if (empContainer) {
        employeeSelector = await createEmployeeSelector(empContainer, {
            onSelect: (val) => {
                selectedEmployeeId = val;
                currentPage = 1;
                loadBookings(document.getElementById('booking-search')?.value || '', 1);
            }
        });

        // Load initial employees (if not manager/superadmin requiring agency first)
        // If current user is staff, just load.
        // If manager/super, wait for agency selector?
        // We can just try loading, API filters by permission.
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
            // Reset filters logic
            currentFilter = 'all';
            currentChannelFilter = 'all';
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('[data-filter="all"], [data-channel="all"]').forEach(t => t.classList.add('active'));

            currentPage = 1;
            loadBookings();
        });
    }
}

async function setupAgencySelector() {
    const headerActions = document.querySelector('.page-header .header-actions');
    if (headerActions && (isSuperAdmin() || isManager())) {
        const selectorContainer = document.createElement('div');
        selectorContainer.className = 'agency-filter-container';
        // Insert as first child
        if (headerActions.firstChild) {
            headerActions.insertBefore(selectorContainer, headerActions.firstChild);
        } else {
            headerActions.appendChild(selectorContainer);
        }

        await createAgencySelector(selectorContainer, (agencyId) => {
            selectedAgencyId = agencyId;
            currentPage = 1;

            // Reload employees for selected agency
            if (employeeSelector) {
                employeeSelector.loadEmployees(agencyId);
            }

            loadBookings(document.getElementById('booking-search')?.value || '', 1);
        });

        // Set default for non-superadmin
        selectedAgencyId = getDefaultAgencyId();

        // Initial load of employees for default agency
        if (employeeSelector && selectedAgencyId) {
            employeeSelector.loadEmployees(selectedAgencyId);
        }
    }
}

// Migrated to SWR above


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
        <button id="btn-export-excel" class="btn btn-text" title="Excel">
            <svg class="icon-svg" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Excel
        </button>
        <button id="btn-export-pdf" class="btn btn-text" title="PDF">
            <svg class="icon-svg" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            PDF
        </button>
    `;

    // Try to find .header-actions inside page-header
    let actionsContainer = headerActions.querySelector('.header-actions');
    if (!actionsContainer) {
        headerActions.appendChild(btnContainer);
    } else {
        actionsContainer.prepend(btnContainer);
    }

    // Bind
    document.getElementById('btn-export-excel').addEventListener('click', () => {
        exportToExcel(allBookings, 'reservations_export', {
            'id': 'ID',
            'passengerName': 'Client',
            'phone': 'Téléphone',
            'departure.origin': 'Départ',
            'departure.destination': 'Destination',
            'departure.date': 'Date',
            'seats': 'Places',
            'amount': 'Montant',
            'status': 'Statut'
        });
    });

    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        exportToPDF(allBookings, 'Liste des Réservations', {
            'id': 'ID',
            'passengerName': 'Client',
            'departure.origin': 'Départ',
            'departure.destination': 'Arrivée',
            'departure.date': 'Date',
            'amount': 'Prix (FCFA)',
            'status': 'Statut'
        }, 'reservations_export');
    });
}





function setupFilters() {
    // Status filter tabs (data-filter attribute)
    document.querySelectorAll('.filter-tab[data-filter]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab[data-filter]').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            currentPage = 1;
            loadBookings(document.getElementById('booking-search').value, 1);
        });
    });
}

function setupChannelFilters() {
    // Channel filter tabs (data-channel attribute)
    document.querySelectorAll('.filter-tab[data-channel]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab[data-channel]').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentChannelFilter = tab.dataset.channel;
            currentPage = 1;
            loadBookings(document.getElementById('booking-search').value, 1);
        });
    });
}

function setupSearch() {
    const searchInput = document.getElementById('booking-search');
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentPage = 1;
            loadBookings(e.target.value, 1);
        }, 500);
    });
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
            if (currentPage > 1) loadBookings(document.getElementById('booking-search').value, currentPage - 1);
        };
        document.getElementById('next-btn').onclick = () => {
            if (currentPage < totalPages) loadBookings(document.getElementById('booking-search').value, currentPage + 1);
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

function setupModal() {
    // Cancel Modal Logic
    document.getElementById('bookings-table').addEventListener('click', (e) => {
        const btn = e.target.closest('.cancel-btn');
        if (btn) {
            bookingToCancel = btn.dataset.id;
            document.getElementById('cancel-modal').classList.add('active');
        }
    });

    document.getElementById('confirm-cancel-btn').onclick = async () => {
        if (bookingToCancel) {
            try {
                const confirmBtn = document.getElementById('confirm-cancel-btn');
                const originalText = confirmBtn.innerText;
                confirmBtn.innerText = 'Patientez...';
                confirmBtn.disabled = true;

                await updateBookingStatus(bookingToCancel, 'cancelled');

                bookingToCancel = null;
                document.getElementById('cancel-modal').classList.remove('active');
                loadBookings(document.getElementById('booking-search').value, currentPage);

                confirmBtn.innerText = originalText;
                confirmBtn.disabled = false;
            } catch (error) {
                await window.showAlert("Erreur", error.message, "error");
                document.getElementById('confirm-cancel-btn').disabled = false;
                document.getElementById('confirm-cancel-btn').innerText = 'Oui, Annuler';
            }
        }
    };

    window.closeCancelModal = () => {
        document.getElementById('cancel-modal').classList.remove('active');
        bookingToCancel = null;
    };
}

function setupTransferModal() {
    // Transfer Modal Logic
    document.getElementById('bookings-table').addEventListener('click', async (e) => {
        const btn = e.target.closest('.transfer-btn');
        if (btn) {
            bookingToTransfer = allBookings.find(b => b.id === btn.dataset.id);
            if (bookingToTransfer) {
                openTransferModalFor(bookingToTransfer);
            }
        }
    });

    document.getElementById('confirm-transfer-btn').onclick = async () => {
        const select = document.getElementById('transfer-departure-select');
        const newDepartureId = select.value;

        if (!bookingToTransfer || !newDepartureId) return;

        try {
            const btn = document.getElementById('confirm-transfer-btn');
            const originalText = btn.innerText;
            btn.innerText = 'Patientez...';
            btn.disabled = true;

            const res = await transferBooking(bookingToTransfer.id, newDepartureId);


            await window.showAlert("Succès", res.message, "success");

            closeTransferModal();
            loadBookings(document.getElementById('booking-search').value, currentPage);

            btn.innerText = 'Confirmer le Transfert';
            btn.disabled = false;
            btn.disabled = false;
        } catch (error) {
            await window.showAlert("Erreur", error.message, "error");
            document.getElementById('confirm-transfer-btn').disabled = false;
            document.getElementById('confirm-transfer-btn').innerText = 'Confirmer le Transfert';
        }
    };

    window.closeTransferModal = () => {
        document.getElementById('transfer-modal').classList.remove('active');
        bookingToTransfer = null;
    };
}

async function openTransferModalFor(booking) {
    const modal = document.getElementById('transfer-modal');
    modal.classList.add('active');

    const select = document.getElementById('transfer-departure-select');
    select.innerHTML = '<option>Chargement...</option>';
    select.disabled = true;
    document.getElementById('confirm-transfer-btn').disabled = true;

    // Debug Info Box
    const infoBox = document.getElementById('transfer-info-box');
    if (infoBox) {
        infoBox.style.display = 'block';
        infoBox.innerHTML = `Trajet actuel: <b>${booking.departure.origin} → ${booking.departure.destination}</b>`;
    }

    try {
        const departures = await getDepartures({});

        // Normalize strings
        const normalize = (str) => (str || '').toString().toLowerCase().trim();
        const currentOrigin = normalize(booking.departure.origin);
        const currentDest = normalize(booking.departure.destination);

        if (departures.length === 0) {
            select.innerHTML = '<option disabled>Aucun départ trouvé dans le système</option>';
            return;
        }

        // Split into "Compatible" (Same Route) and "Others"
        const compatible = [];
        const others = [];

        departures.forEach(d => {
            if (d.id === booking.departure.id) return; // Skip current

            const sameOrigin = normalize(d.origin) === currentOrigin;
            const sameDest = normalize(d.destination) === currentDest;
            const isAvailableStatus = ['pending', 'scheduled', 'active', 'in_progress'].includes(d.status);

            // Capacity Check
            const capacity = d.vehicleCapacity || d.totalSeats || 0;
            const booked = d.bookedSeats || 0;
            const seatsNeeded = booking.seats_count || booking.seats || 1;
            const hasEnoughSeats = (capacity - booked) >= seatsNeeded;

            const item = { ...d, isAvailable: isAvailableStatus && hasEnoughSeats };

            if (sameOrigin && sameDest && isAvailableStatus && hasEnoughSeats) {
                compatible.push(item);
            } else {
                item._debugReason = [];
                if (!sameOrigin || !sameDest) item._debugReason.push(`Trajet différent`);
                if (!isAvailableStatus) item._debugReason.push(`Statut: ${d.status}`);
                if (!hasEnoughSeats) item._debugReason.push(`Pas assez de sièges (${capacity - booked} disp. / ${seatsNeeded} req.)`);
                others.push(item);
            }
        });

        let html = '';

        if (compatible.length > 0) {
            html += `<optgroup label="✨ Départs recommandés (Même trajet + Places disp.)">`;
            html += compatible.map(d => `
                <option value="${d.id}">
                    ${formatDate(d.date)} ${d.departureTime || d.time} - ${formatPrice(d.price)} (${d.vehicleType || 'Bus'})
                </option>
            `).join('');
            html += `</optgroup>`;
        } else {
            html += `<option disabled>Aucun départ identique avec assez de places trouvé</option>`;
        }

        if (others.length > 0) {
            html += `<optgroup label="⚠️ Autres départs (Incompatibles)">`;
            html += others.map(d => {
                let warning = d._debugReason ? d._debugReason.join(', ') : 'Incompatible';

                return `
                    <option value="${d.id}" style="color: #666;">
                        [${warning}] ${formatDate(d.date)} ${d.departureTime || d.time} - ${formatPrice(d.price)}
                    </option>
                 `;
            }).join('');
            html += `</optgroup>`;
        }

        select.innerHTML = html;
        select.disabled = false;

        // Always enable confirm button if there are options (user can select "Others")
        // But if `select.value` is empty/disabled option, we need to be careful?
        // Browser selects first non-disabled option by default.
        document.getElementById('confirm-transfer-btn').disabled = false;

    } catch (e) {
        select.innerHTML = '<option disabled>Erreur API</option>';
        console.error(e);
        if (infoBox) infoBox.innerHTML += `<br><span style="color:red">Erreur: ${e.message}</span>`;
    }
}


function renderTable() {
    const tbody = document.getElementById('bookings-table');

    if (allBookings.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">Aucune réservation trouvée</td></tr>
        `;
        return;
    }

    tbody.innerHTML = allBookings.map(b => `
        <tr>
            <td style="font-family: monospace; font-size: 0.8rem;">${b.id.substring(0, 8)}...</td>
            <td>
                ${b.passengerName}
                <span class="channel-badge ${b.saleChannel || 'counter'}">${getChannelLabel(b.saleChannel)}</span>
            </td>
            <td>${b.phone}</td>
            <td>
                <div style="font-weight:500;">${b.departure.origin} → ${b.departure.destination}</div>
                <div style="font-size:0.75rem; color: #888;">${formatDateTime(b.departure.date || b.departure.time)}</div>
            </td>
            <td>${b.seats}</td>
            <td style="font-weight: 600;">
                ${formatPrice(b.amount)}
                ${(b.amountPaid !== undefined && b.amountPaid < b.amount && b.status !== 'cancelled') ? `<div style="font-size:0.7rem; color:var(--error);">Reste: ${formatPrice(b.amount - b.amountPaid)}</div>` : ''}
            </td>
            <td>
                <span class="badge ${getStatusClass(b.status)}">${getStatusLabel(b.status)}</span>
                ${(b.status === 'cancelled' && b.isRefundable) ? '<div style="margin-top:2px; font-size:0.65rem; color:var(--success); border:1px solid var(--success); border-radius:4px; padding:1px 4px; display:inline-block;">Remboursable</div>' : ''}
                ${(b.status === 'cancelled' && !b.isRefundable) ? '<div style="margin-top:2px; font-size:0.65rem; color:var(--text-muted); background:var(--surface-alt); border-radius:4px; padding:1px 4px; display:inline-block;">Non Remb.</div>' : ''}
                
                ${(b.refundStatus === 'requested') ? '<div style="margin-top:2px; font-size:0.65rem; background:orange; color:white; border-radius:4px; padding:1px 4px; display:inline-block;">Demande Remb.</div>' : ''}
                ${(b.refundStatus === 'refunded') ? '<div style="margin-top:2px; font-size:0.65rem; background:var(--success); color:white; border-radius:4px; padding:1px 4px; display:inline-block;">Remboursé</div>' : ''}
            </td>
            <td>
                <div style="display:flex; gap:4px;">
                    ${b.status !== 'cancelled' ? `
                        <button class="btn-icon transfer-btn" data-id="${b.id}" title="Transférer" style="color: var(--info); background:none; border:none; cursor:pointer; font-size:1.1rem;">
                            ⇄
                        </button>
                        <button class="btn-icon cancel-btn" data-id="${b.id}" title="Annuler" style="color: var(--error); background:none; border:none; cursor:pointer; font-size:1.1rem;">
                             &times;
                        </button>
                    ` : `
                        <button class="btn-icon restore-btn" data-id="${b.id}" title="Restaurer" style="color: var(--success); background:none; border:none; cursor:pointer; font-size:1.1rem;">
                            ♻️
                        </button>
                        ${(isSuperAdmin() || isManager()) ? `
                        <button class="btn-icon delete-btn" data-id="${b.id}" title="Supprimer définitivement" style="color: #666; background:none; border:none; cursor:pointer; font-size:1.1rem;">
                            🗑️
                        </button>` : ''}
                    `}
                    
                    ${(b.amountPaid > 0 && b.refundStatus !== 'refunded') ? `
                        <button class="btn-icon refund-btn" data-id="${b.id}" title="Rembourser" style="color: #d97706; background:none; border:none; cursor:pointer; font-size:1.1rem;">
                            💰
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');

    // Add event listeners
    // Transfer
    tbody.querySelectorAll('.transfer-btn').forEach(btn => {
        // ... (handled by parent delegator usually, but here checking existing code)
    });

    // Restore
    // Restore
    tbody.querySelectorAll('.restore-btn').forEach(btn => {
        btn.onclick = async () => {
            if (!await window.showConfirm("Restauration", 'Voulez-vous restaurer cette réservation ? (Vérification des places...)', 'Restaurer')) return;
            try {
                await updateBookingStatus(btn.dataset.id, 'confirmed');
                await window.showAlert("Succès", 'Réservation restaurée avec succès', "success");
                loadBookings(document.getElementById('booking-search').value, currentPage);
            } catch (error) {
                await window.showAlert("Erreur", `Impossible de restaurer : ${error.message}`, "error");
            }
        };
    });

    // Delete
    tbody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = async () => {
            if (!await window.showConfirm("Suppression", 'ATTENTION: Supprimer définitivement cette réservation ?', 'Supprimer', 'Annuler')) return;
            try {
                await deleteBooking(btn.dataset.id);
                await window.showAlert("Succès", 'Réservation supprimée', "success");
                loadBookings(document.getElementById('booking-search').value, currentPage);
            } catch (error) {
                await window.showAlert("Erreur", error.message, "error");
            }
        };
    });

    // Refund
    tbody.querySelectorAll('.refund-btn').forEach(btn => {
        btn.onclick = async () => {
            if (!await window.showConfirm("Remboursement", 'Confirmer le remboursement manuel de ce billet ? (Action irréversible)', 'Rembourser')) return;
            try {
                await refundBooking(btn.dataset.id);

                await window.showAlert("Succès", 'Remboursement enregistré', "success");
                loadBookings(document.getElementById('booking-search').value, currentPage);
            } catch (error) {
                await window.showAlert("Erreur", error.message, "error");
            }
        };
    });
}

// Helpers
function formatPrice(amount) {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch { return dateStr; }
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
}

function getStatusClass(status) {
    const classes = { 'confirmed': 'success', 'pending': 'warning', 'cancelled': 'error', 'pending_payment': 'warning' };
    return classes[status] || 'info';
}

function getStatusLabel(status) {
    const labels = { 'confirmed': 'Confirmée', 'pending': 'En attente', 'cancelled': 'Annulée', 'pending_payment': 'Paiement partiel' };
    return labels[status] || status;
}

function getChannelLabel(channel) {
    const labels = { 'online': '📱', 'counter': '🏢', 'phone': '📞' };
    return labels[channel] || '🏢';
}
