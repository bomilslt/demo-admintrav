/**
 * Settings View
 */
import { API_BASE_URL } from '../../js/services/api.js';
import { CONFIG } from '../../js/config.js';
import { isSuperAdmin } from '../../js/utils/user-state.js';

// Re-using common API helper logic or direct fetch for specific config
function apiCall(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('adminToken');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'X-Tenant-ID': CONFIG.TENANT_ID
    };

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    return fetch(`${API_BASE_URL}${endpoint}`, config).then(res => res.json());
}

let paymentConfigs = [];
let currentLogoBase64 = null;

export function init() {
    // Strict Access Control
    if (!isSuperAdmin()) {
        window.location.hash = '#/dashboard';
        // Wait for UIUtils to load or just alert
        // Assuming showToast is global or we import it?
        // main.js exposes window.showToast usually, or check imports.
        // But main.js handles toast.
        setTimeout(() => {
            if (window.showToast) window.showToast('Accès refusé', 'Zone strictement réservée aux administrateurs.', 'error');
        }, 500);
        return;
    }

    console.log("Settings View Initialized");
    setupTabs();
    loadSettings();
    loadPaymentConfigs();
    loadReceiptSettings();
    setupActions();
    setupLogoUpload();
    loadGlobalConfig();
    loadNotificationConfig();
}

async function loadGlobalConfig() {
    try {
        const config = await apiCall('/settings/global');
        if (config) {
            if (config.refundDeadlineHours !== undefined) {
                setVal('setting-refund-deadline', config.refundDeadlineHours);
            }
            if (config.refundPenaltyPercent !== undefined) {
                setVal('setting-refund-penalty', config.refundPenaltyPercent);
            }
            if (config.companyName) {
                setVal('setting-app-name', config.companyName);
            }
            if (config.supportEmail) {
                setVal('setting-support-email', config.supportEmail);
            }
            if (config.supportPhone) {
                setVal('setting-support-phone', config.supportPhone);
            }
        }
    } catch (e) {
        console.error("Failed to load global config:", e);
    }
}



function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });
}

function setupActions() {
    const btnSave = document.getElementById('btn-save-settings');
    if (btnSave) {
        btnSave.addEventListener('click', saveAll);
    }
}

async function loadPaymentConfigs() {
    const container = document.getElementById('payments-config-container');
    if (!container) return;

    try {
        paymentConfigs = await apiCall('/payments/configs');
        renderPaymentConfigs();
    } catch (e) {
        console.error('Failed to load payment configs', e);
        container.innerHTML = '<p class="text-error">Impossible de charger les configurations.</p>';
    }
}

function renderPaymentConfigs() {
    const container = document.getElementById('payments-config-container');
    const providers = [
        { id: 'om', name: 'Orange Money', icon: '/images/om.png' },
        { id: 'mtn', name: 'MTN Mobile Money', icon: '/images/momo.png' },
        { id: 'stripe', name: 'Stripe (Carte Bancaire)', icon: '/images/stripe.png' },
        { id: 'monetbill', name: 'MonetBill (Agrégateur)', icon: '/images/monetbill.jpg', isAggregator: true }
    ];

    container.innerHTML = providers.map(p => {
        const config = paymentConfigs.find(c => c.provider === p.id) || { isActive: false, isTestMode: true, publicKey: '', merchantId: '' };

        return `
        <div class="payment-row" data-provider="${p.id}">
            <img src="${p.icon}" class="payment-icon" alt="${p.name}">
            <div class="payment-content">
                <div class="payment-header">
                    <div>
                        <span class="payment-title">${p.name}</span>
                        ${config.isTestMode ? '<span class="badge-test" id="badge-' + p.id + '">TEST MODE</span>' : ''}
                    </div>
                    <label class="switch">
                        <input type="checkbox" class="toggle-active" ${config.isActive ? 'checked' : ''} onchange="window.togglePaymentInputs('${p.id}')">
                        <span class="slider round"></span>
                    </label>
                </div>
                
                <div class="payment-inputs ${config.isActive ? '' : 'hidden'}" id="inputs-${p.id}">
                    <div class="form-section" style="grid-column: 1/-1; display:flex; gap:8px; align-items:center;">
                        <input type="checkbox" id="test-${p.id}" ${config.isTestMode ? 'checked' : ''} onchange="window.toggleTestBadge('${p.id}')">
                        <label for="test-${p.id}" style="margin:0; font-size:0.9rem;">Mode Test (Sandbox)</label>
                    </div>
                    
                    <div class="form-section">
                        <label>Public Key / Client ID</label>
                        <input type="text" class="form-input" id="pub-${p.id}" value="${config.publicKey || ''}" placeholder="pk_test_...">
                    </div>
                    <div class="form-section">
                        <label>Secret Key (Masqué)</label>
                        <input type="password" class="form-input" id="sec-${p.id}" placeholder="Laisser vide pour ne pas changer">
                    </div>
                    ${p.id === 'om' || p.id === 'mtn' ? `
                    <div class="form-section">
                        <label>Merchant ID / Phone</label>
                        <input type="text" class="form-input" id="mer-${p.id}" value="${config.merchantId || ''}">
                    </div>` : ''}
                </div>
            </div>
        </div>
        `;
    }).join('');

    // Global helpers needed for inline events
    window.togglePaymentInputs = (id) => {
        const el = document.getElementById(`inputs-${id}`);
        if (el) el.classList.toggle('hidden');
    };

    window.toggleTestBadge = (id) => {
        const check = document.getElementById(`test-${id}`);
        const badge = document.getElementById(`badge-${id}`);
    };
}

