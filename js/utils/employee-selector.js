/**
 * Employee Selector Utility
 * Helper to create a dropdown for selecting employees (users)
 * Handles loading from API and filtering by agency
 */

import { getEmployees } from '../services/api.js';
import { getCurrentUser } from './user-state.js';

export async function createEmployeeSelector(container, options = {}) {
    // Options
    const {
        onSelect = null,
        initialValue = '',
        label = 'Employé:',
        showAllOption = true,
        allLabel = 'Tous les employés'
    } = options;

    // Create UI
    const wrapper = document.createElement('div');
    wrapper.className = 'employee-selector-wrapper';
    wrapper.innerHTML = `
        <label>${label}</label>
        <select class="form-select employee-select">
            <option value="">${allLabel}</option>
        </select>
    `;

    // Add styles if not present
    if (!document.getElementById('employee-selector-styles')) {
        const style = document.createElement('style');
        style.id = 'employee-selector-styles';
        style.textContent = `
            .employee-selector-wrapper {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .employee-selector-wrapper select {
                padding: 0.375rem 2.25rem 0.375rem 0.75rem;
                font-size: 0.875rem;
                background-color: #fff;
                border: 1px solid #ced4da;
                border-radius: 0.25rem;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }

    const select = wrapper.querySelector('select');

    // if (!showAllOption) {
    //     select.innerHTML = '';
    // }

    container.appendChild(wrapper);

    // Event listener
    select.addEventListener('change', (e) => {
        if (onSelect) {
            onSelect(e.target.value);
        }
    });

    // Function to load employees
    const loadEmployees = async (agencyId = null) => {
        try {
            select.disabled = true;
            select.innerHTML = showAllOption ? `<option value="">${allLabel}</option>` : '';

            const filters = {};
            if (agencyId) {
                filters.agencyId = agencyId;
            }

            // Get current user to see permissions? 
            // The API handles permission, we just pass agencyId request if needed.
            // If I am superadmin/manager, passing agencyId filters the list.
            // If I am staff, agencyId is ignored or must match my own.

            const employees = await getEmployees(filters);

            // Populate select
            employees.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.id;
                option.textContent = emp.name || emp.email;
                if (emp.id === initialValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

        } catch (error) {
            // Suppress 403 console log to avoid alarm
            if (error.message && (error.message.includes('403') || error.message.includes('Access denied'))) {
                const option = document.createElement('option');
                option.textContent = '🔒 Accès restreint (Agence externe)';
                select.appendChild(option);
            } else {
                console.error('Error loading employees:', error);
                const option = document.createElement('option');
                option.textContent = '⚠ Erreur de chargement';
                select.appendChild(option);
            }
        } finally {
            select.disabled = false;
        }
    };

    // Initial load (if no agency required, or load all)
    // We don't auto-load here to let the consumer decide when to load (e.g. after agency selection)
    // But for convenience we can load if allowed.
    // Let's expose loadEmployees.

    return {
        element: wrapper,
        selectElement: select,
        loadEmployees,
        setValue: (val) => { select.value = val; }
    };
}
