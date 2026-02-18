/**
 * Departure Details View with Mapbox
 * SYNCHRONIZED with departure-details.html
 */

import { getDepartureById, getDriverPosition, updateDeparture, createBooking, createParcel, getBookings, getParcels, transferBooking, getDepartures, deleteBooking, updateBookingStatus, API_BASE_URL, apiCall } from '../../js/services/api.js';
import { Mapbox3DManager } from '../../utils/mapbox/mapbox-3D.js';
import { getCurrentUser, canAccessAgency, isManager } from '../../js/utils/user-state.js';
import { printManifestPDF } from '../../js/utils/export-utils.js';
import { CONFIG } from '../../js/config.js';
import { Cache } from '../../js/services/cache.js';


// Mapbox access token
const MAPBOX_TOKEN = CONFIG.mapboxToken;

let mapManager = null;
let positionInterval = null;
let currentDeparture = null;
let currentManifest = []; // Manifest data
let currentParcels = []; // Parcels data
let bookingToTransferId = null;

// Coordonnées des villes camerounaises
const CITY_COORDS = {
    'Yaoundé': [11.5021, 3.8480],
    'Douala': [9.7679, 4.0511],
    'Bafoussam': [10.4175, 5.4764],
    'Garoua': [13.3972, 9.3015],
    'Kribi': [9.9075, 2.9404],
    'Bamenda': [10.1591, 5.9631],
    'Maroua': [14.3159, 10.5915],
    'Ngaoundéré': [13.5847, 7.3217],
    'Edéa': [10.1333, 3.8000],
    'Pouma': [10.5167, 3.8500]
};

