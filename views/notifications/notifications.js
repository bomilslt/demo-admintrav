/**
 * Notifications View
 */

import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../js/services/api.js';

let allNotifications = [];
let currentFilter = 'all';

export async function init() {
    await loadNotifications();
    setupFilters();
    setupActions();
}

async function loadNotifications() {
    allNotifications = await getNotifications();
    renderList();
}

function setupFilters() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderList();
        });
    });
}

function setupActions() {
    const btnMarkAll = document.getElementById('btn-mark-all-read');
    if (btnMarkAll) {
        btnMarkAll.addEventListener('click', async () => {
            await markAllNotificationsAsRead();
            await loadNotifications();
            window.showAlert('Succès', 'Toutes les notifications ont été marquées comme lues', 'success');
        });
    }
}

function renderList() {
    const list = document.getElementById('notifications-list');
    if (!list) return;

    let filtered = allNotifications;

    if (currentFilter === 'unread') {
        filtered = filtered.filter(n => !n.read);
    }

    if (filtered.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 60px; color: var(--text-muted);">
                <svg class="icon-svg" style="width:48px;height:48px;margin-bottom:16px;opacity:0.5" viewBox="0 0 24 24">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <p>Aucune notification</p>
            </div>
        `;
        return;
    }

    list.innerHTML = filtered.map(n => `
        <div class="notification-item ${n.read ? 'read' : 'unread'}" onclick="window.markRead('${n.id}')">
            <div class="notification-icon ${n.type}">
                ${getIconForType(n.type)}
            </div>
            <div class="notification-content">
                <div class="notification-header">
                    <span class="notification-title">${n.title}</span>
                    <span class="notification-time">${n.time}</span>
                </div>
                <p class="notification-message">${n.message}</p>
            </div>
            ${!n.read ? '<div class="notification-dot"></div>' : ''}
        </div>
    `).join('');
}

function getIconForType(type) {
    switch (type) {
        case 'warning':
            return `<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        case 'error':
            return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        case 'success':
            return `<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        default: // info
            return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
}

// Global functions
window.markRead = async (id) => {
    const notif = allNotifications.find(n => n.id === id);
    if (notif && !notif.read) {
        await markNotificationAsRead(id);
        await loadNotifications(); // Refresh to update UI
    }
};
