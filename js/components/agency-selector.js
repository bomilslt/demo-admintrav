/**
 * Agency Selector Component
 * Logic for managing agency selection in header/modals.
 */
import { getAgencies } from '../services/api.js';
import { isSuperAdmin, isManager, getAccessibleAgencyIds } from '../utils/user-state.js';

let currentAgencyId = null;

export function getDefaultAgencyId() {
    return localStorage.getItem('selectedAgencyId') || null;
}

export async function createAgencySelector(container, onChangeCallback) {
    if (!container) return;

    // Load Agencies
    let agencies = [];
    try {
        const response = await getAgencies();
        agencies = Array.isArray(response) ? response : (response.data || []);
    } catch (e) {
        console.error('Agency Selector load error:', e);
        return;
    }

    // Filter accessible
    if (isSuperAdmin()) {
        // Add "All Agencies" option at the top
        agencies.unshift({ id: '', name: '🌍 Toutes les agences' });
    } else {
        const allowed = getAccessibleAgencyIds();
        if (allowed.length > 0) {
            agencies = agencies.filter(a => allowed.includes(a.id));
        }
    }

    if (agencies.length === 0) return;

    // Determine current selection
    const stored = localStorage.getItem('selectedAgencyId');

    // Check if stored ID is valid (allow '' as valid for superadmin)
    const isValidStored = agencies.some(a => a.id === (stored || ''));

    // Default to stored if valid, otherwise first available (usually 'all' for superadmin)
    currentAgencyId = isValidStored ? (stored || '') : agencies[0].id;

    // Save valid default if none/invalid
    if (!isValidStored) {
        localStorage.setItem('selectedAgencyId', currentAgencyId);
    }

    // Build HTML
    const wrapper = document.createElement('div');
    wrapper.className = 'agency-selector-wrapper';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '8px';
    wrapper.style.marginLeft = '10px';

    const label = document.createElement('span');
    label.textContent = 'Agence:';
    label.style.fontSize = '0.9rem';
    label.style.fontWeight = '500';

    const select = document.createElement('select');
    select.className = 'agency-selector'; // Ensure CSS exists or inline it
    select.style.padding = '6px 10px';
    select.style.border = '1px solid #d1d5db';
    select.style.borderRadius = '6px';
    select.style.backgroundColor = 'white';
    select.style.fontSize = '0.9rem';

    // Populate options
    agencies.forEach(agency => {
        const option = document.createElement('option');
        option.value = agency.id;
        option.textContent = agency.name;
        if (agency.id === currentAgencyId) option.selected = true;
        select.appendChild(option);
    });

    // Event Listener
    select.addEventListener('change', (e) => {
        const newId = e.target.value;
        currentAgencyId = newId;
        localStorage.setItem('selectedAgencyId', newId);
        if (onChangeCallback) onChangeCallback(newId);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    container.appendChild(wrapper);

    // Initial Callback to set state
    if (onChangeCallback) onChangeCallback(currentAgencyId);
}