// Styles Mapbox
const styles = {
    streets: CONFIG.mapboxStyleStandard,
    franckyCustom: CONFIG.currentMapStyle
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export function init(params) {
    const departureId = Array.isArray(params) ? params[0] : params;

    if (!departureId) {
        window.location.hash = '#/departures';
        return;
    }

    // SWR Calls
    // 1. Departure Info
    Cache.swr(`departure_${departureId}`, () => getDepartureById(departureId), (dep) => {
        if (!dep) {
            window.showAlert('Erreur', 'Départ non trouvé', 'error');
            return;
        }
        currentDeparture = dep;
        renderDetails();
        renderSeats(); // Render empty seats or current state

        // Map Visibility and Initialization
        const mapCard = document.getElementById('map-card');
        if (currentDeparture.status === 'in_progress') {
            if (mapCard) mapCard.style.display = 'block';
            if (!mapManager) {
                initMap();
            }
        } else {
            if (mapCard) mapCard.style.display = 'none';
            if (mapManager) {
                if (positionInterval) clearInterval(positionInterval);
                mapManager.destroy();
                mapManager = null;
            }
        }
    });

    // 2. Manifest (Bookings)
    Cache.swr(`departure_manifest_${departureId}`, () => getBookings({
        departureId: departureId,
        limit: 500,
        status: 'all'
    }), (data) => {
        // Handle both simple array or wrapped data
        const list = Array.isArray(data) ? data : (data.data || []);
        currentManifest = list.map(b => {
            // Basic mapping to keep internal format consistent
            // If data comes from getBookings, it has specific fields
            // We need to map it to what renderManifest expects
            // Or better, update renderManifest to handle API response directly
            // For now, let's assume API response is compatible or map it here:
            return {
                id: b.id,
                name: b.passengerName,
                phone: b.phone,
                dest: b.departure ? b.departure.destination : '?',
                seats: b.seats,
                seatStart: b.seatNumber || b.seatStart || 1, // Fallback
                seatEnd: (b.seatNumber || 1) + (b.seats || 1) - 1,
                price: b.amount,
                paid: b.amountPaid >= b.amount,
                status: b.status
            };
        });
        renderManifest();
        renderSeats();
    });

    // 3. Parcels
    Cache.swr(`departure_parcels_${departureId}`, () => getParcels({ departureId: departureId }), onParcelsLoaded);

    setupModalEvents();
    setupPrintButton();
}

/**
 * Reload all departure data (info + manifest + parcels) after a mutation.
 * Replaces the old loadDeparture() that was removed during SWR refactor.
 */
function reloadAll() {
    if (!currentDeparture) return;
    const id = currentDeparture.id;

    // Clear relevant caches so SWR fetches fresh data
    Cache.clear(`departure_${id}`);
    Cache.clear(`departure_manifest_${id}`);
    Cache.clear(`departure_parcels_${id}`);

    // Re-init everything
    init([id]);
}

function setupPrintButton() {
    const btnPrint = document.getElementById('btn-print-manifest');
    if (btnPrint) {
        // Remove old listener to avoid duplicates if re-init? 
        // Better: use named function or check if listener attached. 
        // For simplicity in SWR refactor, simple addEventListener is fine as init replaces DOM or view
        btnPrint.onclick = async () => {
            // Exclude pending/cancelled for the official manifest
            const validPax = currentManifest.filter(p => p.status !== 'cancelled' && p.status !== 'pending_payment');
            const validParcels = currentParcels.filter(p => p.status !== 'cancelled');
            const user = getCurrentUser();

            // Fetch Branding (Global Config) - Cache this too ideally
            let brandName = "INTERCITY";
            try {
                const res = await apiCall('/settings/global');
                if (res && res.companyName) {
                    brandName = res.companyName;
                }
            } catch (e) { console.warn('Erreur chargement branding', e); }

            printManifestPDF(currentDeparture, validPax, validParcels, user, brandName);
        };
    }
}

// Separate Render Functions for SWR callbacks
// renderManifest adapter removed (logic moved to inline callback)


function onParcelsLoaded(response) {
    const parcels = Array.isArray(response) ? response : (response.data || []);

    currentParcels = parcels.map(p => ({
        id: p.id,
        senderName: p.sender.name,
        senderPhone: p.sender.phone,
        recipientName: p.recipient.name,
        recipientPhone: p.recipient.phone,
        destination: p.destination,
        price: p.price,
        description: p.description,
        status: p.status
    }));

    renderParcels();
}

// Deprecated Async Loaders removed


// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

function renderDetails() {
    const d = currentDeparture;

    // Helper to safely set text content
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    // ACCESS CONTROL CHECK
    // Debug
    console.log('[Details] Access Check:', {
        role: getCurrentUser().role,
        isManager: isManager(),
        depAgencyId: d.agencyId,
        canAccess: d.agencyId ? canAccessAgency(d.agencyId) : 'N/A'
    });

    // If Manager and not their agency -> Show Warning
    if (isManager() && d.agencyId && !canAccessAgency(d.agencyId)) {
        const header = document.querySelector('.page-header');
        if (header && !document.getElementById('agency-warning-banner')) {
            const banner = document.createElement('div');
            banner.id = 'agency-warning-banner';
            banner.style.cssText = 'background: #fff3cd; color: #856404; padding: 12px 20px; margin-bottom: 20px; border-radius: 8px; display: flex; align-items: center; border: 1px solid #ffeeba;';
            banner.innerHTML = `
                <svg style="width:20px;height:20px;margin-right:10px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <strong>Mode Lecture Seule :</strong>&nbsp;Vous ne gérez pas cette agence (${d.agencyName || 'Agence externe'}).
            `;
            header.parentNode.insertBefore(banner, header.nextSibling);

            // Disable Actions
            document.querySelectorAll('button:not([onclick="history.back()"])').forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.title = "Action non autorisée (Agence externe)";
            });
        }
    }

    // Page Header
    setText('page-title', `${d.origin} → ${d.destination}`);
    setText('page-subtitle', `${formatDate(d.date)} à ${d.departureTime}`);

    const badge = document.getElementById('status-badge');
    if (badge) {
        badge.className = `badge ${getStatusClass(d.status)}`;
    }

    renderStatusActions(d);

    // Trip Info (matching HTML IDs)
    setText('info-origin', d.origin);
    setText('info-destination', d.destination);
    setText('info-departure-time', d.departureTime);

    // Driver Info
    setText('driver-avatar', getInitials(d.driverName));
    setText('driver-name', d.driverName);
    setText('driver-vehicle', d.vehicleType || 'Bus Standard');

    // Passengers count
    const capacity = d.vehicleCapacity || d.totalSeats;
    setText('passengers-count', `${d.bookedSeats}/${capacity}`);
}

