import { CONFIG } from './config.js';

const LOGIN_API_URL = `${CONFIG.API_URL}/auth/login`;
const VERIFY_OTP_URL = `${CONFIG.API_URL}/auth/verify-otp`;

let currentStep = 'login'; // login | otp
let tempUserId = null;

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('btn-login');
    const errorEl = document.getElementById('login-error');
    const btnText = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.loader');

    // UI Loading State
    btn.disabled = true;
    btnText.classList.add('hidden');
    loader.classList.remove('hidden');
    errorEl.textContent = '';

    try {
        if (currentStep === 'login') {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            const response = await fetch(LOGIN_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.message || 'Erreur de connexion');

            if (data.otp_required) {
                // Switch to OTP Mode
                currentStep = 'otp';
                tempUserId = data.userId;

                document.getElementById('credentials-section').classList.add('hidden');
                document.getElementById('otp-section').classList.remove('hidden');
                btnText.textContent = 'Vérifier';

                // Focus OTP input
                setTimeout(() => document.getElementById('otp-code').focus(), 100);
            } else {
                handleLoginSuccess(data);
            }

        } else if (currentStep === 'otp') {
            const otp = document.getElementById('otp-code').value;

            const response = await fetch(VERIFY_OTP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: tempUserId, otp })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.message || 'Code invalide');

            handleLoginSuccess(data);
        }

    } catch (error) {
        errorEl.textContent = error.message;
    } finally {
        btn.disabled = false;
        if (currentStep === 'login') btnText.textContent = 'Se connecter';
        // if otp, text is already 'Vérifier' or we keep it
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
    }
});

function handleLoginSuccess(data) {
    localStorage.setItem('adminToken', data.token);
    localStorage.setItem('adminUser', JSON.stringify(data.user));
    window.location.href = 'index.html';
}
