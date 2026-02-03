/**
 * Clients View
 */

import { getClients } from '../../js/services/api.js';
import { Cache } from '../../js/services/cache.js';

export function init() {
    loadClients(); // SWR
}

function loadClients() {
    // Basic list, no complex filters yet
    Cache.swr('all_clients', getClients, renderClients);
}

function renderClients(clients) {
    const tbody = document.getElementById('clients-table');
    if (!tbody) return;

    if (!clients || clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Aucun client</td></tr>';
        return;
    }

    tbody.innerHTML = clients.map(c => `
        <tr>
            <td style="font-weight: 500;">${c.name}</td>
            <td>${c.phone}</td>
            <td>${c.bookings}</td>
            <td style="font-weight: 600; color: var(--primary);">${formatPrice(c.totalSpent)}</td>
            <td>${formatDate(c.createdAt)}</td>
        </tr>
    `).join('');
}

function formatPrice(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
