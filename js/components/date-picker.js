/**
 * DatePicker Component - Compact date picker with dropdown
 * A reusable date picker that displays as a button and opens a dropdown calendar
 * Uses SearchSelect for month/year selection for consistent UI
 */



export class DatePicker {
    /**
     * Create a DatePicker instance
     * @param {Object} options - Configuration options
     * @param {HTMLElement|string} options.container - Container element or selector
     * @param {string} options.placeholder - Placeholder text when no date selected
     * @param {Date|string} options.value - Initial date value
     * @param {Date|string} options.minDate - Minimum selectable date
     * @param {Date|string} options.maxDate - Maximum selectable date
     * @param {Function} options.onChange - Callback when date changes
     * @param {boolean} options.allowClear - Allow clearing the selection
     * @param {string} options.format - Display format ('short', 'long', 'iso')
     */
    constructor(options = {}) {
        this.options = {
            container: null,
            placeholder: 'Sélectionner...',
            value: null,
            minDate: null,
            maxDate: null,
            onChange: null,
            allowClear: true,
            format: 'short',
            ...options
        };

        this.container = null;
        this.element = null;
        this.button = null;
        this.dropdown = null;
        this.clearBtn = null;
        this.monthSelect = null;
        this.yearSelect = null;
        this.selectedDate = null;
        this.viewDate = new Date();
        this.isOpen = false;

        this._boundHandleClickOutside = this.handleClickOutside.bind(this);

        this.init();
    }

    /**
     * Initialize the component
     */
    init() {
        // Get container
        if (typeof this.options.container === 'string') {
            this.container = document.querySelector(this.options.container);
        } else {
            this.container = this.options.container;
        }

        if (!this.container) {
            console.error('DatePicker: Container not found');
            return;
        }

        // Parse initial value
        if (this.options.value) {
            this.selectedDate = this.parseDate(this.options.value);
            this.viewDate = new Date(this.selectedDate);
        }

        // Parse min/max dates
        if (this.options.minDate) {
            this.options.minDate = this.parseDate(this.options.minDate);
        }
        if (this.options.maxDate) {
            this.options.maxDate = this.parseDate(this.options.maxDate);
        }

        this.render();
        this.attachEventListeners();
    }

    /**
     * Parse date from various formats
     */
    parseDate(value) {
        if (!value) return null;
        if (value instanceof Date) return new Date(value);

        // Handle ISO date string (YYYY-MM-DD) - parse as local date, not UTC
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [year, month, day] = value.split('-').map(Number);
            return new Date(year, month - 1, day);
        }

        // Try other formats
        const date = new Date(value);
        if (!isNaN(date.getTime())) return date;

