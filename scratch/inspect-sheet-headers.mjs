import { sheetsBackendService } from '../src/services/sheetsBackendService.js';

async function inspectHeaders() {
  const token = await sheetsBackendService.obtenerAuthToken();
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets/1obGQuhQx0FcxdoHNYUMzGqOzLFalhA63W8ze1tygHkk/values/\'Onboarding_New\'!A2:AZ2', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const data = await res.json();
  const headers = data.values[0];
  console.log('=== ENCABEZADOS EN FILA 2 ===');
  headers.forEach((h, idx) => {
    let letter = '';
    let temp = idx;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    console.log(`${letter} (col ${idx}): "${h}"`);
  });

  const resRows = await fetch('https://sheets.googleapis.com/v4/spreadsheets/1obGQuhQx0FcxdoHNYUMzGqOzLFalhA63W8ze1tygHkk/values/\'Onboarding_New\'!A1795:AZ1808', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const dataRows = await resRows.json();
  console.log('\n=== MUESTRA DE DATOS FILAS 1795-1808 ===');
  dataRows.values.forEach((r, i) => {
    const rowNum = 1795 + i;
    const op = r[0] || '';
    const tienda = r[2] || '';
    const estado = r[14] || '';
    const etapa = r[15] || '';
    // Look for Rango SLA (Horas) de la OP
    const idxRango = headers.findIndex(h => h.includes('Rango SLA (Horas) de la OP'));
    const idxTiempoLV = headers.findIndex(h => h.includes('Tiempo Transcurrido de L-V de la OP'));
    const rangoOP = idxRango !== -1 ? r[idxRango] : 'NO_COL';
    const tiempoLV = idxTiempoLV !== -1 ? r[idxTiempoLV] : 'NO_COL';
    console.log(`Fila ${rowNum} | OP: ${op} | Tienda: ${tienda} | Estado: ${estado} | Etapa: ${etapa} | RangoOP: ${rangoOP} | TiempoLV: ${tiempoLV}`);
  });
}

inspectHeaders().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
