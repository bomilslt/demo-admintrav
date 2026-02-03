import { initMapbox3D } from '../../utils/mapbox/mapbox-3D.js';
import { apiCall, getAgencies } from '../../js/services/api.js';
import { CONFIG } from '../../js/config.js';

let mapManager = null;
let refreshInterval = null;

// Cache for traffic data (throttling API calls)
const trafficCache = new Map();
const TRAFFIC_CACHE_DURATION = 5 * 60 * 1000; // 5 mins

// Cache for Route Geometries (Long term cache, these rarely change)
const routeCache = new Map();

export async function init() {
    console.log('Initializing Live Map...');

    // Get Token from Config
    const MAPBOX_TOKEN = CONFIG.mapboxToken;
    mapboxgl.accessToken = MAPBOX_TOKEN; // Force global token

    try {
        // Init Map
        mapManager = initMapbox3D({
            mapboxToken: MAPBOX_TOKEN,
            containerId: 'global-map',
            style: CONFIG.currentMapStyle,
            defaultCenter: [11.5021, 3.8480], // Yaoundé
            defaultZoom: 7,
            enable3DByDefault: false, // 2D is better for global view
            autoCenter: false // Don't auto center on single vehicle
        });

        // Wait for map style to be fully loaded prevents "Style is not done loading" error
        if (!mapManager.map.isStyleLoaded()) {
            await new Promise(resolve => mapManager.map.once('style.load', resolve));
        }

        // Initial Load
        await Promise.all([
            loadLiveVehicles(),
            loadLocations()
        ]);

        // Start Auto-Refresh
        startAutoRefresh();

        // Manual Refresh Button
        const btnRefresh = document.getElementById('btn-refresh-map');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                loadLiveVehicles();
                // Animation feed back
                const icon = btnRefresh.querySelector('span'); // if icon exists or just animate btn
                btnRefresh.animate([
                    { transform: 'translateX(-50%) rotate(0deg)' },
                    { transform: 'translateX(-50%) rotate(360deg)' }
                ], { duration: 500 });
            });
        }

    } catch (error) {
        console.error('Map Init Error:', error);
        document.getElementById('global-map').innerHTML = `
            <div class="alert alert-danger" style="margin:20px">
                Erreur de chargement de la carte: ${error.message}
            </div>
        `;
    }
}

async function loadLocations() {
    try {
        const response = await getAgencies();
        const agencies = Array.isArray(response) ? response : (response.data || []);

        console.log('Agencies loaded:', agencies.length);

        agencies.forEach(agency => {
            // Support both lat/lng (backend standard) and latitude/longitude (legacy/mock)
            const lat = agency.lat !== undefined ? agency.lat : agency.latitude;
            const lng = agency.lng !== undefined ? agency.lng : agency.longitude;

            if (lat && lng && mapManager) {
                // Determine icon based on type (if any) or just generic building
                const isHQ = agency.type === 'headquarters'; // Example logic
                const symbol = isHQ ? '🏢' : '🏪';

                mapManager.addLocationMarker(agency.id, [parseFloat(lng), parseFloat(lat)], {
                    label: agency.name,
                    icon: symbol,
                    popupContent: `
                        <p>${agency.address || 'Adresse non spécifiée'}</p>
                        <p style="font-size:0.8rem; color:#666">${agency.phone || ''}</p>
                    `,
                    color: isHQ ? '#dc2626' : '#2563eb'
                });
            } else {
                console.warn(`Agency ${agency.id} missing coords:`, agency);
            }
        });

    } catch (e) {
        console.warn('Failed to load agencies locations:', e);
    }
}

