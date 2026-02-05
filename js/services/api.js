/**
 * Admin API Service
 * ==================
 * 
 * STRUCTURE DES DONNÉES ATTENDUES PAR LES VUES :
 * 
 * Stats: { todayRevenue, revenueChange, todayBookings, bookingsChange, activeTrips, totalDrivers, driversOnDuty }
 * Departure: { id, origin, destination, date, departureTime, arrivalTime, vehicleType, vehiclePlate, driverId, driverName, totalSeats, bookedSeats, price, status, currentLat?, currentLng? }
 * Driver: { id, name, phone, rating, trips, status }
 * Booking: { id, passengerName, phone, departure, seats, amount, status, createdAt }
 * Client: { id, name, phone, bookings, totalSpent, createdAt }
 * 
 * POUR PASSER EN PRODUCTION :
 * 1. Changer USE_MOCK_DATA à false
 * 2. Configurer API_BASE_URL
 * 3. Ajouter le token d'auth dans getHeaders()
 */

import { CONFIG } from '../config.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const USE_MOCK_DATA = false;
export const API_BASE_URL = CONFIG.API_URL;

// Headers pour les requêtes API
function getHeaders() {
    const token = localStorage.getItem('adminToken');
    return {
        'Content-Type': 'application/json',
        'X-Tenant-ID': CONFIG.TENANT_ID,
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

// Wrapper pour les appels API
export async function apiCall(endpoint, options = {}) {
    if (USE_MOCK_DATA) {
        throw new Error('Mock mode - this should not be called');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const headers = getHeaders();
    console.log(`[API] Fetching: ${url}`, headers);

    const response = await fetch(url, {
        ...options,
        headers: headers
    });

    if (!response.ok) {
        let errorMessage = `API Error: ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData.message) errorMessage = errorData.message;
        } catch (e) {
            // Include status text if JSON parse fails
            if (response.statusText) errorMessage += ` ${response.statusText}`;
        }
        throw new Error(errorMessage);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

// Delay pour simuler latence réseau (mock uniquement)
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ============================================================================
// MOCK DATA
// ============================================================================

const mockStats = {
    todayRevenue: 485000,
    revenueChange: 12.5,
    todayBookings: 47,
    bookingsChange: 8.2,
    activeTrips: 5,
    totalDrivers: 24,
    driversOnDuty: 12
};

const mockDepartures = [
    {
        id: 'dep-001',
        origin: 'Yaoundé',
        destination: 'Douala',
        date: '2026-01-23',
        departureTime: '08:00',
        arrivalTime: '11:30',
        vehicleType: 'VIP',
        vehiclePlate: 'CE-2024-VIP',
        driverId: 'drv-001',
        driverName: 'DAX',
        totalSeats: 15,
        bookedSeats: 12,
        price: 8500,
        status: 'in_progress',
        currentLat: 3.8566,
        currentLng: 10.3750
    },
    {
        id: 'dep-002',
        origin: 'Yaoundé',
        destination: 'Bafoussam',
        date: '2026-01-23',
        departureTime: '14:00',
        arrivalTime: '17:30',
        vehicleType: 'Standard',
        vehiclePlate: 'CE-2024-STD',
        driverId: 'drv-002',
        driverName: 'Francky BOMIL',
        totalSeats: 20,
        bookedSeats: 18,
        price: 3500,
        status: 'pending'
    },
    {
        id: 'dep-003',
        origin: 'Yaoundé',
        destination: 'Garoua',
        date: '2026-01-23',
        departureTime: '16:00',
        arrivalTime: '23:00',
        vehicleType: 'Express',
        vehiclePlate: 'CE-2024-EXP',
        driverId: 'drv-003',
        driverName: 'Etienne',
        totalSeats: 12,
        bookedSeats: 8,
        price: 12500,
        status: 'pending'
    },
    {
        id: 'dep-004',
        origin: 'Douala',
        destination: 'Kribi',
        date: '2026-01-23',
        departureTime: '09:00',
        arrivalTime: '12:30',
        vehicleType: 'VIP',
        vehiclePlate: 'LT-2024-VIP',
        driverId: 'drv-004',
        driverName: 'Hyacinthe',
        totalSeats: 15,
        bookedSeats: 15,
        price: 6500,
        status: 'in_progress',
        currentLat: 3.0026,
        currentLng: 9.9022
    }
];

const mockDrivers = [
    { id: 'drv-001', name: 'Dax', phone: '+237 699 99 99 99', rating: 4.8, trips: 156, status: 'on_trip', preferredVehicleId: 'veh-001' },
    { id: 'drv-002', name: 'Francky BOMIL', phone: '+237 688 09 06 32', rating: 4.6, trips: 89, status: 'available', preferredVehicleId: 'veh-002' },
    { id: 'drv-003', name: 'Etienne', phone: '+237 699 99 99 99', rating: 4.9, trips: 234, status: 'available', preferredVehicleId: 'veh-003' },
    { id: 'drv-004', name: 'Hyacinthe', phone: '+237 699 99 99 99', rating: 4.7, trips: 178, status: 'on_trip', preferredVehicleId: 'veh-004' },
    { id: 'drv-005', name: 'Joseph', phone: '+237 699 99 99 99', rating: 4.5, trips: 67, status: 'offline', preferredVehicleId: 'veh-005' }
];

const mockBookings = [
    { id: 'bk-001', passengerName: 'Ntong Chalene', phone: '+237 699 99 99 99', departure: 'dep-001', seats: 2, amount: 17000, status: 'confirmed', createdAt: '2026-01-22T14:30:00' },
    { id: 'bk-002', passengerName: 'Mbarga Joseph', phone: '+237 699 99 99 99', departure: 'dep-001', seats: 1, amount: 8500, status: 'confirmed', createdAt: '2026-01-22T15:00:00' },
    { id: 'bk-003', passengerName: 'Mpessa Etienne', phone: '+237 699 99 99 99', departure: 'dep-002', seats: 3, amount: 10500, status: 'pending', createdAt: '2026-01-23T08:15:00' },
    { id: 'bk-004', passengerName: 'Dax Moli', phone: '+237 699 99 99 99', departure: 'dep-003', seats: 1, amount: 12500, status: 'confirmed', createdAt: '2026-01-23T09:00:00' },
    { id: 'bk-005', passengerName: 'Amidou Hyacinthe', phone: '+237 699 99 99 99', departure: 'dep-004', seats: 2, amount: 13000, status: 'cancelled', createdAt: '2026-01-22T10:30:00' }
];

const mockClients = [
    { id: 'cl-001', name: 'Ntong Chalene', phone: '+237 699 99 99 99', bookings: 12, totalSpent: 145000, createdAt: '2025-06-15' },
    { id: 'cl-002', name: 'Mbarga Joseph', phone: '+237 699 99 99 99', bookings: 8, totalSpent: 89000, createdAt: '2025-08-20' },
    { id: 'cl-003', name: 'Mpessa Etienne', phone: '+237 699 99 99 99', bookings: 5, totalSpent: 45000, createdAt: '2025-10-10' },
    { id: 'cl-004', name: 'Dax Moli', phone: '+237 699 99 99 99', bookings: 23, totalSpent: 267000, createdAt: '2025-03-01' }
];

// ============================================================================
// API FUNCTIONS - STATS
// ============================================================================

// ============================================================================
// API FUNCTIONS - STATS
// ============================================================================

export async function getStats() {
    return apiCall('/stats/dashboard');
}

export async function getRouteStats(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return apiCall(`/stats/routes?${params}`);
}

// ============================================================================
// API FUNCTIONS - DEPARTURES (CRUD)
// ============================================================================

export async function getDepartures(filters = {}) {
    if (USE_MOCK_DATA) {
        // ... (mock code)
        let result = [...mockDepartures];
        if (filters.status) {
            result = result.filter(d => d.status === filters.status);
        }
        if (filters.date) {
            result = result.filter(d => d.date === filters.date);
        }
        return result;
    }
    const params = new URLSearchParams(filters).toString();
    return apiCall(`/departures?${params}`);
}

export async function getDepartureById(id) {
    if (USE_MOCK_DATA) {
        await delay(200);
        return mockDepartures.find(d => d.id === id) || null;
    }
    return apiCall(`/departures/${id}`);
}

export async function createDeparture(data) {
    if (USE_MOCK_DATA) {
        await delay(300);
        const newDep = { id: `dep-${Date.now()}`, ...data };
        mockDepartures.push(newDep);
        return newDep;
    }
    return apiCall('/departures', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDeparture(id, data) {
    if (USE_MOCK_DATA) {
        await delay(300);
        const index = mockDepartures.findIndex(d => d.id === id);
        if (index !== -1) {
            mockDepartures[index] = { ...mockDepartures[index], ...data };
            return mockDepartures[index];
        }
        return null;
    }
    return apiCall(`/departures/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteDeparture(id) {
    if (USE_MOCK_DATA) {
        await delay(200);
        const index = mockDepartures.findIndex(d => d.id === id);
        if (index !== -1) {
            mockDepartures.splice(index, 1);
            return true;
        }
        return false;
    }
    return apiCall(`/departures/${id}`, { method: 'DELETE' });
}

export async function getActiveTrips() {
    if (USE_MOCK_DATA) {
        await delay(200);
        return mockDepartures.filter(d => d.status === 'in_progress');
    }
    return apiCall('/departures?status=in_progress');
}

// ============================================================================
// API FUNCTIONS - DRIVERS (CRUD)
// ============================================================================

export async function getDrivers(filters = {}) {
    if (USE_MOCK_DATA) {
        await delay(300);
        let result = [...mockDrivers];
        if (filters.status) {
            result = result.filter(d => d.status === filters.status);
        }
        return result;
    }
    const params = new URLSearchParams(filters).toString();
    return apiCall(`/fleet/drivers?${params}`);
}

export async function getDriverById(id) {
    if (USE_MOCK_DATA) {
        await delay(200);
        return mockDrivers.find(d => d.id === id) || null;
    }
    return apiCall(`/fleet/drivers/${id}`);
}

export async function createDriver(data) {
    if (USE_MOCK_DATA) {
        await delay(300);
        const newDriver = { id: `drv-${Date.now()}`, ...data };
        mockDrivers.push(newDriver);
        return newDriver;
    }
    return apiCall('/fleet/drivers', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDriver(id, data) {
    if (USE_MOCK_DATA) {
        await delay(300);
        const index = mockDrivers.findIndex(d => d.id === id);
        if (index !== -1) {
            mockDrivers[index] = { ...mockDrivers[index], ...data };
            return mockDrivers[index];
        }
        return null;
    }
    return apiCall(`/fleet/drivers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteDriver(id) {
    if (USE_MOCK_DATA) {
        await delay(200);
        const index = mockDrivers.findIndex(d => d.id === id);
        if (index !== -1) {
            mockDrivers.splice(index, 1);
            return true;
        }
        return false;
    }
    return apiCall(`/fleet/drivers/${id}`, { method: 'DELETE' });
}

// ============================================================================
// API FUNCTIONS - BOOKINGS
// ============================================================================

export async function getBookings(filters = {}) {
    if (USE_MOCK_DATA) {
        await delay(300);
        let result = mockBookings.map(b => {
            // Hydrate departure data
            const dep = mockDepartures.find(d => d.id === b.departure);
            return {
                ...b,
                departure: dep || {
                    id: b.departure,
                    origin: 'Inconnu',
                    destination: 'Inconnu',
                    date: new Date().toISOString()
                }
            };
        });

        if (filters.status) {
            result = result.filter(b => b.status === filters.status);
        }
        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter(b =>
                b.passengerName.toLowerCase().includes(s) ||
                b.id.toLowerCase().includes(s)
            );
        }
        if (filters.agencyId) {
            // If booking has agencyId or derived from departure origin?
            // For mock, we can ignore or simplistic check
        }

        return {
            data: result,
            meta: {
                page: filters.page || 1,
                pages: 1,
                total: result.length
            }
        };
    }
    const params = new URLSearchParams(filters).toString();
    return apiCall(`/bookings?${params}`);
}

export async function getRecentBookings(limit = 5) {
    if (USE_MOCK_DATA) {
        await delay(200);
        return mockBookings.slice(0, limit);
    }
    return apiCall(`/bookings?limit=${limit}&sort=createdAt:desc`);
}

export async function createBooking(data) {
    return apiCall('/bookings', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateBookingStatus(id, status) {
    return apiCall(`/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function transferBooking(bookingId, newDepartureId) {
    const response = await apiCall(`/bookings/${bookingId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departureId: newDepartureId })
    });
    return response;
}

export async function deleteBooking(bookingId) {
    const response = await apiCall(`/bookings/${bookingId}`, {
        method: 'DELETE'
    });
    return response;
}

export async function refundBooking(bookingId) {
    const response = await apiCall(`/bookings/${bookingId}/refund`, {
        method: 'POST'
    });
    return response;
}
// ============================================================================
// API FUNCTIONS - CLIENTS
// ============================================================================

export async function getClients(filters = {}) {
    if (USE_MOCK_DATA) {
        await delay(300);
        return [...mockClients];
    }
    const params = new URLSearchParams(filters).toString();
    // Clients not implemented in backend yet, using mock approach or empty
    // return apiCall(`/clients?${params}`);
    return [];
}

export async function getClientById(id) {
    if (USE_MOCK_DATA) {
        await delay(200);
        return mockClients.find(c => c.id === id) || null;
    }
    // return apiCall(`/clients/${id}`);
    return null;
}

// ============================================================================
// API FUNCTIONS - AGENCIES (CRUD)
// ============================================================================

const mockAgencies = [
    { id: 'ag-001', name: 'Yaoundé Central', city: 'Yaoundé', district: 'Mvan', lat: 3.8480, lng: 11.5021, status: 'active', stats: { staff: 12, revenue: 2500000 } },
    { id: 'ag-002', name: 'Douala Bonanjo', city: 'Douala', district: 'Bonanjo', lat: 4.0511, lng: 9.7679, status: 'active', stats: { staff: 8, revenue: 1800000 } },
    { id: 'ag-003', name: 'Bafoussam Gare', city: 'Bafoussam', district: 'Centre', lat: 5.4778, lng: 10.4176, status: 'active', stats: { staff: 5, revenue: 950000 } },
    { id: 'ag-004', name: 'Kribi Plage', city: 'Kribi', district: 'Centre', lat: 2.9376, lng: 9.9153, status: 'inactive', stats: { staff: 2, revenue: 0 } },
    { id: 'ag-005', name: 'Garoua Nord', city: 'Garoua', district: 'Plateau', lat: 9.3013, lng: 13.3977, status: 'active', stats: { staff: 6, revenue: 1200000 } }
];

export async function getAgencies(filters = {}) {
    if (USE_MOCK_DATA) {
        await delay(200);
        let result = [...mockAgencies];
        if (filters.status) result = result.filter(a => a.status === filters.status);
        return result;
    }
    const params = new URLSearchParams(filters).toString();
    return apiCall(`/agencies?${params}`);
}

export async function createAgency(data) {
    if (USE_MOCK_DATA) {
        await delay(300);
        // Ensure lat/lng are numbers
        const newAgency = {
            id: `ag-${Date.now()}`,
            ...data,
            lat: parseFloat(data.lat) || 0,
            lng: parseFloat(data.lng) || 0,
            stats: { staff: 0, revenue: 0 }
        };
        mockAgencies.push(newAgency);
        return newAgency;
    }
    return apiCall('/agencies', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAgency(id, data) {
    if (USE_MOCK_DATA) {
        await delay(300);
        const index = mockAgencies.findIndex(a => a.id === id);
        if (index !== -1) {
            mockAgencies[index] = { ...mockAgencies[index], ...data };
            return mockAgencies[index];
        }
        return null;
    }
    return apiCall(`/agencies/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteAgency(id) {
    if (USE_MOCK_DATA) {
        await delay(200);
        const index = mockAgencies.findIndex(a => a.id === id);
        if (index !== -1) {
            mockAgencies.splice(index, 1);
            return true;
        }
        return false;
    }
    return apiCall(`/agencies/${id}`, { method: 'DELETE' });
}

// ============================================================================
// API FUNCTIONS - ROUTES (CRUD)
// ============================================================================

const mockRoutes = [
    { id: 'rt-001', originId: 'ag-001', destinationId: 'ag-002', origin: 'Yaoundé Central', destination: 'Douala Bonanjo', distance: 240, duration: '4h 00m', pricePax: 5000, priceParcel: 2000, status: 'active' },
    { id: 'rt-002', originId: 'ag-002', destinationId: 'ag-001', origin: 'Douala Bonanjo', destination: 'Yaoundé Central', distance: 240, duration: '4h 00m', pricePax: 5000, priceParcel: 2000, status: 'active' },
    { id: 'rt-003', originId: 'ag-001', destinationId: 'ag-003', origin: 'Yaoundé Central', destination: 'Bafoussam Gare', distance: 300, duration: '5h 30m', pricePax: 4000, priceParcel: 1500, status: 'active' }
];

export async function getRoutes(filters = {}) {
    if (USE_MOCK_DATA) {
        await delay(200);
        let result = [...mockRoutes];
        if (filters.status) result = result.filter(r => r.status === filters.status);
        return result;
    }
    return apiCall('/routes');
}

export async function createRoute(data) {
    if (USE_MOCK_DATA) {
        await delay(300);
        const newRoute = { id: `rt-${Date.now()}`, ...data };
        mockRoutes.push(newRoute);
        return newRoute;
    }
    return apiCall('/routes', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateRoute(id, data) {
    if (USE_MOCK_DATA) {
        await delay(300);
        const index = mockRoutes.findIndex(r => r.id === id);
        if (index !== -1) {
            mockRoutes[index] = { ...mockRoutes[index], ...data };
            return mockRoutes[index];
        }
        return null;
    }
    return apiCall(`/routes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteRoute(id) {
    if (USE_MOCK_DATA) {
        await delay(200);
        const index = mockRoutes.findIndex(r => r.id === id);
        if (index !== -1) {
            mockRoutes.splice(index, 1);
            return true;
        }
        return false;
    }
    return apiCall(`/routes/${id}`, { method: 'DELETE' });
}

// ============================================================================
// API FUNCTIONS - REAL-TIME TRACKING
// ============================================================================

export async function getDriverPosition(driverId) {
    if (USE_MOCK_DATA) {
        await delay(100);
        // ... (mock code)
        return null;
    }
    return apiCall(`/tracking/${driverId}/position`);
}
// ============================================================================
// API FUNCTIONS - NOTIFICATIONS
// ============================================================================

const mockNotifications = [
    { id: 'notif-001', type: 'info', title: 'Nouvelle réservation', message: 'Jean Dupont a réservé 2 places pour Yaoundé - Douala.', time: 'Il y a 5 min', read: false },
    { id: 'notif-002', type: 'warning', title: 'Départ imminent', message: 'Le bus pour Bafoussam (14:00) part dans 30 minutes.', time: 'Il y a 30 min', read: false },
    { id: 'notif-003', type: 'success', title: 'Trajet terminé', message: 'Le chauffeur Dax est bien arrivé à Douala.', time: 'Il y a 2h', read: true },
    { id: 'notif-004', type: 'error', title: 'Annulation', message: 'La réservation #BK-982 a été annulée par le client.', time: 'Il y a 4h', read: true },
    { id: 'notif-005', type: 'info', title: 'Maintenance', message: 'Rappel : Le bus CE-123-AA doit passer au contrôle technique.', time: 'Hier', read: true }
];

export async function getNotifications() {
    if (USE_MOCK_DATA) {
        await delay(200);
        return [...mockNotifications];
    }
    return apiCall('/notifications');
}

export async function markNotificationAsRead(id) {
    if (USE_MOCK_DATA) {
        await delay(200);
        const notif = mockNotifications.find(n => n.id === id);
        if (notif) {
            notif.read = true;
            return true;
        }
        return false;
    }
    return apiCall(`/notifications/${id}/read`, { method: 'POST' });
}

export async function getParcels(filters = {}) {
    if (USE_MOCK_DATA) {
        return { data: [], meta: { total: 0 } };
    }
    const params = new URLSearchParams(filters).toString();
    return apiCall(`/parcels?${params}`);
}

export async function markAllNotificationsAsRead() {
    if (USE_MOCK_DATA) {
        await delay(300);
        mockNotifications.forEach(n => n.read = true);
        return true;
    }
    return apiCall('/notifications/read-all', { method: 'POST' });
}

// ============================================================================
// API FUNCTIONS - VEHICLES (CRUD)
// ============================================================================

const mockVehicles = [
    { id: 'veh-001', plate: 'CE-2024-VIP', model: 'Toyota Coaster', type: 'VIP', category: 'minibus', capacity: 18, status: 'active', mileage: 154000 },
    { id: 'veh-002', plate: 'LT-8892-AA', model: 'Yutong Bus', type: 'Standard', category: 'bus', capacity: 70, status: 'maintenance', mileage: 320000 },
    { id: 'veh-003', plate: 'CE-5541-BB', model: 'Toyota Hiace', type: 'Express', category: 'van', capacity: 14, status: 'active', mileage: 89000 },
    { id: 'veh-004', plate: 'OU-1122-C', model: 'Mercedes Sprinter', type: 'VIP', category: 'minibus', capacity: 16, status: 'active', mileage: 45000 },
    { id: 'veh-005', plate: 'NW-9988-X', model: 'Yutong Bus', type: 'Standard', category: 'bus', capacity: 70, status: 'inactive', mileage: 410000 }
];

export async function getVehicles(filters = {}) {
    if (USE_MOCK_DATA) {
        await delay(200);
        let result = [...mockVehicles];
        if (filters.status) result = result.filter(v => v.status === filters.status);
        if (filters.type) result = result.filter(v => v.type === filters.type);
        return result;
    }
    const params = new URLSearchParams(filters).toString();
    return apiCall(`/fleet/vehicles?${params}`);
}

export async function createVehicle(data) {
    if (USE_MOCK_DATA) {
        await delay(300);
        const newVehicle = { id: `veh-${Date.now()}`, ...data };
        mockVehicles.push(newVehicle);
        return newVehicle;
    }
    return apiCall('/fleet/vehicles', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateVehicle(id, data) {
    if (USE_MOCK_DATA) {
        await delay(300);
        const index = mockVehicles.findIndex(v => v.id === id);
        if (index !== -1) {
            mockVehicles[index] = { ...mockVehicles[index], ...data };
            return mockVehicles[index];
        }
        return null;
    }
    return apiCall(`/fleet/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteVehicle(id) {
    return apiCall(`/fleet/vehicles/${id}`, { method: 'DELETE' });
}



export async function createParcel(data) {
    return apiCall('/parcels', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateParcel(id, data) {
    return apiCall(`/parcels/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function updateParcelStatus(id, status) {
    return updateParcel(id, { status });
}

export async function transferParcel(id, departureId) {
    return apiCall(`/parcels/${id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ departureId })
    });
}

export async function deleteParcel(id) {
    return apiCall(`/parcels/${id}`, { method: 'DELETE' });
}

// ============================================================================
// API FUNCTIONS - EMPLOYEES (USERS)
// ============================================================================

export async function getEmployees(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return apiCall(`/users?${params}`);
}

export async function createEmployee(data) {
    return apiCall('/users', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateEmployee(id, data) {
    return apiCall(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteEmployee(id) {
    return apiCall(`/users/${id}`, { method: 'DELETE' });
}
