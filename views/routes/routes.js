/**
 * Routes View
 */

import { getRoutes, createRoute, updateRoute, deleteRoute, getAgencies } from '../../js/services/api.js';
import { Cache } from '../../js/services/cache.js';

let allRoutes = [];
let allAgencies = [];
let currentFilter = 'all';

export function init() {
    // SWR Parallel loading
    loadRoutes();
    loadAgencies();

    setupFilters();
    setupActions();
    // Note: populateAgencySelects depends on allAgencies, handled in loadAgencies callback
}

function loadRoutes() {
    Cache.swr('all_routes_view', getRoutes, (data) => {
        allRoutes = data || [];
        renderTable();
    });
}

function loadAgencies() {
    Cache.swr('all_agencies', getAgencies, (data) => {
        allAgencies = data || [];
        populateAgencySelects();
    });
}

function populateAgencySelects() {
    const originSelect = document.getElementById('route-origin');
    const destSelect = document.getElementById('route-destination');

    if (!originSelect || !destSelect) return;

    const options = allAgencies.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

    originSelect.innerHTML = `<option value="">Sélectionner une agence...</option>` + options;
    destSelect.innerHTML = `<option value="">Sélectionner une agence...</option>` + options;
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

    const searchInput = document.getElementById('search-route');
    if (searchInput) {
        searchInput.addEventListener('input', renderTable);
    }
}

function setupActions() {
    const btnAdd = document.getElementById('btn-add-route');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => openRouteModal());
    }

    const btnSave = document.getElementById('btn-save-route');
    if (btnSave) {
        btnSave.addEventListener('click', saveRouteHandler);
    }

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) modal.classList.remove('active');
        });
    });
}

function renderTable() {
    const tbody = document.getElementById('routes-table');
    if (!tbody) return;

    let filtered = allRoutes;

    if (currentFilter !== 'all') {
        filtered = filtered.filter(r => r.status === currentFilter);
    }

    const searchTerm = document.getElementById('search-route')?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(r =>
            r.origin.toLowerCase().includes(searchTerm) ||
            r.destination.toLowerCase().includes(searchTerm)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    Aucune route trouvée
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(r => `
        <tr>
            <td>
                <div class="route-name">
                    ${r.origin} 
                    <svg class="route-arrow icon-svg" style="width:14px;height:14px" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    ${r.destination}
                </div>
            </td>
            <td>
                <div>${r.distance} km</div>
                <div class="text-xs text-muted">${r.duration}</div>
            </td>
            <td><span class="price-tag">${formatPrice(r.pricePax)}</span></td>
            <td><span class="price-tag">${formatPrice(r.priceParcel)}</span></td>
            <td><span class="badge ${r.status === 'active' ? 'success' : 'warning'}">${r.status === 'active' ? 'Active' : 'Inactive'}</span></td>
            <td>
                <div class="action-btns">
                    <button class="action-btn edit" onclick="window.editRoute('${r.id}')" title="Modifier">
                        <svg class="icon-svg" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="action-btn danger" onclick="window.deleteRouteHandler('${r.id}')" title="Supprimer">
                        <svg class="icon-svg" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ============================================================================
// MODAL LOGIC
// ============================================================================

function openRouteModal(routeId = null) {
    const modal = document.getElementById('modal-route');
    const title = document.getElementById('modal-route-title');

    // Reset
    document.getElementById('route-id').value = '';
    document.getElementById('route-origin').value = '';
    document.getElementById('route-destination').value = '';
    document.getElementById('route-distance').value = '';
    document.getElementById('route-duration').value = '';
    document.getElementById('route-price-pax').value = '';
    document.getElementById('route-price-parcel').value = '';
    document.getElementById('route-status').value = 'active';

    if (routeId) {
        const r = allRoutes.find(rt => rt.id === routeId);
        if (r) {
            title.textContent = 'Modifier Route';
            document.getElementById('route-id').value = r.id;
            // Set selects if IDs match (mock data primarily uses IDs now)
            document.getElementById('route-origin').value = r.originId || '';
            document.getElementById('route-destination').value = r.destinationId || '';

            document.getElementById('route-distance').value = r.distance;
            document.getElementById('route-duration').value = r.duration;
            document.getElementById('route-price-pax').value = r.pricePax;
            document.getElementById('route-price-parcel').value = r.priceParcel;
            document.getElementById('route-status').value = r.status;
        }
    } else {
        title.textContent = 'Nouvelle Route';
    }

    modal.classList.add('active');
}

async function saveRouteHandler() {
    const originSelect = document.getElementById('route-origin');
    const destSelect = document.getElementById('route-destination');

    const data = {
        originId: originSelect.value,
        origin: originSelect.options[originSelect.selectedIndex]?.text,
        destinationId: destSelect.value,
        destination: destSelect.options[destSelect.selectedIndex]?.text,
        distance: parseInt(document.getElementById('route-distance').value) || 0,
        duration: document.getElementById('route-duration').value,
        pricePax: parseInt(document.getElementById('route-price-pax').value) || 0,
        priceParcel: parseInt(document.getElementById('route-price-parcel').value) || 0,
        status: document.getElementById('route-status').value
    };

    if (!data.originId || !data.destinationId || !data.pricePax) {
        window.showAlert('Erreur', 'Veuillez sélectionner les agences et définir un prix', 'error');
        return;
    }

    if (data.originId === data.destinationId) {
        window.showAlert('Erreur', 'Le point de départ et d\'arrivée ne peuvent pas être identiques', 'error');
        return;
    }

    const id = document.getElementById('route-id').value;

    const btnSave = document.getElementById('btn-save-route');

    try {
        window.setBtnLoading(btnSave, true);
        if (id) {
            await updateRoute(id, data);
            window.showAlert('Succès', 'Route mise à jour', 'success');
        } else {
            await createRoute(data);
            window.showAlert('Succès', 'Nouvelle route créée', 'success');
        }
        await loadRoutes();
        document.getElementById('modal-route').classList.remove('active');
    } catch (error) {
        console.error(error);
        window.showAlert('Erreur', error.message || 'Impossible d\'enregistrer la route', 'error');
    } finally {
        window.setBtnLoading(btnSave, false);
    }
}

// Global functions
window.editRoute = (id) => openRouteModal(id);
window.deleteRouteHandler = async (id) => {
    const r = allRoutes.find(rt => rt.id === id);
    if (r) {
        const confirm = await window.showConfirm('Confirmation', `Supprimer la route ${r.origin} - ${r.destination} ?`);
        if (confirm) {
            try {
                await deleteRoute(id);
                await loadRoutes();
                window.showToast('Supprimé', 'Route supprimée avec succès', 'success');
            } catch (error) {
                console.error("Delete Error", error);
                // Check if it's likely an integrity error (generic message often 500)
                // Since we reverted server cascade, deleting a route with departures will fail.
                if (error.message.includes('500') || error.message.includes('IntegrityError')) {
                    window.showToast('Impossible de supprimer', 'Cette route a des départs associés. Supprimez-les d\'abord.', 'error');
                } else {
                    window.showToast('Erreur', error.message || 'Impossible de supprimer la route', 'error');
                }
            }
        }
    }
};

// ============================================================================
// HELPERS
// ============================================================================

function formatPrice(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}
