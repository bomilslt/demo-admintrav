/**
 * Environment Configuration
 * =========================
 * This file injects runtime environment variables.
 * It is loaded BEFORE any module scripts.
 * 
 * ⚠️ This file MUST be in .gitignore — never commit secrets!
 */
window.ENV = {
    API_URL: 'https://perpetual-empathy-production-e519.up.railway.app/api',
    MAPBOX_TOKEN: 'pk.eyJ1IjoiZnJhbmNreWJvbWlsIiwiYSI6ImNta3FyZXV3bjBzOHczZHM5MHE4d3JiNXkifQ.kR4yphckwo9oixIHHMRPHg',
    MAPBOX_STYLE: 'mapbox://styles/franckybomil/cmkqtx5wh005h01qxf3xt33yl'
};