function renderSeats() {
    const container = document.getElementById('seats-visual');
    if (!container) return;

    const occupiedSeats = new Map(); // seatIndex -> booking

    currentManifest
        .filter(p => p.status !== 'cancelled' && p.status !== 'pending_payment')
        .forEach(p => {
            for (let i = p.seatStart; i <= p.seatEnd; i++) {
                occupiedSeats.set(i, p);
            }
        });

    const seats = [];
    const capacity = currentDeparture.vehicleCapacity || currentDeparture.totalSeats;
    for (let i = 1; i <= capacity; i++) {
        const pax = occupiedSeats.get(i);
        const isBooked = !!pax;
        const title = pax ? `${pax.name} (${pax.dest})` : `Siège ${i} - Libre`;
        seats.push(`<div class="seat ${isBooked ? 'booked' : ''}" title="${title}">${i}</div>`);
    }

    container.innerHTML = seats.join('');
}

// ============================================================================
// MANIFEST FUNCTIONS
// ============================================================================

function initMockManifest(departure) {
    // Deprecated in favor of loadDeparture
}

function renderManifest() {
    const tbody = document.getElementById('manifest-table');
    if (!tbody) return;

    // Calculate finances and seats
    if (!currentDeparture) return;

    // Exclude 'pending_payment' as per user request (considered invalid/spam)
    const activePassengers = currentManifest.filter(p => p.status !== 'cancelled' && p.status !== 'pending_payment');
    const totalRevenue = activePassengers.reduce((sum, p) => sum + p.price, 0);
    const paidRevenue = activePassengers.filter(p => p.paid).reduce((sum, p) => sum + p.price, 0);
    const totalBookedSeats = activePassengers.reduce((sum, p) => sum + p.seats, 0);

    // Update stats
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    const capacity = currentDeparture.vehicleCapacity || currentDeparture.totalSeats;
    setText('passengers-count', `${totalBookedSeats}/${capacity}`);
    setText('stat-revenue', formatPrice(totalRevenue));
    setText('stat-paid', formatPrice(paidRevenue));

    // Render table rows
    // Filter out pending_payment completely from display
    const visiblePassengers = currentManifest.filter(p => p.status !== 'pending_payment');

    tbody.innerHTML = visiblePassengers.map(p => {
        const isDimmed = p.status === 'cancelled';
        return `
        <tr class="${isDimmed ? 'row-dimmed' : ''}">
            <td><span class="seat-badge ${p.status}">${p.seats > 1 ? p.seats + ' Places' : 'Standard'}</span></td>
            <td>
                <div class="font-medium">${p.name}</div>
                <div class="text-xs text-muted">${p.phone}</div>
                ${p.seats > 1 ? `<div class="badge-pill small" style="margin-top:2px">${p.seats} places</div>` : ''}
            </td>
            <td>${p.dest}</td>
            <td>
                ${formatPrice(p.price)}
                ${p.paid ? '<span class="icon-paid" title="Payé">✓</span>' : '<span class="icon-unpaid" title="Non payé">⚠</span>'}
            </td>
            <td><span class="status-pill ${p.status}">${getManifestStatusText(p.status)}</span></td>
            <td>
                <div class="action-buttons">
                    ${p.status !== 'cancelled' ? `
                    <button class="btn-icon primary" title="Transférer" data-action="transfer" data-id="${p.id}" data-name="${p.name}">↗ Transf.</button>
                    <button class="btn-icon danger" title="Annuler" data-action="cancel" data-seat="${p.seat}">✕</button>
                    ` : `
                    <button class="btn-icon success" title="Restaurer" data-action="restore" data-id="${p.id}">♻️</button>
                    <button class="btn-icon secondary" title="Supprimer" data-action="delete" data-id="${p.id}">🗑️</button>
                    `}
                </div>
            </td>
        </tr>
        `;
    }).join('');

    // Add event listeners for action buttons
    tbody.querySelectorAll('[data-action="transfer"]').forEach(btn => {
        btn.addEventListener('click', () => openTransferModal(btn.dataset.id, btn.dataset.name));
    });

    tbody.querySelectorAll('[data-action="restore"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const confirmed = await window.showConfirm('Restaurer', 'Restaurer ce passager ? (Vérifie la place libre)');
            if (confirmed) {
                try {
                    await updateBookingStatus(btn.dataset.id, 'confirmed');
                    window.showAlert('Succès', 'Passager restauré', 'success');
                    reloadAll();
                } catch (e) {
                    window.showAlert('Erreur', e.message, 'error');
                }
            }
        });
    });

    tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const confirmed = await window.showConfirm('Supprimer', 'Supprimer définitivement ce passager ?');
            if (confirmed) {
                try {
                    await deleteBooking(btn.dataset.id);
                    window.showAlert('Succès', 'Passager supprimé', 'success');
                    reloadAll();
                } catch (e) {
                    window.showAlert('Erreur', e.message, 'error');
                }
            }
        });
    });

    // Cancel/remove passenger
    tbody.querySelectorAll('[data-action="cancel"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const seat = parseInt(btn.dataset.seat);
            const pax = currentManifest.find(p => p.seat === seat);
            if (pax) {
                const confirmed = await window.showConfirm('Annulation', `Annuler le billet de ${pax.name} ?`);
                if (confirmed) {
                    // In real API: await api.cancelTicket(pax.id)
                    pax.status = 'cancelled';
                    currentDeparture.bookedSeats--;
                    renderManifest();
                }
            }
        });
    });
}

