/**
 * User State & Agency Access Utilities
 * For agency-based data filtering in Admin UI
 */

/**
 * Parse JWT token to get claims
 */
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

/**
 * Get current user data from token
 */
export function getCurrentUser() {
    const token = localStorage.getItem('adminToken');
    if (!token) return null;

    const claims = parseJwt(token);
    if (!claims) return null;

    return {
        id: claims.sub,
        role: claims.role,
        tenantId: claims.tenant_id,
        agencyId: claims.agency_id,
        managedAgencyIds: claims.managed_agency_ids // null for superadmin, array for manager
    };
}

/**
 * Check if user has superadmin role
 */
export function isSuperAdmin() {
    const user = getCurrentUser();
    return user && (user.role.toLowerCase() === 'superadmin' || user.role.toLowerCase() === 'admin');
}

/**
 * Check if user is a manager
 */
export function isManager() {
    const user = getCurrentUser();
    return user && user.role.toLowerCase() === 'manager';
}

/**
 * Get list of agencies the current user can access
 * Returns null for superadmin (all agencies), or array of IDs
 */
export function getAccessibleAgencyIds() {
    const user = getCurrentUser();
    if (!user) return [];

    const role = (user.role || '').toLowerCase();

    if (['superadmin', 'admin'].includes(role)) {
        return null; // All agencies
    }

    if (role === 'manager') {
        return user.managedAgencyIds || [];
    }

    // Staff - single agency
    return user.agencyId ? [user.agencyId] : [];
}

/**
 * Check if user can access a specific agency
 */
export function canAccessAgency(agencyId) {
    const accessible = getAccessibleAgencyIds();

    if (accessible === null) {
        return true; // Superadmin
    }

    return accessible.includes(agencyId);
}

/**
 * Get the default agency ID to use for filtering
 * For staff: their assigned agency
 * For manager: first managed agency
 * For superadmin: null (show all)
 */
export function getDefaultAgencyId() {
    const user = getCurrentUser();
    if (!user) return null;

    const role = (user.role || '').toLowerCase();

    if (['superadmin', 'admin'].includes(role)) {
        return null; // No filtering by default
    }

    if (role === 'manager' && user.managedAgencyIds && user.managedAgencyIds.length > 0) {
        return user.managedAgencyIds[0];
    }

    return user.agencyId;
}

/**
 * Build API query string with agency filter
 */
export function buildAgencyFilter(currentAgencyId = null) {
    // If explicit agency provided, use it
    if (currentAgencyId) {
        return `agencyId=${currentAgencyId}`;
    }

    // For staff, always filter by their agency
    const user = getCurrentUser();
    const role = user ? (user.role || '').toLowerCase() : '';

    if (user && !['superadmin', 'admin'].includes(role) && user.agencyId) {
        return `agencyId=${user.agencyId}`;
    }

    return '';
}
