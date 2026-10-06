import React from 'react';
import * as XLSX from 'xlsx';
import { obtenerTextoCasoOp } from '../../utils/onboardingRules';

export interface ReportDownloaderProps {
  casos: any[];
  label?: string;
  className?: string;
  icon?: React.ReactNode;
}

export default function ReportDownloader({ 
  casos, 
  label = "Descargar Reporte", 
  className = "bg-[#E85A80] hover:bg-[#F46C8E] text-white font-bold px-4 py-2 rounded-lg text-sm transition flex items-center gap-2 shadow-lg shadow-pink-900/40 min-h-[44px] cursor-pointer",
  icon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
    </svg>
  )
}: ReportDownloaderProps) {
  const descargarReporte = () => {
    if (casos.length === 0) {
      alert("No hay casos para descargar con los filtros actuales.");
      return;
    }

    const data = casos.map(c => ({
      "N° Caso OP": obtenerTextoCasoOp(c),
      "Tienda": c.tienda || '',
      "ID": c.vendorId || c.vendor_id || '',
      "KAM": c.kam || '',
      "Etapa del Onboarding": c.etapa || '',
      "Propietario de Oportunidad": c.propietarioOportunidad || c.agente || c.propietarioTicket || '',
      "Agente (Actual)": c.agenteACargo || '',
      "Estado": c.estado || '',
      "SLA / Rango": c.rangoSlaOp || `${c.horasSLA}h`,
      "N° Caso Seguimiento": c.casoSeguimiento || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    ws['!cols'] = [
      { wch: 15 }, // N° Caso OP
      { wch: 35 }, // Tienda
      { wch: 12 }, // ID
      { wch: 32 }, // KAM
      { wch: 34 }, // Etapa del Onboarding
      { wch: 26 }, // Propietario de Oportunidad
      { wch: 20 }, // Agente (Actual)
      { wch: 20 }, // Estado
      { wch: 15 }, // SLA
      { wch: 42 }  // N° Caso Seguimiento
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `reporte_casos_${fecha}.xlsx`);
  };

  return (
    <button onClick={descargarReporte} className={className}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