function getManifestStatusText(status) {
    const texts = { confirmed: 'Confirmé', pending: 'Attente', cancelled: 'Annulé' };
    return texts[status] || status;
}

// ============================================================================
// PARCELS FUNCTIONS
// ============================================================================

function initMockParcels(departure) {
    // Deprecated
}

function renderParcels() {
    const tbody = document.getElementById('parcels-table');
    if (!tbody) return;

    const activeParcels = currentParcels.filter(p => p.status !== 'cancelled');

    // Calculate Parcel Finances
    const totalParcelRevenue = activeParcels.reduce((sum, p) => sum + (p.price || 0), 0);
    // Assuming parcels are paid on registration for now (can refine later if paid status exists)
    const paidParcelRevenue = totalParcelRevenue;

    // Update Parcel Stats UI
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    setText('stat-parcel-revenue', formatPrice(totalParcelRevenue));
    setText('stat-parcel-paid', formatPrice(paidParcelRevenue));
    setText('parcels-count', activeParcels.length);

    // Render table rows
    tbody.innerHTML = currentParcels.map(p => `
        <tr class="${p.status === 'cancelled' ? 'row-dimmed' : ''}">
            <td>
                <div>${p.senderName}</div>
                <div class="contact-info">${p.senderPhone}</div>
            </td>
            <td>
                <div>${p.recipientName}</div>
                <div class="contact-info">${p.recipientPhone}</div>
            </td>
            <td>${formatPrice(p.price)}</td>
            <td><span class="status-pill ${p.status}">${getManifestStatusText(p.status)}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon primary" data-action="transfer-parcel" data-id="${p.id}">↗</button>
                    <button class="btn-icon danger" data-action="cancel-parcel" data-id="${p.id}">✕</button>
                </div>
            </td>
        </tr>
    `).join('');

    // Add event listeners
    tbody.querySelectorAll('[data-action="cancel-parcel"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = parseInt(btn.dataset.id);
            const parcel = currentParcels.find(p => p.id === id);
            if (parcel) {
                const confirmed = await window.showConfirm('Annulation', `Annuler le colis de ${parcel.senderName} ?`);
                if (confirmed) {
                    parcel.status = 'cancelled';
                    renderParcels();
                }
            }
        });
    });
}