// =============================================================================
// RECEIPT SETTINGS & PREVIEW
// =============================================================================

function updatePreview() {
    const header = getVal('receipt-header') || "INTERCITY TRANSPORT";
    const footer = getVal('receipt-footer') || "Merci de votre visite";

    // Check elements existence to avoid errors if tab hidden
    const previewHeader = document.getElementById('preview-header');
    if (!previewHeader) return;

    previewHeader.textContent = header;
    document.getElementById('preview-footer').textContent = footer;

    const showLogo = document.getElementById('receipt-show-logo').checked;
    const showQr = document.getElementById('receipt-show-qr').checked;

    // Layout Config
    const qrContainer = document.getElementById('preview-qr-container');
    if (qrContainer) qrContainer.style.display = showQr ? 'block' : 'none';

    // LOGO LOGIC (Mini & Thermal)
    const thermalLogoContainer = document.getElementById('preview-logo-container');
    const thermalLogoImg = document.getElementById('preview-logo-img');
    const miniLogoPreview = document.getElementById('receipt-logo-preview');
    const miniLogoImg = miniLogoPreview ? miniLogoPreview.querySelector('img') : null;

    if (currentLogoBase64) {
        // We have logo data

        // 1. Update Thermal Preview (Only if 'Show Logo' is checked)
        if (showLogo) {
            if (thermalLogoImg) {
                thermalLogoImg.src = currentLogoBase64;
                thermalLogoImg.style.display = 'inline-block';
            }
            if (thermalLogoContainer) thermalLogoContainer.style.display = 'block';
        } else {
            if (thermalLogoContainer) thermalLogoContainer.style.display = 'none';
        }

        // 2. Update Mini Preview (ALWAYS show if data exists, to confirm upload)
        if (miniLogoImg) {
            miniLogoImg.src = currentLogoBase64;
            miniLogoImg.style.display = 'block';
            if (miniLogoPreview) miniLogoPreview.style.display = 'block';
        }
    } else {
        // No logo data
        if (thermalLogoContainer) thermalLogoContainer.style.display = 'none';
        if (miniLogoPreview) miniLogoPreview.style.display = 'none';
    }
}

function setupReceiptListeners() {
    const ids = ['receipt-header', 'receipt-footer', 'receipt-show-logo', 'receipt-show-qr'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updatePreview);
            el.addEventListener('change', updatePreview);
        }
    });
}

async function loadReceiptSettings() {
    try {
        const config = await apiCall('/settings/receipt');
        setVal('receipt-header', config.headerText);
        setVal('receipt-footer', config.footerText);

        if (document.getElementById('receipt-show-qr')) {
            document.getElementById('receipt-show-qr').checked = config.showQr;
        }
        if (document.getElementById('receipt-show-logo')) {
            document.getElementById('receipt-show-logo').checked = config.showLogo;
        }

        // Init State
        if (config.logoData) {
            currentLogoBase64 = config.logoData;
        }

        setupReceiptListeners();
        updatePreview();

    } catch (e) {
        console.error("Failed to load receipt settings", e);
    }
}

