/**
 * UI Utilities - Global Components
 * Custom alerts, confirms, and helpers
 */

/**
 * Show a custom alert modal
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {string} type - 'success', 'error', 'info', 'warning'
 */
export function showCustomAlert(title, message, type = 'info') {
    return new Promise((resolve) => {
        const modalId = 'global-alert-modal';
        let modal = document.getElementById(modalId);

        if (!modal) {
            modal = createGlobalModal(modalId);
            document.body.appendChild(modal);
        }

        const iconMap = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const content = `
            <div class="modal-dialog small-dialog">
                <div class="modal-header ${type}">
                    <h3>${iconMap[type] || ''} ${title}</h3>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="${modalId}-ok">OK</button>
                </div>
            </div>
        `;

        modal.innerHTML = content;
        modal.classList.add('active');

        // Event handling
        const btnOk = document.getElementById(`${modalId}-ok`);
        const close = () => {
            modal.classList.remove('active');
            resolve();
        };

        btnOk.onclick = close;

        // Close on clean up if needed, but for alert we force OK
    });
}

/**
 * Show a custom confirm modal
 * @param {string} title - Confirm title
 * @param {string} message - Question
 * @returns {Promise<boolean>} - True if confirmed, false otherwise
 */
export function showCustomConfirm(title, message, confirmText = 'Confirmer', cancelText = 'Annuler') {
    return new Promise((resolve) => {
        const modalId = 'global-confirm-modal';
        let modal = document.getElementById(modalId);

        if (!modal) {
            modal = createGlobalModal(modalId);
            document.body.appendChild(modal);
        }

        const content = `
            <div class="modal-dialog small-dialog">
                <div class="modal-header">
                    <h3>❓ ${title}</h3>
                    <button class="modal-close-x">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-text" id="${modalId}-cancel">${cancelText}</button>
                    <button class="btn btn-primary" id="${modalId}-confirm">${confirmText}</button>
                </div>
            </div>
        `;

        modal.innerHTML = content;
        modal.classList.add('active');

        const cleanup = () => {
            modal.classList.remove('active');
        };

        document.getElementById(`${modalId}-confirm`).onclick = () => {
            cleanup();
            resolve(true);
        };

        document.getElementById(`${modalId}-cancel`).onclick = () => {
            cleanup();
            resolve(false);
        };

        modal.querySelector('.modal-close-x').onclick = () => {
            cleanup();
            resolve(false);
        };
    });
}

function createGlobalModal(id) {
    const div = document.createElement('div');
    div.id = id;
    div.className = 'modal-overlay global-modal';
    return div;
}

/**
 * Show a custom prompt modal
 * @param {string} title 
 * @param {string} message 
 * @param {string} placeholder 
 * @returns {Promise<string|null>} User input or null if cancelled
 */
export function showCustomPrompt(title, message, placeholder = '') {
    return new Promise((resolve) => {
        const modalId = 'global-prompt-modal';
        let modal = document.getElementById(modalId);

        if (!modal) {
            modal = createGlobalModal(modalId);
            document.body.appendChild(modal);
        }

        const content = `
            <div class="modal-dialog small-dialog">
                <div class="modal-header">
                    <h3>✏️ ${title}</h3>
                    <button class="modal-close-x">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom:12px;">${message}</p>
                    <input type="text" id="${modalId}-input" class="form-control" placeholder="${placeholder}" style="width:100%;">
                </div>
                <div class="modal-footer">
                    <button class="btn btn-text" id="${modalId}-cancel">Annuler</button>
                    <button class="btn btn-primary" id="${modalId}-confirm">Valider</button>
                </div>
            </div>
        `;

        modal.innerHTML = content;
        modal.classList.add('active');

        const input = document.getElementById(`${modalId}-input`);
        input.focus();

        const cleanup = () => {
            modal.classList.remove('active');
        };

        const confirm = () => {
            const val = input.value;
            cleanup();
            resolve(val);
        };

        const cancel = () => {
            cleanup();
            resolve(null);
        };

        document.getElementById(`${modalId}-confirm`).onclick = confirm;
        document.getElementById(`${modalId}-cancel`).onclick = cancel;
        modal.querySelector('.modal-close-x').onclick = cancel;

        // Handle Enter key
        input.onkeydown = (e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') cancel();
        };
    });
}
window.showPrompt = showCustomPrompt;

// Make globally available
window.showAlert = showCustomAlert;
window.showConfirm = showCustomConfirm;

/**
 * Set button loading state
 * @param {HTMLElement} btn 
 * @param {boolean} isLoading 
 * @param {string} text Optional loading text
 */
export function setBtnLoading(btn, isLoading, text = 'En cours...') {
    if (!btn) {
        console.error('setBtnLoading: button not found');
        return;
    }

    if (isLoading) {
        console.log('Loading ON', btn);
        // Prevent double loading state
        if (btn.dataset.loading === 'true') return;

        // Inject animation style if missing
        if (!document.getElementById('spin-anim-style')) {
            const style = document.createElement('style');
            style.id = 'spin-anim-style';
            style.textContent = `@keyframes spin-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }

        btn.dataset.loading = 'true';
        btn.dataset.originalContent = btn.innerHTML;
        // btn.style.width = `${btn.offsetWidth}px`; // Removed to allow horizontal expansion
        btn.disabled = true;

        // Inline SVG Spinner (Optimized for Flex)
        const spinner = `
            <svg style="animation: spin-rotate 1s linear infinite; width: 18px; height: 18px; margin-right: 8px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.2"></circle>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"></path>
            </svg>`;

        btn.innerHTML = `${spinner} ${text}`;
    } else {
        console.log('Loading OFF', btn);
        btn.dataset.loading = 'false';
        btn.disabled = false;
        btn.style.width = '';
        if (btn.dataset.originalContent) {
            btn.innerHTML = btn.dataset.originalContent;
        }
    }
}
window.setBtnLoading = setBtnLoading;

/**
 * Show global loading overlay
 * @param {string} text 
 */
export function showLoadingOverlay(text = 'Chargement...') {
    let overlay = document.getElementById('global-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'global-loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner-large"></div>
            <div class="loading-text" id="global-loading-text">${text}</div>
        `;
        document.body.appendChild(overlay);
    } else {
        document.getElementById('global-loading-text').textContent = text;
    }
    overlay.classList.add('active');
}
window.showLoading = showLoadingOverlay;

/**
 * Hide global loading overlay
 */
export function hideLoadingOverlay() {
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}
window.hideLoading = hideLoadingOverlay;