function renderStatusActions(d) {
    const container = document.getElementById('status-actions');
    if (!container) return;

    container.innerHTML = '';

    if (d.status === 'pending') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary small';
        btn.innerHTML = `
            <svg class="icon-svg" style="width:16px;height:16px;margin-right:4px" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></svg>
            Marquer comme Parti
        `;
        btn.onclick = () => updateStatus('in_progress');
        container.appendChild(btn);
    } else if (d.status === 'in_progress') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-success small';
        btn.style.backgroundColor = 'var(--success)'; // Inline style for reliability
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.innerHTML = `
            <svg class="icon-svg" style="width:16px;height:16px;margin-right:4px" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            Marquer comme Arrivé
        `;
        btn.onclick = () => updateStatus('completed');
        container.appendChild(btn);
    }
}

async function updateStatus(newStatus) {
    if (!currentDeparture) return;

    const confirmMsg = newStatus === 'in_progress' ? 'Confirmer le départ du véhicule ?' : 'Confirmer l\'arrivée à destination ?';

    // Use custom confirm logic
    const confirmed = await window.showConfirm('Confirmation', confirmMsg);
    if (!confirmed) return;

    try {
        await updateDeparture(currentDeparture.id, { status: newStatus });

        // Refresh data
        await reloadAll();

        const label = newStatus === 'in_progress' ? 'Trajet démarré' : 'Trajet terminé';
        // Use standard alert if available, or just console
        if (window.showAlert) window.showAlert('Succès', label, 'success');

    } catch (error) {
        console.error('Update failed:', error);
        if (window.showAlert) window.showAlert('Erreur', 'Mise à jour échouée', 'error');
    }
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

function setupModalEvents() {
    const sellModal = document.getElementById('modal-sell-ticket');
    const transferModal = document.getElementById('modal-transfer');

    // Open Sell Ticket Modal
    const btnSell = document.getElementById('btn-sell-ticket');
    if (btnSell && sellModal) {
        btnSell.addEventListener('click', () => {
            // Reset form
            const resetField = (id, val = '') => {
                const el = document.getElementById(id);
                if (el) el.value = val;
            };

            resetField('ticket-client-name');
            resetField('ticket-client-phone');
            resetField('ticket-destination', currentDeparture.destination);
            resetField('ticket-price', currentDeparture.price);

            const prepaid = document.getElementById('ticket-prepaid');
            if (prepaid) prepaid.checked = false;

            // Populate available seats
            const seatSelect = document.getElementById('ticket-seat-select');
            if (seatSelect) {
                const occupiedSeats = currentManifest.filter(p => p.status !== 'cancelled').map(p => p.seat);
                seatSelect.innerHTML = '<option value="">Choisir siège...</option>';
                const capacity = currentDeparture.vehicleCapacity || currentDeparture.totalSeats;
                for (let i = 1; i <= capacity; i++) {
                    if (!occupiedSeats.includes(i)) {
                        seatSelect.innerHTML += `<option value="${i}">Siège ${i}</option>`;
                    }
                }
            }

            sellModal.classList.add('active');
        });
    }

    // Confirm Sell
    const btnConfirmSell = document.getElementById('btn-confirm-sell');
    if (btnConfirmSell) {
        btnConfirmSell.addEventListener('click', async () => {
            const getValue = (id) => {
                const el = document.getElementById(id);
                return el ? el.value : '';
            };

            const name = getValue('ticket-client-name');
            const phone = getValue('ticket-client-phone');
            const seat = parseInt(getValue('ticket-seat-select'));
            const dest = getValue('ticket-destination');
            const price = parseInt(getValue('ticket-price')) || 0;
            const paid = document.getElementById('ticket-prepaid')?.checked || false;

            if (!name || !dest) {
                window.showAlert('Formulaire incomplet', 'Veuillez remplir nom et destination.', 'warning');
                return;
            }

            try {
                await createBooking({
                    departureId: currentDeparture.id,
                    passengerName: name,
                    phone: phone,
                    seats: 1, // Logic implies 1 seat per form
                    amount: price,
                    status: 'confirmed'
                });

                // Optimistic Update or Refresh
                await reloadAll();

                if (sellModal) sellModal.classList.remove('active');
                window.showAlert('Succès', 'Billet émis et enregistré', 'success');
            } catch (error) {
                console.error(error);
                window.showAlert('Erreur', error.message || 'Échec émission billet', 'error');
            }
        });
    }

    // Confirm Transfer
    const btnConfirmTransfer = document.getElementById('btn-confirm-transfer');
    if (btnConfirmTransfer) {
        btnConfirmTransfer.onclick = async () => {
            const select = document.getElementById('transfer-dep-select');
            const newDepartureId = select.value;
            // We need to know which booking we are transferring. 
            // We stored it in a closure or global variable? 
            // `openTransferModal` sets it. Let's ensure we track it.
            if (!bookingToTransferId || !newDepartureId) return;

            btnConfirmTransfer.innerText = 'Patientez...';
            btnConfirmTransfer.disabled = true;

            try {
                await transferBooking(bookingToTransferId, newDepartureId);

                await window.showAlert('Succès', 'Passager transféré avec succès', 'success');

                // Reload
                const overlay = document.getElementById('modal-transfer');
                if (overlay) overlay.classList.remove('active');
                init([currentDeparture.id]); // Reload all

            } catch (e) {
                console.error(e);
                await window.showAlert('Erreur', e.message, 'error');
            } finally {
                btnConfirmTransfer.innerText = 'Confirmer Transfert';
                btnConfirmTransfer.disabled = false;
                bookingToTransferId = null;
                btnConfirmTransfer.innerText = 'Confirmer Transfert';
                btnConfirmTransfer.disabled = false;
            }
        };
    }


    // ---- PARCEL MODAL ----
    const parcelModal = document.getElementById('modal-add-parcel');
    const btnAddParcel = document.getElementById('btn-add-parcel');

    if (btnAddParcel && parcelModal) {
        btnAddParcel.addEventListener('click', () => {
            ['parcel-sender-name', 'parcel-sender-phone', 'parcel-recipient-name',
                'parcel-recipient-phone', 'parcel-destination', 'parcel-price', 'parcel-description']
                .forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
            parcelModal.classList.add('active');
        });
    }

    const btnConfirmParcel = document.getElementById('btn-confirm-parcel');
    if (btnConfirmParcel) {
        btnConfirmParcel.addEventListener('click', async () => {
            const getValue = (id) => document.getElementById(id)?.value || '';

            const senderName = getValue('parcel-sender-name');
            const senderPhone = getValue('parcel-sender-phone');
            const recipientName = getValue('parcel-recipient-name');
            const recipientPhone = getValue('parcel-recipient-phone');
            const destination = getValue('parcel-destination');
            const price = parseInt(getValue('parcel-price')) || 0;
            const description = getValue('parcel-description');

            if (!senderName || !recipientName || !destination) {
                window.showAlert('Erreur', 'Veuillez remplir expéditeur, destinataire et destination.', 'warning');
                return;
            }

            try {
                await createParcel({
                    sender: { name: senderName, phone: senderPhone },
                    recipient: { name: recipientName, phone: recipientPhone },
                    origin: currentDeparture.origin,
                    destination: destination,
                    departureId: currentDeparture.id,
                    price: price,
                    description: description
                });

                await reloadAll();

                if (parcelModal) parcelModal.classList.remove('active');
                window.showAlert('Succès', 'Colis enregistré', 'success');
            } catch (error) {
                console.error(error);
                window.showAlert('Erreur', 'Impossible d\'enregistrer le colis', 'error');
            }
        });
    }

    // Close modals
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const overlay = e.target.closest('.modal-overlay');
            if (overlay) overlay.classList.remove('active');
        });
    });
}

