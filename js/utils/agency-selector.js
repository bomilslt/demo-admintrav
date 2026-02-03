/**
 * Agency Selector Component
 * Shows dropdown for superadmins to filter by agency
 */

import { isSuperAdmin, isManager, getAccessibleAgencyIds, getCurrentUser } from './user-state.js';
import { getAgencies } from '../services/api.js';

/**
 * Create and insert agency selector into a container
 * @param {HTMLElement} container - Container to insert selector
 * @param {function} onAgencyChange - Callback when agency changes
 */
export async function createAgencySelector(container, onAgencyChange) {
    const user = getCurrentUser();

    // Only show for superadmin and manager
    const role = (user && user.role) ? user.role.toLowerCase() : '';
    if (!user || (!['superadmin', 'admin'].includes(role) && role !== 'manager')) {
        return null;
    }

    // Create selector HTML
    const selectorDiv = document.createElement('div');
    selectorDiv.className = 'agency-selector-wrapper';
    selectorDiv.innerHTML = `
        <label for="agency-filter">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Agence:
        </label>
        <select id="agency-filter" class="form-select agency-selector">
            <option value="">Toutes les agences</option>
        </select>
    `;

    container.appendChild(selectorDiv);

    const select = selectorDiv.querySelector('#agency-filter');

    // Load agencies
    try {
        const agencies = await getAgencies();
        const accessibleIds = getAccessibleAgencyIds();

        agencies.forEach(agency => {
            // Filter for managers
            if (accessibleIds !== null && !accessibleIds.includes(agency.id)) {
                return;
            }

            const option = document.createElement('option');
            option.value = agency.id;
            option.textContent = `${agency.name} (${agency.city || ''})`;
            select.appendChild(option);
        });

        // For managers, pre-select first agency and hide "all" option
        if (user.role === 'manager' && accessibleIds && accessibleIds.length > 0) {
            select.querySelector('option[value=""]').style.display = 'none';
            select.value = accessibleIds[0];
        }

    } catch (error) {
        console.error('Failed to load agencies:', error);
    }

    // Handle change
    select.addEventListener('change', (e) => {
        const selectedAgencyId = e.target.value || null;
        if (onAgencyChange) {
            onAgencyChange(selectedAgencyId);
        }
    });

    return select;
}

/**
 * CSS for the agency selector (add to your stylesheet)
 */
export const agencySelectorStyles = `
.agency-selector-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-secondary, #f5f5f5);
    border-radius: 8px;
    margin-bottom: 1rem;
}

.agency-selector-wrapper label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-weight: 500;
    color: var(--text-secondary, #666);
}

.agency-selector {
    min-width: 200px;
    padding: 0.5rem;
    border: 1px solid var(--border-color, #ddd);
    border-radius: 6px;
    background: white;
    cursor: pointer;
}

.agency-selector:focus {
    outline: none;
    border-color: var(--primary-color, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}
`;