async function loadLiveVehicles() {
    const indicator = document.getElementById('map-refresh-indicator');
    if (indicator) indicator.classList.remove('hidden');

    try {
        const response = await apiCall('/fleet/live-map');
        const featureCollection = response;

        // stats
        let activeCount = 0;
        let totalPax = 0;
        let anomalies = [];

        // Process Features
        for (const feature of featureCollection.features) {
            const props = feature.properties;
            const coords = feature.geometry.coordinates;
            const id = props.id; // Departure ID

            // Stats
            activeCount++;
            if (props.occupancy) {
                const parts = props.occupancy.split('/');
                if (parts.length > 0) totalPax += parseInt(parts[0]) || 0;
            }

            // --- ANOMALY DETECTION ---
            let statusColor = '#22c55e'; // Green
            let anomalyType = null;
            let trafficDelay = 0;

            // 1. Check Signal Lost (> 5 mins)
            if (props.lastPositionUpdate) {
                const lastUpdate = new Date(props.lastPositionUpdate);
                const now = new Date();
                const diffMs = now - lastUpdate;
                if (diffMs > 5 * 60 * 1000) { // 5 mins
                    statusColor = '#94a3b8'; // Grey
                    anomalyType = 'Signal Perdu';
                }
            }

            // 2. Traffic & Delay Check (Only if signal OK and have destination)
            if (!anomalyType && props.destination && props.destination.lng) {
                // Fetch Traffic Data (Throttled)
                try {
                    const traffic = await getTrafficData(id, coords, [props.destination.lng, props.destination.lat]);
                    if (traffic) {
                        const jamDelay = (traffic.duration - traffic.duration_typical) / 60;
                        if (jamDelay > 10) trafficDelay = Math.round(jamDelay);

                        const now = new Date();
                        const predictedArrival = new Date(now.getTime() + traffic.duration * 1000);

                        if (props.scheduledArrival) {
                            const scheduled = new Date(props.scheduledArrival);
                            if (predictedArrival > new Date(scheduled.getTime() + 15 * 60000)) {
                                const totalDelay = Math.round((predictedArrival - scheduled) / 60000);
                                statusColor = '#ef4444'; // Red
                                anomalyType = `Retard Estimé (${totalDelay} min)`;
                                if (trafficDelay > 0) anomalyType += ` (dont ${trafficDelay} min trafic)`;
                            }
                        }

                        if (!anomalyType && trafficDelay > 15) {
                            statusColor = '#f59e0b'; // Orange
                            anomalyType = `Trafic Intense (+${trafficDelay} min)`;
                        }
                    }
                } catch (e) {
                    console.warn('Traffic API error:', e);
                }
            }

            if (anomalyType) {
                anomalies.push({
                    plate: props.plate,
                    route: props.route,
                    issue: anomalyType,
                    id: props.id
                });
            }

            // ... (existing imports)

            // ICON DEFINITIONS (3D PNGs)
            const ICONS = {
                bus: '<img src="images/vehicles/bus.png" style="width:60px;height:60px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));">',
                minibus: '<img src="images/vehicles/minibus.png" style="width:50px;height:50px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));">',
                van: '<img src="images/vehicles/van.png" style="width:45px;height:45px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3)); transform: scaleX(-1);">'
            };

            function getVehicleIcon(type) {
                // Normalise type (handle variations)
                const t = (type || '').toLowerCase();

                if (t.includes('van') || t.includes('hiace')) return ICONS.van;
                if (t.includes('mini') || t.includes('coaster')) return ICONS.minibus;
                return ICONS.bus; // Default
            }

            // ... (in loadLiveVehicles loop around line 155)
            // ...
            // Update/Add Vehicle Marker
            if (mapManager.vehicles.has(id)) {
                // Determine Flip (Mirror)
                const prev = mapManager.vehicles.get(id).coords;
                let shouldFlip = false; // Default: Face Left (West)

                if (prev && coords) {
                    const dLon = coords[0] - prev[0];
                    // If dLon > 0, we are moving East (Right). Flip to face Right.
                    // If dLon < 0, we are moving West (Left). Keep default.
                    if (dLon > 0.0001) { // Threshold to avoid jitter
                        shouldFlip = true;
                    } else if (dLon < -0.0001) {
                        shouldFlip = false;
                    } else {
                        // Keep previous state if not moving much?
                        // For now default to false or we'd need to read previous state.
                        // Let's try constant update based on movement. 
                        // If stationary, maybe keep last known flip?
                        // To do that we'd need to read mapManager.vehicles.get(id).innerElement._flipState
                    }
                }

                mapManager.updateVehiclePosition(id, coords, shouldFlip);

                const marker = mapManager.markers.get(id);
                if (marker) {
                    const el = marker.getElement();
                    el.style.borderColor = statusColor;
                    el.style.color = statusColor;
                    el.style.boxShadow = anomalyType ? `0 0 10px ${statusColor}` : 'none';

                    // Rotation Removed
                    /*
                    if (bearing !== 0) {
                        marker.setRotation(bearing + 90);
                    }
                    */
                }
            } else {
                mapManager.addVehicle(id, coords, {
                    label: props.plate,
                    type: props.type || 'bus',
                    color: statusColor,
                    customIcon: getVehicleIcon(props.category),
                    // rotation: 90, // Reverted to default 0
                    popupContent: `
                        <div style="min-width:200px">
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                <span class="badge ${props.status === 'in_progress' ? 'badge-success' : 'badge-warning'}">${props.status}</span>
                                <span style="font-size:12px; color:#666">${props.departureTime}</span>
                            </div>
                            <p><strong>Chauffeur:</strong> ${props.driverName}</p>
                            <p><strong>Modèle:</strong> ${props.plate} (${props.type})</p>
                            <p><strong>Route:</strong> ${props.route}</p>
                            <p><strong>Passagers:</strong> ${props.occupancy}</p>
                            ${anomalyType ? `<p style="color:${statusColor}; font-weight:bold">⚠ ${anomalyType}</p>` : ''}
                        </div>
                    `
                });
            }
            // ...

            // --- DRAW REAL ROUTE ---
            if (props.origin && props.destination && props.origin.lng && props.destination.lng) {
                const routeId = 'path-' + id;
                // Only load route if not already displayed
                if (!mapManager.map.getSource('route-' + routeId)) {
                    try {
                        // Color Generation Helper
                        const stringToColor = (str) => {
                            let hash = 0;
                            for (let i = 0; i < str.length; i++) {
                                hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
                            }
                            // Mix it further to spread similar strings
                            const mixedHash = Math.abs(hash * 16777619);
                            // Golden Angle approx 137.5 deg to spread colors
                            // But simply modulo 360 on a good hash works too.
                            const h = mixedHash % 360;

                            // Use fixed saturation/lightness but vary them slightly for more distinction
                            const s = 65 + (mixedHash % 30); // 65-95%
                            const l = 45 + (mixedHash % 20); // 45-65%

                            return `hsl(${h}, ${s}%, ${l}%)`;
                        };

                        const routeColor = stringToColor(props.id || routeId); // Unique color per Departure

                        // Fetch Real Route Geometry
                        const geometry = await getRouteGeometry(
                            [props.origin.lng, props.origin.lat],
                            [props.destination.lng, props.destination.lat]
                        );

                        if (geometry) {
                            mapManager.addRoute(routeId, geometry, {
                                color: routeColor,
                                width: 4,
                                opacity: 0.8 // Increased opacity for better visibility
                            });
                        } else {
                            // Fallback to straight line if API fails
                            mapManager.addRoute(routeId, [
                                [props.origin.lng, props.origin.lat],
                                [props.destination.lng, props.destination.lat]
                            ], { color: routeColor, width: 3, opacity: 0.6 });
                        }
                    } catch (e) {
                        console.warn("Failed to load route geometry", e);
                    }
                }
            }
        }

        // Cleanup
        const currentIds = new Set(featureCollection.features.map(f => f.properties.id));
        mapManager.vehicles.forEach((v, id) => {
            if (!currentIds.has(id)) {
                mapManager.removeVehicle(id);
                if (mapManager.removeRoute) mapManager.removeRoute('path-' + id);
                trafficCache.delete(id);
            }
        });

        // Update Stats UI
        const elActive = document.getElementById('stats-active-vehicles');
        const elPax = document.getElementById('stats-total-pax');

        if (elActive) elActive.textContent = activeCount;
        if (elPax) elPax.textContent = totalPax;

        updateAlertsUI(anomalies);

    } catch (error) {
        console.error('Failed to load live map data:', error);
    } finally {
        if (indicator) setTimeout(() => indicator.classList.add('hidden'), 500);
    }
}

