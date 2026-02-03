/**
 * Export Utilities
 * Handles lazy loading of export libraries (XLSX, jsPDF) and data export.
 */

const LIB_PATH_XLSX = 'js/lib/xlsx.full.min.js';
const LIB_PATH_JSPDF = 'js/lib/jspdf.umd.min.js';
const LIB_PATH_AUTOTABLE = 'js/lib/jspdf.plugin.autotable.min.js';

// Track loaded scripts
const loadedScripts = new Set();

/**
 * Lazy load a script
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (loadedScripts.has(src)) return resolve();
        if (document.querySelector(`script[src="${src}"]`)) {
            loadedScripts.add(src);
            return resolve();
        }

        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            loadedScripts.add(src);
            resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

/**
 * Export Data to Excel (.xlsx)
 * @param {Array<Object>} data - Array of objects to export
 * @param {string} filename - Output filename (without extension)
 * @param {Object} columnMapping - Optional mapping { key: "Header Name" }
 */
export async function exportToExcel(data, filename = 'export', columnMapping = null) {
    try {
        window.showToast?.('Export', 'Préparation du fichier Excel...', 'info');
        await loadScript(LIB_PATH_XLSX);

        // Transform data if mapping provided
        let exportData = data;
        if (columnMapping) {
            exportData = data.map(item => {
                const row = {};
                for (const [key, label] of Object.entries(columnMapping)) {
                    // Handle nested properties (e.g. "agency.name")
                    const val = key.split('.').reduce((obj, prop) => obj && obj[prop], item);
                    row[label] = val !== undefined && val !== null ? val : '';
                }
                return row;
            });
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, `${filename}.xlsx`);

        window.showToast?.('Succès', 'Fichier Excel téléchargé', 'success');
    } catch (error) {
        console.error('Export Excel Error:', error);
        window.showToast?.('Erreur', 'Impossible de générer le fichier Excel', 'error');
    }
}

/**
 * Export Data to PDF
 * @param {Array<Object>} data 
 * @param {string} title 
 * @param {Object} columnMapping - { key: "Header Name" }
 * @param {string} filename 
 */
export async function exportToPDF(data, title, columnMapping, filename = 'export') {
    try {
        window.showToast?.('Export', 'Préparation du PDF...', 'info');
        await loadScript(LIB_PATH_JSPDF);
        await loadScript(LIB_PATH_AUTOTABLE);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Title
        doc.setFontSize(18);
        doc.text(title, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 14, 30);

        // Columns & Rows
        const headers = Object.values(columnMapping);
        const keys = Object.keys(columnMapping);

        const body = data.map(item => {
            return keys.map(key => {
                // Handle nested properties
                const val = key.split('.').reduce((obj, prop) => obj && obj[prop], item);
                return val !== undefined && val !== null ? String(val) : '';
            });
        });

        doc.autoTable({
            head: [headers],
            body: body,
            startY: 35,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save(`${filename}.pdf`);
        window.showToast?.('Succès', 'Document PDF téléchargé', 'success');
    } catch (error) {
        console.error('Export PDF Error:', error);
        window.showToast?.('Erreur', 'Impossible de générer le PDF', 'error');
    }
}

/**
 * Print Manifest PDF (Bordereau de Route)
 * Custom formatted PDF with Company Branding, Trip Info, Passenger List, and Parcels.
 */
export async function printManifestPDF(departure, passengers, parcels, user = null, brandName = "INTERCITY") {
    try {
        window.showToast?.('Export', 'Génération du bordereau...', 'info');
        await loadScript(LIB_PATH_JSPDF);
        await loadScript(LIB_PATH_AUTOTABLE);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;

        // --- Header / Branding ---
        // Blue header background
        doc.setFillColor(30, 64, 175); // Blue 800
        doc.rect(0, 0, pageWidth, 40, 'F');

        // Company Name
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(brandName.toUpperCase(), 14, 20);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("Bordereau de Route", 14, 30);

        // Date / metadata (Right aligned)
        doc.setFontSize(9);
        doc.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}`, pageWidth - 14, 20, { align: 'right' });
        if (user) {
            doc.text(`Par: ${user.name || user.role}`, pageWidth - 14, 25, { align: 'right' });
        }

        // --- Trip Information Box ---
        const startY = 45;
        doc.setDrawColor(200);
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(14, startY, pageWidth - 28, 25, 2, 2, 'FD');

        doc.setTextColor(20);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${departure.origin}  >>  ${departure.destination}`, 20, startY + 10);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Date: ${departure.date}`, 20, startY + 18);
        doc.text(`Départ: ${departure.departureTime}`, 70, startY + 18);
        doc.text(`Bus: ${departure.vehiclePlate || 'N/A'}`, 120, startY + 18);
        doc.text(`Chauffeur: ${departure.driverName || 'N/A'}`, 170, startY + 18);

        let currentY = startY + 35;

        // --- Passenger Manifest ---
        // Calculate real passenger count (sum of seats)
        const totalPax = passengers.reduce((sum, p) => sum + (p.seats || 1), 0);

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 64, 175);
        doc.text(`Manifeste Passagers (${totalPax})`, 14, currentY);
        currentY += 5;

        const paxColumns = ["Places", "Nom", "Téléphone", "Destination", "Montant", "Statut"];
        const paxRows = passengers.map(p => [
            p.seats > 1 ? `${p.seats} Places` : 'Standard',
            p.name,
            p.phone,
            p.dest,
            p.price + " F",
            p.status === 'confirmed' ? 'Confirmé' : p.status
        ]);

        doc.autoTable({
            head: [paxColumns],
            body: paxRows,
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: [30, 64, 175] },
            styles: { fontSize: 9 },
            columnStyles: { 0: { fontStyle: 'bold', halign: 'center' } }
        });

        currentY = doc.lastAutoTable.finalY + 15;

        // --- Parcels Manifest ---
        if (parcels && parcels.length > 0) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(22, 163, 74); // Green
            doc.text(`Manifeste Colis (${parcels.length})`, 14, currentY);
            currentY += 5;

            const pclColumns = ["Expéditeur", "Destinataire", "Tél. Dest", "Description", "Montant"];
            const pclRows = parcels.map(p => [
                p.senderName || '-',
                p.recipientName,
                p.recipientPhone,
                p.description || '-',
                (p.price || 0) + " F"
            ]);

            doc.autoTable({
                head: [pclColumns],
                body: pclRows,
                startY: currentY,
                theme: 'grid',
                headStyles: { fillColor: [22, 163, 74] },
                styles: { fontSize: 9 }
            });

            currentY = doc.lastAutoTable.finalY + 10;
        }

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} / ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        }

        doc.save(`manifeste-${departure.id}.pdf`);
        window.showToast?.('Succès', 'Bordereau téléchargé', 'success');

    } catch (error) {
        console.error('Manifest PDF Error:', error);
        window.showToast?.('Erreur', 'Impossible de générer le bordereau', 'error');
    }
}