function setupLogoUpload() {
    const input = document.getElementById('receipt-logo-input');
    if (!input) return;

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 500 * 1024) {
            window.showAlert('Erreur', 'L\'image est trop lourde (Max 500KB)', 'error');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            currentLogoBase64 = event.target.result;
            updatePreview();
        };
        reader.readAsDataURL(file);
    });
}

// NOTIFICATIONS Logic
window.toggleEmailSettings = () => {
    const provider = document.getElementById('notif-email-provider').value;
    const smtp = document.getElementById('smtp-settings');
    const ses = document.getElementById('ses-settings');
    const mailgun = document.getElementById('mailgun-settings');

    if (smtp) smtp.style.display = provider === 'smtp' ? 'block' : 'none';
    if (ses) ses.style.display = provider === 'ses' ? 'block' : 'none';
    if (mailgun) mailgun.style.display = provider === 'mailgun' ? 'block' : 'none';
};

async function loadNotificationConfig() {
    try {
        const config = await apiCall('/settings/notifications');

        // OTP
        if (document.getElementById('notif-otp-active'))
            document.getElementById('notif-otp-active').checked = config.otpActive;

        // Email
        if (document.getElementById('notif-email-active'))
            document.getElementById('notif-email-active').checked = config.emailActive;

        if (document.getElementById('notif-email-provider'))
            document.getElementById('notif-email-provider').value = config.emailProvider;

        // SMTP
        setVal('notif-smtp-host', config.smtpHost);
        setVal('notif-smtp-port', config.smtpPort);
        setVal('notif-smtp-user', config.smtpUser);
        if (document.getElementById('notif-smtp-tls'))
            document.getElementById('notif-smtp-tls').checked = config.smtpUseTls;
        setVal('notif-smtp-from', config.smtpFromEmail);

        // SES
        setVal('notif-aws-key', config.awsAccessKey);
        setVal('notif-aws-region', config.awsRegion);

        // Mailgun
        setVal('notif-mailgun-key', config.mailgunApiKey);
        setVal('notif-mailgun-domain', config.mailgunDomain);
        setVal('notif-mailgun-from', config.mailgunFromEmail);

        // SMS
        if (document.getElementById('notif-sms-active'))
            document.getElementById('notif-sms-active').checked = config.smsActive;
        if (document.getElementById('notif-sms-provider'))
            document.getElementById('notif-sms-provider').value = config.smsProvider;
        if (document.getElementById('notif-sms-key'))
            setVal('notif-sms-key', config.smsApiKey);

        window.toggleEmailSettings(); // Set initial visibility

    } catch (e) {
        console.error("Failed to load notifications config", e);
    }
}

