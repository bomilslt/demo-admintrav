/**
 * Dashboard View
 */

import { getStats, getActiveTrips, getRecentBookings } from '../../js/services/api.js';
import { Cache } from '../../js/services/cache.js';

import { isSuperAdmin, isManager } from '../../js/utils/user-state.js';

export function init() {
    // SWR Pattern: Fire and Forget (don't await)
    // The Cache service handles the duplicate rendering (Instant -> Update)

    // 1. Stats
    Cache.swr('dashboard_stats', getStats, renderStats);

    // 2. Active Trips
    Cache.swr('dashboard_active_trips', getActiveTrips, renderActiveTrips);

    // 3. Recent Bookings
    // Note: getRecentBookings accepts a limit, we pass a closure or bind
    Cache.swr('dashboard_recent_bookings', () => getRecentBookings(5), renderRecentBookings);
}

function renderStats(stats) {
    if (!stats) return;

    // RBAC: Revenue visible only to Manager and SuperAdmin
    const canViewRevenue = isSuperAdmin() || isManager();

    if (canViewRevenue) {
        // Total Revenue (Today)
        setText('stat-revenue', formatPrice(stats.todayRevenue || 0));
        setText('stat-revenue-change', `${stats.revenueChange >= 0 ? '+' : ''}${stats.revenueChange}% vs hier`);

        // Cash & Digital
        setText('stat-revenue-cash', formatPrice(stats.cashRevenue || 0));
        setText('stat-revenue-digital', formatPrice(stats.digitalRevenue || 0));

        // Ensure visibility
        const revCard = document.getElementById('stat-revenue')?.closest('.stat-card');
        if (revCard) revCard.style.display = 'block';

        const cashCard = document.getElementById('stat-revenue-cash')?.closest('.stat-card');
        if (cashCard) cashCard.style.display = 'block';

        const digitalCard = document.getElementById('stat-revenue-digital')?.closest('.stat-card');
        if (digitalCard) digitalCard.style.display = 'block';

    } else {
        // Hide revenue info for agents
        setText('stat-revenue', '---');
        setText('stat-revenue-change', '');
        setText('stat-revenue-cash', '---');
        setText('stat-revenue-digital', '---');

        // Hide the entire cards
        const revCard = document.getElementById('stat-revenue')?.closest('.stat-card');
        if (revCard) revCard.style.display = 'none';

        const cashCard = document.getElementById('stat-revenue-cash')?.closest('.stat-card');
        if (cashCard) cashCard.style.display = 'none';

        const digitalCard = document.getElementById('stat-revenue-digital')?.closest('.stat-card');
        if (digitalCard) digitalCard.style.display = 'none';
    }

    setText('stat-bookings', stats.todayBookings);
    setText('stat-bookings-change', `${stats.bookingsChange >= 0 ? '+' : ''}${stats.bookingsChange}% vs hier`);

    setText('stat-trips', stats.activeTrips);
    setText('stat-drivers', `${stats.driversOnDuty}/${stats.totalDrivers}`);
}

function renderActiveTrips(response) {
    const trips = response.data || (Array.isArray(response) ? response : []);
    const container = document.getElementById('active-trips');
    if (!container) return; // Guard if view changed

    if (trips.length === 0) {
        container.innerHTML = `<div class="empty-state">Aucun trajet en cours</div>`;
        return;
    }

    container.innerHTML = trips.map(trip => `
        <div class="trip-item" onclick="window.location.hash='#/departure-details/${trip.id}'">
            <div class="trip-info">
                <div class="trip-route">
                    ${trip.origin}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                    </svg>
                    ${trip.destination}
                </div>
                <div class="trip-meta">
                    <span class="badge badge-success">En route</span>
                    <span>${trip.vehiclePlate}</span>
                </div>
            </div>
            <div class="trip-action">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
        </div>
    `).join('');
}

function renderRecentBookings(response) {
    const bookings = response.data || (Array.isArray(response) ? response : []);
    const tbody = document.getElementById('recent-bookings');
    if (!tbody) return;

    if (bookings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Aucune réservation récente</td></tr>`;
        return;
    }

    tbody.innerHTML = bookings.map(b => `
        <tr>
            <td>${b.passengerName}</td>
            <td>${b.seats}</td>
            <td>${formatPrice(b.amount)}</td>
            <td><span class="badge ${getStatusClass(b.status)}">${getStatusLabel(b.status)}</span></td>
        </tr>
    `).join('');
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatPrice(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

function getStatusClass(status) {
    const classes = {
        'confirmed': 'success',
        'pending': 'warning',
        'cancelled': 'error'
    };
    return classes[status] || 'info';
}

function getStatusLabel(status) {
    const labels = {
        'confirmed': 'Confirmé',
        'pending': 'En attente',
        'cancelled': 'Annulé'
    };
    return labels[status] || status;
}
