import { sheetsBackendService } from '../src/services/sheetsBackendService.js';

async function checkActiveSla() {
  const token = await sheetsBackendService.obtenerAuthToken();
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets/1obGQuhQx0FcxdoHNYUMzGqOzLFalhA63W8ze1tygHkk/values/\'Onboarding_New\'!A2:AZ2000', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const data = await res.json();
  const headers = data.values[0];
  const idxEstado = headers.findIndex(h => h.toLowerCase().includes('estado del caso'));
  const idxRangoOP = headers.findIndex(h => h.includes('Rango SLA (Horas) de la OP'));
  const idxTiempoLV = headers.findIndex(h => h.includes('Tiempo Transcurrido de L-V de la OP'));
  const idxPushPos = headers.findIndex(h => h.includes('Push KAM - Datos Faltantes POS API'));
  const idxPushCat = headers.findIndex(h => h.includes('Push KAM - Catálogo'));
  const idxRangoPos = headers.findIndex(h => h.includes('Rango SLA (Horas) de seguimiento POS API'));
  const idxRangoCat = headers.findIndex(h => h.includes('Rango SLA (Horas) de seguimiento de catálogo'));

  console.log('Indices de columnas:');
  console.log('Estado:', idxEstado, 'RangoOP:', idxRangoOP, 'TiempoLV:', idxTiempoLV);

  const rows = data.values.slice(1);
  const activos = [];
  rows.forEach((r, idx) => {
    const estado = (r[idxEstado] || '').toLowerCase().trim();
    if (estado.includes('progreso') || estado === 'en progreso') {
      activos.push({
        fila: idx + 3,
        op: r[0] || '',
        tienda: r[2] || '',
        estado: r[idxEstado] || '',
        etapa: r[15] || '',
        rangoOP: r[idxRangoOP] || '',
        tiempoLV: r[idxTiempoLV] || '',
        rangoPos: r[idxRangoPos] || '',
        rangoCat: r[idxRangoCat] || ''
      });
    }
  });

  console.log('Total casos activos encontrados:', activos.length);
  const porRango = {};
  activos.forEach(a => {
    porRango[a.rangoOP || '(VACIO)'] = (porRango[a.rangoOP || '(VACIO)'] || 0) + 1;
  });
  console.log('Distribución de Rango SLA OP en casos activos:');
  console.log(JSON.stringify(porRango, null, 2));

  console.log('\nCasos activos con >=96h:');
  activos.filter(a => a.rangoOP.includes('96')).forEach(a => {
    console.log('Fila ' + a.fila + ' | OP: ' + a.op + ' | Tienda: ' + a.tienda + ' | Rango: ' + a.rangoOP + ' | Tiempo: ' + a.tiempoLV);
  });
}

checkActiveSla().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
