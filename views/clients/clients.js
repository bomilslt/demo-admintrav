/**
 * Clients View
 */

import { getClients } from '../../js/services/api.js';
import { Cache } from '../../js/services/cache.js';

export function init() {
    Cache.clear('all_clients'); // Force fresh fetch
    loadClients();
}

async function loadClients() {
    const tbody = document.getElementById('clients-table');

    try {
        await Cache.swr('all_clients', getClients, handleClientsResponse);
    } catch (e) {
        console.error('[Clients] Load failed:', e);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--danger)">Erreur chargement clients: ${e.message}</td></tr>`;
        }
    }
}

function handleClientsResponse(response) {
    // Support both paginated { data, pagination } and plain array
    const clients = Array.isArray(response) ? response : (response.data || []);
    renderClients(clients);
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