async function saveAll() {
    const btn = document.getElementById('btn-save-settings');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    try {
        // 1. Save Local Settings
        saveLocalSettings();

        // 2. Save Payment Configs
        const providers = ['om', 'mtn', 'stripe', 'monetbill'];
        const paymentPromises = providers.map(p => {
            const isActive = document.querySelector(`.payment-row[data-provider="${p}"] .toggle-active`).checked;
            const isTestMode = document.getElementById(`test-${p}`).checked;
            const publicKey = document.getElementById(`pub-${p}`).value;
            const secretKey = document.getElementById(`sec-${p}`).value;
            const merchantId = document.getElementById(`mer-${p}`) ? document.getElementById(`mer-${p}`).value : null;

            return apiCall('/payments/configs', 'POST', {
                provider: p,
                isActive,
                isTestMode,
                publicKey,
                secretKey,
                merchantId
            });
        });

        // 3. Save Receipt Config
        let receiptPayload = {
            headerText: getVal('receipt-header'),
            footerText: getVal('receipt-footer'),
            showQr: document.getElementById('receipt-show-qr').checked,
            showLogo: document.getElementById('receipt-show-logo').checked
        };
        if (currentLogoBase64) {
            receiptPayload.logoData = currentLogoBase64;
        }

        // 4. Save Global Config (Refund Deadline & Company Name)
        const globalPayload = {
            companyName: getVal('setting-app-name'),
            supportEmail: getVal('setting-support-email'),
            supportPhone: getVal('setting-support-phone'),
            refundDeadlineHours: parseInt(getVal('setting-refund-deadline')) || 24,
            refundPenaltyPercent: parseInt(getVal('setting-refund-penalty')) || 0
        };

        // 5. Save Notification Config
        const notifPayload = {
            otpActive: document.getElementById('notif-otp-active')?.checked ?? false,
            emailActive: document.getElementById('notif-email-active')?.checked ?? false,
            emailProvider: getVal('notif-email-provider'),
            smtpHost: getVal('notif-smtp-host'),
            smtpPort: getVal('notif-smtp-port'),
            smtpUser: getVal('notif-smtp-user'),
            smtpPassword: getVal('notif-smtp-pass'),
            smtpUseTls: document.getElementById('notif-smtp-tls')?.checked ?? true,
            smtpFromEmail: getVal('notif-smtp-from'),
            awsRegion: getVal('notif-aws-region'),
            mailgunDomain: getVal('notif-mailgun-domain'),
            mailgunFromEmail: getVal('notif-mailgun-from'),
            smsActive: document.getElementById('notif-sms-active')?.checked ?? false,
            smsProvider: getVal('notif-sms-provider'),
        };

        // Only send masked keys if they were actually changed
        const awsKey = getVal('notif-aws-key');
        if (awsKey && !awsKey.startsWith('****')) notifPayload.awsAccessKey = awsKey;
        const awsSecret = getVal('notif-aws-secret');
        if (awsSecret && !awsSecret.startsWith('****')) notifPayload.awsSecretKey = awsSecret;
        const mailgunKey = getVal('notif-mailgun-key');
        if (mailgunKey && !mailgunKey.startsWith('****')) notifPayload.mailgunApiKey = mailgunKey;
        const smsKey = getVal('notif-sms-key');
        if (smsKey && !smsKey.startsWith('****')) notifPayload.smsApiKey = smsKey;

        await Promise.all([
            ...paymentPromises,
            apiCall('/settings/receipt', 'POST', receiptPayload),
            apiCall('/settings/global', 'POST', globalPayload),
            apiCall('/settings/notifications', 'POST', notifPayload)
        ]);

        window.showAlert('Succès', 'Tout est enregistré !', 'success');

        await loadPaymentConfigs();
        await loadReceiptSettings();
        await loadNotificationConfig();

    } catch (error) {
        console.error("Save failed:", error);
        window.showAlert('Erreur', 'Echec de l\'enregistrement', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
            <svg class="icon-svg" style="width:18px;height:18px;margin-right:6px" viewBox="0 0 24 24">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Enregistrer les modifications
        `;
    }
}

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('app_settings')) || {
        // appName: 'INTERCITY', // Moved to API
        supportEmail: 'support@intercity.com',
        currency: 'XAF',
        language: 'fr',
        taxRate: '19.25',
        stampFee: '1000',
        cancellationWindow: '24',
        maintenanceMode: false,
        debugMode: false
    };

    // setVal('setting-app-name', settings.appName); // Handled by loadGlobalConfig
    // setVal('setting-support-email', settings.supportEmail); // Handled by loadGlobalConfig
    setVal('setting-tax-rate', settings.taxRate);
    setVal('setting-stamp-fee', settings.stampFee);
    setVal('setting-cancellation-window', settings.cancellationWindow);

    if (document.getElementById('setting-currency')) document.getElementById('setting-currency').value = settings.currency;
    if (document.getElementById('setting-language')) document.getElementById('setting-language').value = settings.language;
    if (document.getElementById('setting-maintenance-mode')) document.getElementById('setting-maintenance-mode').checked = settings.maintenanceMode;
    if (document.getElementById('setting-debug-mode')) document.getElementById('setting-debug-mode').checked = settings.debugMode;
}

function saveLocalSettings() {
    const settings = {
        // appName moved to Global Config
        supportEmail: getVal('setting-support-email'),
        currency: getVal('setting-currency'),
        language: getVal('setting-language'),
        taxRate: getVal('setting-tax-rate'),
        stampFee: getVal('setting-stamp-fee'),
        cancellationWindow: getVal('setting-cancellation-window'),
        maintenanceMode: document.getElementById('setting-maintenance-mode').checked,
        debugMode: document.getElementById('setting-debug-mode').checked
    };
    localStorage.setItem('app_settings', JSON.stringify(settings));
}

// Helpers
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