async function openTransferModal(paxId, paxName) {
    if (bookingToTransferId !== null && bookingToTransferId !== paxId) {
        // Warning? Overwrite.
    }
    bookingToTransferId = paxId;

    // Find the booking to get seat count
    const booking = currentManifest.find(b => b.id === paxId);
    const seatsNeeded = booking ? (booking.seats || 1) : 1;

    const modal = document.getElementById('modal-transfer');
    const nameEl = document.getElementById('transfer-pax-name');
    if (nameEl) nameEl.textContent = `${paxName} (${seatsNeeded} place${seatsNeeded > 1 ? 's' : ''})`;

    const select = document.getElementById('transfer-dep-select');
    if (select) {
        select.innerHTML = '<option>Chargement...</option>';
        select.disabled = true;
    }

    const btn = document.getElementById('btn-confirm-transfer');
    if (btn) btn.disabled = true;

    if (modal) modal.classList.add('active');

    // Debug Info Box
    const infoBox = document.getElementById('transfer-info-box');
    if (infoBox) {
        infoBox.style.display = 'block';
        infoBox.innerHTML = `Trajet actuel: <b>${currentDeparture.origin} → ${currentDeparture.destination}</b> (${formatDate(currentDeparture.date)})`;
    }

    if (!select) return;

    try {
        const origin = currentDeparture.origin;
        const dest = currentDeparture.destination;

        // Use same logic as bookings.js
        const departures = await getDepartures({});

        // Normalize
        const normalize = (str) => (str || '').toString().toLowerCase().trim();
        const currentOrigin = normalize(origin);
        const currentDest = normalize(dest);

        if (departures.length === 0) {
            select.innerHTML = '<option disabled>Aucun départ trouvé</option>';
            return;
        }

        const compatible = [];
        const others = [];

        departures.forEach(d => {
            if (d.id === currentDeparture.id) return; // Skip current

            const sameOrigin = normalize(d.origin) === currentOrigin;
            const sameDest = normalize(d.destination) === currentDest;
            const isAvailableStatus = ['pending', 'scheduled', 'active', 'in_progress'].includes(d.status);

            // Capacity Check
            const capacity = d.vehicleCapacity || d.totalSeats || 0;
            const booked = d.bookedSeats || 0;
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
                        [${warning}] ${formatDate(d.date)} ${d.departureTime} - ${formatPrice(d.price)}
                    </option>
                 `;
            }).join('');
            html += `</optgroup>`;
        }

        select.innerHTML = html;
        select.disabled = false;
        if (btn) btn.disabled = false;

    } catch (e) {
        console.error(e);
        select.innerHTML = '<option disabled>Erreur de chargement</option>';
    }
}

// ============================================================================
// MAP FUNCTIONS
// ============================================================================

const ICONS = {
    bus: '<img src="images/vehicles/bus.png" style="width:60px;height:60px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));">',
    minibus: '<img src="images/vehicles/minibus.png" style="width:50px;height:50px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));">',
    van: '<img src="images/vehicles/van.png" style="width:45px;height:45px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3)); transform: scaleX(-1);">'
};

function getVehicleIcon(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('van') || t.includes('hiace')) return ICONS.van;
    if (t.includes('mini') || t.includes('coaster')) return ICONS.minibus;
    return ICONS.bus;
}

function initMap() {
    if (mapManager) return;

    // Fix: Normalize keys for lookup
    const normalize = str => (str || '').trim().toLowerCase();

    // Find coords case-insensitive
    const findCoords = (city) => {
        const key = Object.keys(CITY_COORDS).find(k => normalize(k) === normalize(city));
        if (key) return CITY_COORDS[key];

        // Extended fallback to common variants if needed
        return null; // Don't default yet
    };

    // Use coordinates from API or fallback
    const originCoords = (currentDeparture.originLat && currentDeparture.originLng)
        ? [currentDeparture.originLng, currentDeparture.originLat]
        : (findCoords(currentDeparture.origin) || [11.5021, 3.8480]); // Yaoundé fallback

    const destCoords = (currentDeparture.destLat && currentDeparture.destLng)
        ? [currentDeparture.destLng, currentDeparture.destLat]
        : (findCoords(currentDeparture.destination) || [9.7679, 4.0511]); // Douala fallback

    // Fix: Fallback to origin if current position is missing or zero (user reported fixed/wrong position)
    // IMPORTANT: If currentLat/Lng matches origin (fallback from backend) or is 0, we trust it.
    let driverPos;
    if (currentDeparture.currentLng && currentDeparture.currentLat && currentDeparture.currentLng !== 0 && currentDeparture.currentLat !== 0) {
        driverPos = [currentDeparture.currentLng, currentDeparture.currentLat];
    } else {
        // If live pos invalid, strictly use origin
        driverPos = originCoords;
    }

    mapManager = new Mapbox3DManager({
        mapboxToken: MAPBOX_TOKEN,
        containerId: 'map',
        defaultCenter: driverPos,
        defaultZoom: 11,
        style: styles.franckyCustom,
        enable3DByDefault: true,
        autoCenter: false
    });

    const map = mapManager.map;

    map.on('load', async () => {
        const routeData = await loadRouteData(originCoords, destCoords);

        if (routeData) {
            mapManager.addRoute('trip-route', routeData.geometry.coordinates, {
                color: '#f59e0b', width: 5, opacity: 0.8, show3D: false
            });
            updateETAUI(routeData.duration, routeData.distance);

            const bounds = new mapboxgl.LngLatBounds();
            bounds.extend(originCoords);
            bounds.extend(destCoords);
            bounds.extend(driverPos);
            map.fitBounds(bounds, { padding: 80, pitch: 45 });
        }

        new mapboxgl.Marker({ color: '#10b981' }).setLngLat(originCoords).addTo(map);
        new mapboxgl.Marker({ color: '#ef4444' }).setLngLat(destCoords).addTo(map);

        // Fix: Use correct vehicle image instead of emoji
        const vehicleType = currentDeparture.vehicleType || 'bus';
        mapManager.addVehicle(currentDeparture.driverId, driverPos, {
            type: vehicleType,
            label: currentDeparture.driverName,
            popupContent: `<p>Plaque: ${currentDeparture.vehiclePlate}</p>`,
            customIcon: getVehicleIcon(vehicleType)
        });

        startPositionUpdates();
    });
}

async function loadRouteData(origin, destination) {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.routes?.[0] || null;
    } catch (error) {
        console.error('Error loading route:', error);
        return null;
    }
}

function startPositionUpdates() {
    positionInterval = setInterval(async () => {
        const pos = await getDriverPosition(currentDeparture.driverId);
        // Ensure strictly valid coordinates (non-null, non-zero)
        if (pos && pos.lat && pos.lng && mapManager) {
            mapManager.updateVehiclePosition(currentDeparture.driverId, [pos.lng, pos.lat]);
            updateETAFromPosition(pos.lng, pos.lat);
        }
    }, 5000);
}

async function updateETAFromPosition(lng, lat) {
    const destCoords = (currentDeparture.destLat && currentDeparture.destLng)
        ? [currentDeparture.destLng, currentDeparture.destLat]
        : (CITY_COORDS[currentDeparture.destination] || [9.7679, 4.0511]);

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${lng},${lat};${destCoords[0]},${destCoords[1]}?access_token=${MAPBOX_TOKEN}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.routes?.[0]) {
            updateETAUI(data.routes[0].duration, data.routes[0].distance);
        }
    } catch (error) {
        console.error('Error fetching ETA:', error);
    }
}

function updateETAUI(durationSeconds, distanceMeters) {
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const timeStr = hours > 0 ? `${hours}h ${minutes}min` : `${minutes} min`;
    const distanceStr = `${(distanceMeters / 1000).toFixed(1)} km`;
    const arrival = new Date(Date.now() + durationSeconds * 1000);
    const arrivalStr = arrival.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setText('eta-time', timeStr);
    setText('eta-distance', distanceStr);
    setText('eta-arrival', arrivalStr);
}

// Cleanup on view change
window.addEventListener('hashchange', () => {
    if (positionInterval) {
        clearInterval(positionInterval);
        positionInterval = null;
    }
    if (mapManager) {
        mapManager.destroy();
        mapManager = null;
    }
    currentManifest = []; // Reset for next load
    currentParcels = []; // Reset for next load
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatPrice(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

function getInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function getStatusClass(status) {
    const classes = { 'in_progress': 'warning', 'pending': 'info', 'completed': 'success' };
    return classes[status] || 'info';
}

function getStatusLabel(status) {
    const labels = { 'in_progress': 'En cours', 'pending': 'À venir', 'completed': 'Terminé' };
    return labels[status] || status;
}