async function getRouteGeometry(origin, destination) {
    const key = `${origin.join(',')}|${destination.join(',')}`;

    // Check Cache
    if (routeCache.has(key)) {
        return routeCache.get(key);
    }

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?geometries=geojson&overview=full&access_token=${CONFIG.mapboxToken}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
            const geometry = data.routes[0].geometry.coordinates;
            // Cache it (Routes between cities don't change often)
            routeCache.set(key, geometry);
            return geometry;
        }
    } catch (e) {
        console.error("Mapbox Route Error:", e);
    }

    return null;
}

async function getTrafficData(id, currentCoords, destCoords) {
    const now = Date.now();
    const cached = trafficCache.get(id);
    if (cached && (now - cached.timestamp < TRAFFIC_CACHE_DURATION)) return cached.data;

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${currentCoords[0]},${currentCoords[1]};${destCoords[0]},${destCoords[1]}?annotations=duration,duration_typical&access_token=${CONFIG.mapboxToken}`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const result = { duration: route.duration, duration_typical: route.legs[0].annotation?.duration_typical || route.duration };
        trafficCache.set(id, { timestamp: now, data: result });
        return result;
    }
    return null;
}

// Dropdown Toggle Logic
function setupAnomalyDropdown() {
    const btn = document.getElementById('btn-anomalies');
    const list = document.getElementById('anomaly-list');

    if (btn && list && !btn.hasAttribute('data-listener')) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            list.classList.toggle('active');
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!btn.contains(e.target) && !list.contains(e.target)) {
                list.classList.remove('active');
            }
        });

        btn.setAttribute('data-listener', 'true');
    }
}

// Ensure setup is called
document.addEventListener('DOMContentLoaded', setupAnomalyDropdown);

function updateAlertsUI(anomalies) {
    // Dropdown Elements
    const btn = document.getElementById('btn-anomalies');
    const badge = document.getElementById('anomaly-count');
    const list = document.getElementById('anomaly-list');

    // Ensure listener is setup if element exists (e.g. after dynamic load)
    setupAnomalyDropdown();

    if (!btn || !list) return;

    // Always show button to reassure user system is working
    btn.classList.remove('hidden');

    if (anomalies.length === 0) {
        // Safe State
        const iconSpan = btn.querySelector('.icon');
        if (iconSpan) iconSpan.textContent = '✅';

        btn.style.color = '#22c55e'; // Green
        btn.style.borderColor = '#22c55e';
        if (badge) {
            badge.style.display = 'none'; // Hide count badge if 0
        }

        // Update list content to show "All Good"
        list.innerHTML = `
            <div style="padding:20px; text-align:center; color:#64748b;">
                <div style="font-size:24px; margin-bottom:10px;">🟢</div>
                <strong>Aucune anomalie détectée</strong>
                <p style="font-size:12px; margin:5px 0 0;">Le trafic est fluide et les signaux sont bons.</p>
            </div>
        `;
    } else {
        // Determine Max Severity
        let maxSeverity = 'warning'; // Default to warning (Orange)
        let btnColor = '#f59e0b'; // Amber-500
        let headerColor = '#fffbeb'; // Amber-50
        let headerText = 'Avertissements';
        const iconSpan = btn.querySelector('.icon');

        // Check for Critical issues (Red)
        const hasCritical = anomalies.some(a => a.issue.includes('Retard'));

        if (hasCritical) {
            maxSeverity = 'critical';
            btnColor = '#ef4444'; // Red-500
            headerColor = '#fef2f2'; // Red-50
            headerText = 'Problèmes détectés';
            if (iconSpan) iconSpan.textContent = '⚠️';
        } else {
            // Only warnings (Orange)
            if (iconSpan) iconSpan.textContent = '📡';
        }

        btn.style.color = btnColor;
        btn.style.borderColor = '#e2e8f0';

        if (badge) {
            badge.style.display = 'inline-flex';
            badge.textContent = anomalies.length;
            badge.style.background = btnColor;
        }

        // Populate List
        list.innerHTML = `
            <div class="alerts-header" style="padding:10px 15px; border-bottom:1px solid #eee; background:${headerColor};">
                <strong style="color:${btnColor}; font-size:12px; text-transform:uppercase;">${anomalies.length} ${headerText}</strong>
            </div>
            ${anomalies.map(a => {
            // Determine item color based on specific issue
            let itemColor = '#f59e0b'; // Default Orange
            let itemBg = '#fffbeb';
            if (a.issue.includes('Retard')) {
                itemColor = '#ef4444'; // Red for delay
                itemBg = '#fef2f2';
            }

            return `
                <div class="alert-item" onclick="window.focusVehicle('${a.id}')">
                    <div class="alert-title">
                        <span>${a.plate}</span>
                        <span style="font-size:11px; color:#999">Maintenant</span>
                    </div>
                    <div class="alert-route">${a.route}</div>
                    <div class="alert-issue" style="color:${itemColor}; background:${itemBg}; display:inline-block; padding:2px 8px; border-radius:4px; font-weight:600; font-size:11px;">${a.issue}</div>
                </div>
                `;
        }).join('')}
        `;
    }
}

// Helper to focus map on vehicle (global scope hack or event dispatch?)
// Defining window function for simplicity in HTML string
window.focusVehicle = (id) => {
    if (mapManager) {
        const vehicle = mapManager.vehicles.get(id);
        if (vehicle) {
            mapManager.map.flyTo({
                center: vehicle.marker.getLngLat(),
                zoom: 15,
                speed: 1.5
            });
            // Open popup?
            vehicle.marker.togglePopup();
        }
    }
};

function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        loadLiveVehicles();
    }, 15000);
}

export function destroy() {
    if (refreshInterval) clearInterval(refreshInterval);
    if (mapManager) {
        mapManager.destroy();
        mapManager = null;
    }
}
