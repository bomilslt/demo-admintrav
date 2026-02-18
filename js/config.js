/**
 * Global Configuration
 * ====================
 * Environment specific settings.
 * This file should be generated/replaced during deployment.
 */

// Mapbox token should be set via environment config (e.g. window.ENV injected at build/deploy)
const ENV = window.ENV || {};

export const CONFIG = {
    TENANT_ID: 'tenant-default-001',
    API_URL: ENV.API_URL || 'https://perpetual-empathy-production-e519.up.railway.app/api',
    // API_URL: 'http://localhost:5000/api',

    // Feature Flags
    ENABLE_DEBUG_LOGS: false,

    // Branding
    APP_NAME: 'INTERCITY Admin',

    // Mapbox — Set via window.ENV.MAPBOX_TOKEN in production
    mapboxToken: ENV.MAPBOX_TOKEN || 'pk.eyJ1IjoiZnJhbmNreWJvbWlsIiwiYSI6ImNta3FyZXV3bjBzOHczZHM5MHE4d3JiNXkifQ.kR4yphckwo9oixIHHMRPHg',
    currentMapStyle: ENV.MAPBOX_STYLE || 'mapbox://styles/franckybomil/cmkqtx5wh005h01qxf3xt33yl'
};
