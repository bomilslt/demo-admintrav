/**
 * REPORTS VIEW - Global Statistics & Analytics
 * =============================================
 */

import { getStats, getDepartures, getBookings, getRouteStats, getParcels } from '../../js/services/api.js';
import { exportToPDF } from '../../js/utils/export-utils.js';
import { Cache } from '../../js/services/cache.js';

let currentPeriod = 'week';
let chartInstance = null;

export function init() {
    setupEventListeners();
    // Default to 'week'
    const select = document.getElementById('period-select');
    if (select) select.value = 'week';
    currentPeriod = 'week';

    loadReportsData(); // SWR
}

function setupEventListeners() {
    const periodSelect = document.getElementById('period-select');
    if (periodSelect) {
        periodSelect.addEventListener('change', (e) => {
            currentPeriod = e.target.value;
            loadReportsData(); // SWR
        });
    }

    const btnExport = document.getElementById('btn-export');
    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            if (window.latestActivityData) {
                await exportToPDF(
                    window.latestActivityData,
                    'Rapport d\'Activité',
                    {
                        'date': 'Date',
                        'type': 'Type',
                        'description': 'Description',
                        'amount': 'Montant'
                    },
                    'rapport_activite'
                );
            } else {
                window.showAlert('Info', 'Veuillez attendre le chargement des données.');
            }
        });
    }
}

function getDateRange(period) {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(); // Today end

    if (period === 'today') {
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
        // Last 7 days
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
        // Last 30 days
        startDate.setDate(now.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'year') {
        startDate.setFullYear(now.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);
    }

    return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
    };
}

function loadReportsData() {
    const { startDate, endDate } = getDateRange(currentPeriod);
    const cacheKey = `reports_data_${currentPeriod}`;

    Cache.swr(cacheKey, async () => {
        // Fetcher
        const [stats, departures, bookings, parcels, routeStats] = await Promise.all([
            getStats(),
            getDepartures({ startDate: startDate.split('T')[0], endDate: endDate.split('T')[0], limit: 1000 }),
            getBookings({ startDate, endDate, limit: 1000, status: 'confirmed' }),
            getParcels({ startDate, endDate, limit: 1000, status: 'delivered' }),
            getRouteStats({ startDate, endDate })
        ]);
        return { stats, departures, bookings, parcels, routeStats };
    }, (data) => {
        // Renderer
        if (!data) return;
        const { stats, departures, bookings, parcels, routeStats } = data;

        const bookingsList = bookings.data || (Array.isArray(bookings) ? bookings : []);
        const parcelsList = parcels.data || (Array.isArray(parcels) ? parcels : []);
        const departuresList = departures.data || (Array.isArray(departures) ? departures : []);

        // Save for export
        window.latestActivityData = bookingsList;

        // 2. Calculate KPIs Locally (to respect the filter!)
        // Revenue
        const bookingRevenue = bookingsList.reduce((sum, b) => sum + (b.amount || 0), 0);
        const parcelRevenue = parcelsList.reduce((sum, p) => sum + (p.price || 0), 0);
        const totalRevenue = bookingRevenue + parcelRevenue;

        // Trips (Departures in range)
        const tripsCount = departuresList.length;

        // Passengers (from bookings)
        const paxCount = bookingsList.reduce((sum, b) => sum + (b.seats || 1), 0);

        const kpis = {
            revenue: { value: totalRevenue, trend: 0 },
            trips: { value: tripsCount, trend: 0 },
            passengers: { value: paxCount, trend: 0 },
            parcels: { value: parcelsList.length, trend: 0 }
        };

        renderKPIs(kpis);
        renderRevenueChart(generateRevenueData(currentPeriod)); // Mocked dynamic chart data would ideally use real data
        renderTopRoutes(routeStats ? routeStats.slice(0, 5) : []);

        // 3. Combine Activities (Bookings + Parcels + Departures)
        const recentActivity = generateRecentActivity(bookingsList, parcelsList, departuresList);
        // window.latestActivityData is already set to bookingsList? Wait, the original code set it to recentActivity?
        // Actually original updated window.latestActivityData to bookingsList, but then later calculated recentActivity.
        // Let's stick to recentActivity being consistent if that's what export uses.
        // Wait, export uses exportToPDF with window.latestActivityData.
        // The export call passes columns {date, type, description, amount}. This matches 'recentActivity' structure.
        // So I should set window.latestActivityData = recentActivity.

        window.latestActivityData = recentActivity;
        renderActivityTable(recentActivity);
    });
}

