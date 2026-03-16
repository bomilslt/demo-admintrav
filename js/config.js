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
    API_URL: window.ENV?.API_URL || 'http://localhost:5000/api',
    // API_URL: 'http://localhost:5000/api',

    // Feature Flags
    ENABLE_DEBUG_LOGS: false,

    // Branding
    APP_NAME: 'INTERCITY Admin',

    // Mapbox — MUST be set via window.ENV.MAPBOX_TOKEN (never commit tokens to repo)
    mapboxToken: ENV.MAPBOX_TOKEN || '',
    currentMapStyle: ENV.MAPBOX_STYLE || 'mapbox://styles/franckybomil/cmkqtx5wh005h01qxf3xt33yl'
};