        return null;
    }

    /**
     * Format date as ISO string (YYYY-MM-DD) using local timezone
     * This avoids the UTC conversion that can cause day offset issues
     */
    toLocalISOString(date) {
        if (!date) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Render the component
     */
    render() {
        this.element = document.createElement('div');
        this.element.className = 'date-picker';

        // Button
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'date-picker-button';
        this.updateButtonText();

        // Clear button
        this.clearBtn = document.createElement('button');
        this.clearBtn.type = 'button';
        this.clearBtn.className = 'date-picker-clear';
        this.clearBtn.innerHTML = '&times;';
        this.clearBtn.style.display = this.selectedDate && this.options.allowClear ? 'flex' : 'none';

        // Dropdown
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'date-picker-dropdown';

        this.element.appendChild(this.button);
        if (this.options.allowClear) {
            this.element.appendChild(this.clearBtn);
        }
        this.element.appendChild(this.dropdown);

        this.container.appendChild(this.element);
    }

    /**
     * Update button text based on selected date
     */
    updateButtonText() {
        if (this.selectedDate) {
            const calendarIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
            this.button.innerHTML = `<span class="date-picker-icon">${calendarIcon}</span><span class="date-picker-text">${this.formatDate(this.selectedDate)}</span>`;
            this.button.classList.add('has-value');
        } else {
            const calendarIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
            this.button.innerHTML = `<span class="date-picker-icon">${calendarIcon}</span><span class="date-picker-text">${this.options.placeholder}</span>`;
            this.button.classList.remove('has-value');
        }
    }

    /**
     * Format date for display
     */
    formatDate(date) {
        if (!date) return '';

        switch (this.options.format) {
            case 'iso':
                return this.toLocalISOString(date);
            case 'long':
                return new Intl.DateTimeFormat('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                }).format(date);
            case 'short':
            default:
                return new Intl.DateTimeFormat('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }).format(date);
        }
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Button click - toggle dropdown
        this.button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Clear button
        this.clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.clear();
        });

        // Click outside to close
        document.addEventListener('click', this._boundHandleClickOutside);
    }

    /**
     * Handle click outside
     */
    handleClickOutside(e) {
        if (this.element && !this.element.contains(e.target)) {
            this.close();
        }
    }

    /**
     * Toggle dropdown
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Open dropdown
     */
    open() {
        if (this.isOpen) return;

        this.isOpen = true;
        this.element.classList.add('open');
        this.renderCalendar();
    }

    /**
     * Close dropdown
     */
    close() {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.element.classList.remove('open');

        // Destroy SearchSelect instances
        this.destroySelects();
    }

    /**
     * Destroy SearchSelect instances
     */
    destroySelects() {
        this.monthSelect = null;
        this.yearSelect = null;
    }

    /**
     * Get months data for SearchSelect
     */
    getMonthsData() {
        const months = [
            'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];

        return months.map((name, index) => ({
            id: index,
            name: name
        }));
    }

    /**
     * Get years data for SearchSelect
     */
    getYearsData() {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 10;
        const endYear = currentYear + 10;

        const years = [];
        for (let year = endYear; year >= startYear; year--) {
            years.push({
                id: year,
                name: year.toString()
            });
        }
        return years;
    }

    /**
     * Render calendar in dropdown
     */
    renderCalendar() {
        const year = this.viewDate.getFullYear();
        const month = this.viewDate.getMonth();

        // Destroy existing selects
        this.destroySelects();

        // Header with navigation
        const header = `
            <div class="date-picker-header">
                <button type="button" class="date-picker-nav date-picker-prev" data-action="prev-month">‹</button>
                <div class="date-picker-title">
                    <div class="date-picker-month-container" id="dp-month-${this.getUniqueId()}"></div>
                    <div class="date-picker-year-container" id="dp-year-${this.getUniqueId()}"></div>
                </div>
                <button type="button" class="date-picker-nav date-picker-next" data-action="next-month">›</button>
            </div>
        `;

        // Weekday headers
        const weekdays = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
        const weekdayHeaders = `
            <div class="date-picker-weekdays">
                ${weekdays.map(d => `<div class="date-picker-weekday">${d}</div>`).join('')}
            </div>
        `;

        // Days grid
        const days = this.getDaysInMonth(year, month);
        const daysGrid = `
            <div class="date-picker-days">
                ${days.map(day => this.renderDay(day)).join('')}
            </div>
        `;

        // Quick actions
        const quickActions = `
            <div class="date-picker-quick">
                <button type="button" class="date-picker-quick-btn" data-action="today">Aujourd'hui</button>
                <button type="button" class="date-picker-quick-btn" data-action="clear">Effacer</button>
            </div>
        `;

        this.dropdown.innerHTML = header + weekdayHeaders + daysGrid + quickActions;

        // Render Month Select
        const monthContainer = this.dropdown.querySelector(`#dp-month-${this.getUniqueId()}`);
        if (monthContainer) {
            const months = this.getMonthsData();
            const select = document.createElement('select');
            select.className = 'date-picker-select';
            months.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.name;
                if (m.id === month) opt.selected = true;
                select.appendChild(opt);
            });
            select.addEventListener('change', (e) => {
                this.viewDate.setMonth(parseInt(e.target.value));
                this.renderCalendarContent();
            });
            select.addEventListener('click', (e) => e.stopPropagation()); // Prevent closing
            monthContainer.appendChild(select);
            this.monthSelect = select;
        }

        // Render Year Select
        const yearContainer = this.dropdown.querySelector(`#dp-year-${this.getUniqueId()}`);
        if (yearContainer) {
            const years = this.getYearsData();
            const select = document.createElement('select');
            select.className = 'date-picker-select';
            years.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y.id;
                opt.textContent = y.name;
                if (y.id === year) opt.selected = true;
                select.appendChild(opt);
            });
            select.addEventListener('change', (e) => {
                this.viewDate.setFullYear(parseInt(e.target.value));
                this.renderCalendarContent();
            });
            select.addEventListener('click', (e) => e.stopPropagation()); // Prevent closing
            yearContainer.appendChild(select);
            this.yearSelect = select;
        }

        // Attach calendar event listeners
        this.attachCalendarListeners();
    }

    /**
     * Get unique ID for this instance
     */
    getUniqueId() {
        if (!this._uniqueId) {
            this._uniqueId = Math.random().toString(36).substr(2, 9);
        }
        return this._uniqueId;
    }

    /**
     * Render only the calendar content (days) without recreating selects
     */
    renderCalendarContent() {
        const year = this.viewDate.getFullYear();
        const month = this.viewDate.getMonth();

        // Update days grid
        const daysContainer = this.dropdown.querySelector('.date-picker-days');
        if (daysContainer) {
            const days = this.getDaysInMonth(year, month);
            daysContainer.innerHTML = days.map(day => this.renderDay(day)).join('');

            // Re-attach day click listeners
            daysContainer.querySelectorAll('.date-picker-day:not(.disabled)').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const dateStr = btn.dataset.date;
                    this.selectDate(new Date(dateStr));
                });
            });
        }

        // Update selects values
        if (this.monthSelect) {
            this.monthSelect.value = month;
        }
        if (this.yearSelect) {
            this.yearSelect.value = year;
        }
    }

    /**
     * Get days in month with padding for calendar grid
     */
    getDaysInMonth(year, month) {
        const days = [];
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Get the day of week for the first day (0 = Sunday, adjust for Monday start)
        let startDayOfWeek = firstDay.getDay();
        startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

        // Add padding days from previous month
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            days.push({
                date: new Date(year, month - 1, prevMonthLastDay - i),
                isCurrentMonth: false
            });
        }

        // Add days of current month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            days.push({
                date: new Date(year, month, day),
                isCurrentMonth: true
            });
        }

        // Add padding days from next month
        const remainingDays = 42 - days.length; // 6 rows × 7 days
        for (let day = 1; day <= remainingDays; day++) {
            days.push({
                date: new Date(year, month + 1, day),
                isCurrentMonth: false
            });
        }

        return days;
    }

    /**
     * Render a single day cell
     */
    renderDay(dayInfo) {
        const { date, isCurrentMonth } = dayInfo;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dateNormalized = new Date(date);
        dateNormalized.setHours(0, 0, 0, 0);

        const classes = ['date-picker-day'];

        if (!isCurrentMonth) {
            classes.push('other-month');
        }

        if (dateNormalized.getTime() === today.getTime()) {
            classes.push('today');
        }

        if (this.selectedDate) {
            const selectedNormalized = new Date(this.selectedDate);
            selectedNormalized.setHours(0, 0, 0, 0);
            if (dateNormalized.getTime() === selectedNormalized.getTime()) {
                classes.push('selected');
            }
        }

        // Check min/max constraints
        let disabled = false;
        if (this.options.minDate && dateNormalized < this.options.minDate) {
            disabled = true;
            classes.push('disabled');
        }
        if (this.options.maxDate && dateNormalized > this.options.maxDate) {
            disabled = true;
            classes.push('disabled');
        }

        // Use local date formatting to avoid UTC offset issues
        const dateStr = this.toLocalISOString(date);

        return `<button type="button" class="${classes.join(' ')}" data-date="${dateStr}" ${disabled ? 'disabled' : ''}>${date.getDate()}</button>`;
    }

    /**
     * Attach calendar event listeners
     */
    attachCalendarListeners() {
        // Navigation buttons
        this.dropdown.querySelector('.date-picker-prev')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateMonth(-1);
        });

        this.dropdown.querySelector('.date-picker-next')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateMonth(1);
        });

        // Day buttons
        this.dropdown.querySelectorAll('.date-picker-day:not(.disabled)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dateStr = btn.dataset.date;
                this.selectDate(new Date(dateStr));
            });
        });

        // Quick actions
        this.dropdown.querySelector('[data-action="today"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectDate(new Date());
        });

        this.dropdown.querySelector('[data-action="clear"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.clear();
        });
    }

    /**
     * Navigate to previous/next month
     */
    navigateMonth(delta) {
        this.viewDate.setMonth(this.viewDate.getMonth() + delta);
        this.renderCalendarContent();
    }

    /**
     * Select a date
     */
    selectDate(date) {
        this.selectedDate = date;
        this.viewDate = new Date(date);
        this.updateButtonText();
        this.clearBtn.style.display = this.options.allowClear ? 'flex' : 'none';
        this.close();

        // Trigger callback
        if (this.options.onChange) {
            this.options.onChange(date, this.getValue());
        }

        // Dispatch custom event
        this.element.dispatchEvent(new CustomEvent('change', {
            detail: { date, value: this.getValue() }
        }));
    }

    /**
     * Clear selection
     */
    clear() {
        this.selectedDate = null;
        this.viewDate = new Date();
        this.updateButtonText();
        this.clearBtn.style.display = 'none';
        this.close();

        // Trigger callback
        if (this.options.onChange) {
            this.options.onChange(null, null);
        }

        // Dispatch custom event
        this.element.dispatchEvent(new CustomEvent('clear'));
    }

    /**
     * Get value as ISO string (YYYY-MM-DD) using local timezone
     */
    getValue() {
        if (!this.selectedDate) return null;
        return this.toLocalISOString(this.selectedDate);
    }

    /**
     * Get selected date object
     */
    getDate() {
        return this.selectedDate ? new Date(this.selectedDate) : null;
    }

    /**
     * Set value programmatically
     */
    setValue(value) {
        if (!value) {
            this.clear();
            return;
        }

        const date = this.parseDate(value);
        if (date) {
            this.selectedDate = date;
            this.viewDate = new Date(date);
            this.updateButtonText();
            this.clearBtn.style.display = this.options.allowClear ? 'flex' : 'none';
        }
    }

    /**
     * Set min date
     */
    setMinDate(date) {
        this.options.minDate = this.parseDate(date);
        if (this.isOpen) {
            this.renderCalendarContent();
        }
    }

    /**
     * Set max date
     */
    setMaxDate(date) {
        this.options.maxDate = this.parseDate(date);
        if (this.isOpen) {
            this.renderCalendarContent();
        }
    }

    /**
     * Enable/disable the component
     */
    setDisabled(disabled) {
        this.button.disabled = disabled;
        this.element.classList.toggle('disabled', disabled);
        if (disabled) {
            this.close();
        }
    }

    /**
     * Destroy the component
     */
    destroy() {
        document.removeEventListener('click', this._boundHandleClickOutside);

        this.destroySelects();

        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }

        this.element = null;
        this.button = null;
        this.dropdown = null;
        this.clearBtn = null;
    }
}

export default DatePicker;
