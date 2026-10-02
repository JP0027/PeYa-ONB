import React from 'react';
import * as XLSX from 'xlsx';
import { obtenerTextoCasoOp } from '../../utils/onboardingRules';

export interface ReportDownloaderProps {
  casos: any[];
}

export default function ReportDownloader({ casos }: ReportDownloaderProps) {
  const descargarReporte = () => {
    // Casos SLA >= 96h o marcados como críticos
    const criticos = casos.filter(c => (c.horasSLA || 0) >= 96 || c.esCritico);
    
    // Order by stage
    criticos.sort((a, b) => {
      const etapaA = a.etapa || '';
      const etapaB = b.etapa || '';
      return etapaA.localeCompare(etapaB);
    });

    const data = criticos.map(c => ({
      "N° Caso OP": obtenerTextoCasoOp(c),
      "Tienda": c.tienda || '',
      "ID": c.vendorId || c.vendor_id || '',
      "KAM": c.kam || '',
      "Etapa del Onboarding": c.etapa || '',
      "Propietario de Oportunidad": c.propietarioOportunidad || '',
      "N° Caso Seguimiento": c.casoSeguimiento || ''
    }));

    if (data.length === 0) {
      alert("No hay casos con SLA >= 96 horas para descargar.");
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Ajustar ancho de columnas para legibilidad en Microsoft Excel
    ws['!cols'] = [
      { wch: 15 }, // N° Caso OP
      { wch: 35 }, // Tienda
      { wch: 12 }, // ID
      { wch: 32 }, // KAM
      { wch: 34 }, // Etapa del Onboarding
      { wch: 26 }, // Propietario de Oportunidad
      { wch: 42 }  // N° Caso Seguimiento
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Reporte 96h+');
    
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `reporte_96h_${fecha}.xlsx`);
  };

  return (
    <button 
      onClick={descargarReporte}
      className="bg-pink-600 hover:bg-pink-500 text-white font-bold px-4 py-2 rounded-lg text-xs transition flex items-center gap-2 shadow-lg shadow-pink-900/40"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
      </svg>
      Descargar Reporte 96h+
    </button>
  );
}
