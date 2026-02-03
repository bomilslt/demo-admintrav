import { apiCall } from '../../js/services/api.js';

let allRequests = [];

export async function init() {
    await loadRefundRequests();
}

async function loadRefundRequests() {
    const tbody = document.getElementById('refunds-table');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Chargement...</td></tr>';

    try {
        // Fetch bookings where refundStatus = requested
        const response = await apiCall('/bookings?refundStatus=requested&limit=100');
        allRequests = response.data;
        renderTable();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:red">Erreur: ${e.message}</td></tr>`;
    }
}

function renderTable() {
    const tbody = document.getElementById('refunds-table');

    if (allRequests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#888">Aucune demande de remboursement en attente</td></tr>';
        return;
    }

    tbody.innerHTML = allRequests.map(r => `
        <tr>
            <td style="font-family:monospace">${r.id.substring(0, 8)}...</td>
            <td>
                <div>${r.passengerName}</div>
                <div style="font-size:0.8em; color:#666">${r.phone}</div>
            </td>
            <td style="font-weight:bold">${r.amountPaid ? r.amountPaid.toLocaleString() : 0} XAF</td>
            <td>-</td> <!-- Request date not tracked yet -->
            <td>
                <div>${r.departure.origin} → ${r.departure.destination}</div>
                <div style="font-size:0.8em">${new Date(r.departure.date).toLocaleDateString()}</div>
            </td>
            <td><span class="badge warning">Demandé</span></td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn-icon check-btn" data-id="${r.id}" title="Valider le remboursement" style="color:var(--success); border:1px solid var(--success); border-radius:4px; padding:2px 5px;">
                        ✔ Valider
                    </button>
                    <button class="btn-icon x-btn" data-id="${r.id}" title="Refuser" style="color:var(--error); border:1px solid var(--error); border-radius:4px; padding:2px 5px;">
                        ✖ Refuser
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Listeners
    tbody.querySelectorAll('.check-btn').forEach(btn => {
        btn.onclick = () => handleApprove(btn.dataset.id);
    });

    tbody.querySelectorAll('.x-btn').forEach(btn => {
        btn.onclick = () => handleReject(btn.dataset.id);
    });
}

async function handleApprove(id) {
    if (!await window.showConfirm("Validation", "Valider ce remboursement ? Cela marquera le billet comme remboursé.", "Valider")) return;
    try {
        await apiCall(`/bookings/${id}/refund`, { method: 'POST' });
        await window.showAlert("Succès", "Remboursement validé", "success");
        loadRefundRequests();
    } catch (e) {
        await window.showAlert("Erreur", e.message, "error");
    }
}

async function handleReject(id) {
    const reason = await window.showPrompt("Refus", "Motif du refus (optionnel) :", "Ex: Doublon, Erreur...");
    if (reason === null) return; // Cancelled

    try {
        await apiCall(`/bookings/${id}/reject-refund`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        await window.showAlert("Info", "Demande refusée", "info");
        loadRefundRequests();
    } catch (e) {
        await window.showAlert("Erreur", e.message, "error");
    }
}
