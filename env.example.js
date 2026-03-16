/**
 * Environment Configuration — EXAMPLE FILE
 * ==========================================
 * Copie ce fichier en env.js et remplis tes vraies valeurs.
 * ⚠️  Ne jamais committer env.js dans Git (il est dans .gitignore).
 *
 * Usage : ce fichier est chargé AVANT les modules JS.
 *         Il injecte les variables dans window.ENV.
 */
window.ENV = {
    // URL de base de l'API backend (sans slash final)
    API_URL: 'https://VOTRE-BACKEND.up.railway.app/api',

    // Token Mapbox — générer sur https://account.mapbox.com/tokens
    // Restreindre à votre domaine dans les paramètres du token !
    MAPBOX_TOKEN: 'pk.VOTRE_MAPBOX_TOKEN_ICI',

    // Style Mapbox (optionnel — supprimer la ligne pour utiliser le style par défaut)
    MAPBOX_STYLE: 'mapbox://styles/VOTRE_USER/VOTRE_STYLE_ID'
};