function generateRecentActivity(bookings, parcels, departures) {
    // Combine arrays
    const bItems = bookings.map(b => ({
        rawDate: new Date(b.createdAt),
        date: new Date(b.createdAt).toLocaleDateString('fr-FR') + ' ' + new Date(b.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        type: 'Réservation',
        description: `${b.passengerName} - ${b.seats} place(s)`,
        amount: b.amount
    }));

    const pItems = parcels.map(p => ({
        rawDate: new Date(p.created_at || p.createdAt),
        date: new Date(p.created_at || p.createdAt).toLocaleDateString('fr-FR') + ' ' + new Date(p.created_at || p.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        type: 'Colis',
        description: `Exp: ${p.senderName} -> Dest: ${p.recipientName}`,
        amount: p.price
    }));

    const dItems = departures.map(d => ({
        rawDate: new Date(`${d.date}T${d.departureTime || '00:00'}`),
        date: new Date(`${d.date}T${d.departureTime || '00:00'}`).toLocaleDateString('fr-FR') + ' ' + (d.departureTime || ''),
        type: 'Départ',
        description: `Trajet: ${d.route.origin} -> ${d.route.destination}`,
        amount: 0
    }));

    const combined = [...bItems, ...pItems, ...dItems];
    // Sort desc
    combined.sort((a, b) => b.rawDate - a.rawDate);

    return combined.slice(0, 10); // Show top 10
}

function renderKPIs(kpis) {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setText('kpi-revenue', formatPrice(kpis.revenue.value));
    setText('kpi-trips', kpis.trips.value);
    setText('kpi-passengers', kpis.passengers.value);
    setText('kpi-parcels', kpis.parcels.value);
}

function renderRevenueChart(data) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    if (chartInstance) chartInstance.destroy();
    if (window.Chart) {
        chartInstance = new window.Chart(ctx, {
            type: 'line',
            data: data,
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

// Mock chart data structure - in real apps, aggregate daily
function generateRevenueData(period) {
    return {
        labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
        datasets: [{
            label: 'Revenus (FCFA)',
            data: [0, 0, 0, 0, 0, 0, 0], // Placeholder
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderColor: 'rgba(59, 130, 246, 1)',
            fill: true
        }]
    };
}

function renderTopRoutes(routes) {
    const container = document.getElementById('top-routes');
    if (!container) return;
    if (!routes || routes.length === 0) {
        container.innerHTML = '<div style="padding:10px;text-align:center;color:#888;">Aucune donnée</div>';
        return;
    }
    container.innerHTML = routes.map((route, index) => `
        <div class="route-item">
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:0.8rem;color:#888;">#${index + 1}</span>
                <span class="route-name">${route.name}</span>
            </div>
            <div class="route-stats">
                <span>${route.occupancy}%</span>
                <span class="route-revenue">${formatPrice(route.totalRevenue)}</span>
            </div>
        </div>
    `).join('');
}

function renderActivityTable(activities) {
    const tbody = document.getElementById('activity-table');
    if (!tbody) return;

    tbody.innerHTML = activities.map(a => {
        let badgeClass = 'info';
        if (a.type === 'Colis') badgeClass = 'warning';
        if (a.type === 'Départ') badgeClass = 'success';

        return `
        <tr>
            <td>${a.date}</td>
            <td><span class="badge ${badgeClass}">${a.type}</span></td>
            <td>${a.description}</td>
            <td class="text-right">${a.amount > 0 ? formatPrice(a.amount) : '-'}</td>
        </tr>
        `;
    }).join('');
}

function formatPrice(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}
