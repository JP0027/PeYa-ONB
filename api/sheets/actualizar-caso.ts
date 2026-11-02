import { JWT } from 'google-auth-library';
import { getServiceAccountCreds } from '../../src/services/credsHelper';

async function fetchConReintento(url: string, options: RequestInit, maxReintentos: number = 4): Promise<Response> {
  let ultimoError: any = null;
  for (let intento = 0; intento < maxReintentos; intento++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || res.status >= 500) {
        const esperaMs = (800 * Math.pow(2, intento)) + Math.floor(Math.random() * 300);
        await new Promise(r => setTimeout(r, esperaMs));
        continue;
      }
      return res;
    } catch (err: any) {
      ultimoError = err;
      const esperaMs = (800 * Math.pow(2, intento)) + Math.floor(Math.random() * 300);
      if (intento === maxReintentos - 1) throw err;
      await new Promise(r => setTimeout(r, esperaMs));
    }
  }
  throw ultimoError || new Error('Google Sheets API request failed');
}

const SPREADSHEET_ID = process.env.VITE_GOOGLE_SHEET_ID || '1obGQuhQx0FcxdoHNYUMzGqOzLFalhA63W8ze1tygHkk';

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const decoded = getServiceAccountCreds();
  const client = new JWT({
    email: decoded.client_email,
    key: decoded.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const res = await client.authorize();
  cachedToken = res.access_token || '';
  tokenExpiry = (res.expiry_date as number) || (Date.now() + 3500 * 1000);
  return cachedToken;
}

function formatearFechaHoraSheet(val: any): string {
  if (!val) return '';
  const str = String(val).trim();
  if (!str || str === 'S/V' || str === '-' || str.toUpperCase() === 'NULL') return str;

  // 1. DD/MM/YYYY o DD-MM-YYYY con hora
  const matchDDMMTime = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (matchDDMMTime) {
    const dia = String(parseInt(matchDDMMTime[1], 10)).padStart(2, '0');
    const mes = String(parseInt(matchDDMMTime[2], 10)).padStart(2, '0');
    let anio = parseInt(matchDDMMTime[3], 10);
    if (anio < 100) anio += 2000;
    const hora = String(matchDDMMTime[4]).padStart(2, '0');
    const min = String(matchDDMMTime[5]).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${min}`;
  }

  // 2. YYYY-MM-DD o YYYY/MM/DD con hora
  const matchISOTime = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (matchISOTime) {
    const anio = parseInt(matchISOTime[1], 10);
    const mes = String(parseInt(matchISOTime[2], 10)).padStart(2, '0');
    const dia = String(parseInt(matchISOTime[3], 10)).padStart(2, '0');
    const hora = String(matchISOTime[4]).padStart(2, '0');
    const min = String(matchISOTime[5]).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${min}`;
  }

  // 3. DD/MM/YYYY o DD-MM-YYYY sin hora -> estampa hora actual para completar formato dd/mm/aaaa hh:mm
  const matchDDMM = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (matchDDMM) {
    const dia = String(parseInt(matchDDMM[1], 10)).padStart(2, '0');
    const mes = String(parseInt(matchDDMM[2], 10)).padStart(2, '0');
    let anio = parseInt(matchDDMM[3], 10);
    if (anio < 100) anio += 2000;
    const now = new Date();
    const hora = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${min}`;
  }

  // 4. YYYY-MM-DD o YYYY/MM/DD sin hora -> estampa hora actual para completar formato dd/mm/aaaa hh:mm
  const matchISO = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (matchISO) {
    const anio = parseInt(matchISO[1], 10);
    const mes = String(parseInt(matchISO[2], 10)).padStart(2, '0');
    const dia = String(parseInt(matchISO[3], 10)).padStart(2, '0');
    const now = new Date();
    const hora = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${min}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${min}`;
  }

  return str;
}

function mapearCasoAColumnasSheet(c: any): any[] {
  const pushKamPosStr = c.pushKamPos === true || String(c.pushKamPos).toUpperCase() === 'TRUE' || String(c.pushKamPos).toUpperCase() === 'VERDADERO' ? 'TRUE' : (c.pushKamPos === false || String(c.pushKamPos).toUpperCase() === 'FALSE' || String(c.pushKamPos).toUpperCase() === 'FALSO' ? 'FALSE' : '');
  const pushKamCatStr = c.pushKamCat === true || String(c.pushKamCat).toUpperCase() === 'TRUE' || String(c.pushKamCat).toUpperCase() === 'VERDADERO' ? 'TRUE' : (c.pushKamCat === false || String(c.pushKamCat).toUpperCase() === 'FALSE' || String(c.pushKamCat).toUpperCase() === 'FALSO' ? 'FALSE' : '');
  const sponsorship = c.sponsorship || c.descuentosBajoEstructuraSponsorship || 'NO';

  const fechaCreacionStr = c.fechaCreacion ? formatearFechaHoraSheet(c.fechaCreacion) : '';
  const slaInicioStr = c.sla_inicio || c.fechaInicioSeguimientoOP ? formatearFechaHoraSheet(c.sla_inicio || c.fechaInicioSeguimientoOP) : (fechaCreacionStr || '');
  const fechaCierreStr = c.fechaCierre && c.fechaCierre !== '-' ? formatearFechaHoraSheet(c.fechaCierre) : (c.fechaCierre || '');
  const estadoTicketVal = c.estadoTicketSeguimiento || 'Abierto';
  const fechaCierreSeguimientoStr = c.fechaCierreSeguimiento && c.fechaCierreSeguimiento !== '-' ? formatearFechaHoraSheet(c.fechaCierreSeguimiento) : (c.fechaCierreSeguimiento || '');

  const fechaInicioPosStr = c.fechaInicioPos && c.fechaInicioPos !== 'S/V' ? formatearFechaHoraSheet(c.fechaInicioPos) : (c.fechaInicioPos || '');
  const fechaPushPosStr = c.fechaPushPos && c.fechaPushPos !== 'S/V' ? formatearFechaHoraSheet(c.fechaPushPos) : (c.fechaPushPos || '');
  const fechaInicioCatStr = c.fechaInicioCat && c.fechaInicioCat !== 'S/V' ? formatearFechaHoraSheet(c.fechaInicioCat) : (c.fechaInicioCat || '');
  const fechaPushCatStr = c.fechaPushCat && c.fechaPushCat !== 'S/V' ? formatearFechaHoraSheet(c.fechaPushCat) : (c.fechaPushCat || '');

  const opRaw = String(c.casoOp || '').trim();
  const esOpValido = opRaw && 
    opRaw !== '-' && 
    opRaw.toLowerCase() !== 'sin caso op' && 
    !opRaw.startsWith('TEMP_') && 
    !opRaw.startsWith('SIN_OP_') && 
    !opRaw.includes('_r');
  const opVal = esOpValido ? opRaw : '';

  return [
    opVal,                                                               // A (1): N° Caso OP
    c.vendorId || c.vendor_id || '',                                     // B (2): ID
    c.tienda || '',                                                      // C (3): Tienda
    c.pais || '',                                                        // D (4): País
    c.kam || '',                                                         // E (5): Kam
    c.integracion || '',                                                 // F (6): Integración
    sponsorship,                                                         // G (7): Descuentos bajo estructura Sponsorship
    c.oportunidad || '',                                                 // H (8): Oportunidad
    c.asset || '',                                                       // I (9): Asset
    c.propietarioOportunidad || '',                                      // J (10): Propietario Oportunidad
    c.propietarioTicket || c.agente || '',                               // K (11): Propietario de Ticket HeroCare
    c.casoSeguimiento || '',                                             // L (12): N° Caso Seguimiento
    c.tieneCasoInicio || 'Si',                                           // M (13): ¿Tiene caso de onboarding en el inicio de seguimiento?
    c.comentarios || '',                                                 // N (14): Comentarios del Onboarding
    c.estado || 'En progreso',                                           // O (15): Estado del caso de onboarding
    c.etapa || 'Validación del Onboarding',                              // P (16): Etapa del onboarding
    estadoTicketVal,                                                     // Q (17): Estado del ticket de seguimiento
    fechaCreacionStr,                                                    // R (18): Fecha de creación de la OP
    slaInicioStr,                                                        // S (19): Fecha de inicio de seguimiento de OP
    fechaCierreStr,                                                      // T (20): Fecha de cierre de OP
    fechaCierreSeguimientoStr,                                           // U (21): Fecha de cierre de seguimiento
    fechaInicioPosStr,                                                   // V (22): Fecha de inicio de seguimiento - Datos Faltantes POS API
    fechaPushPosStr,                                                     // W (23): Fecha de push de seguimiento - Datos Faltantes POS API
    c.respuestaPos || '',                                                // X (24): ¿Existe respuesta en el roadmap de Datos Faltantes POS API?
    pushKamPosStr,                                                       // Y (25): Push KAM - Datos Faltantes POS API
    fechaInicioCatStr,                                                   // Z (26): Fecha de inicio de seguimiento - Catálogo
    fechaPushCatStr,                                                     // AA (27): Fecha de push de seguimiento - Catálogo
    c.respuestaCat || '',                                                // AB (28): ¿Existe respuesta en el roadmap Catálogo?
    pushKamCatStr                                                        // AC (29): Push KAM - Catálogo
  ];
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido, use POST' });
  }

  try {
    const casoData = req.body;
    if (!casoData || (!casoData.id && !casoData.casoOp && !casoData.vendorId)) {
      return res.status(400).json({ success: false, error: 'Se requiere id, casoOp o vendorId' });
    }

    const token = await getToken();
      const idBusqueda = String(casoData.casoOp || casoData.id || casoData.vendorId || '').trim();
      const esNuevo = Boolean(casoData.esNuevo);
      let filaTarget = 0;
      let totalFilasHoja = 0;

      // 1. Consultar 'Onboarding_New'!A:C para detectar el número real de filas con datos en la base antes de escribir
      const urlCols = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'Onboarding_New'!A:C?valueRenderOption=FORMATTED_VALUE`;
      const resCols = await fetchConReintento(urlCols, {
        headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' }
      });
      if (resCols.ok) {
        const dataCols = await resCols.json();
        const rows = dataCols.values || [];

        // Encontrar la ÚLTIMA fila real con datos (donde N° Caso OP, ID o Tienda no sea vacío)
        let ultimaFilaConDatos = 0;
        for (let i = rows.length - 1; i >= 0; i--) {
          const r = rows[i] || [];
          const op = String(r[0] || '').trim();
          const ven = String(r[1] || '').trim();
          const tie = String(r[2] || '').trim();
          if (op || ven || tie) {
            ultimaFilaConDatos = i + 1; // Fila 1-indexed en la hoja
            break;
          }
        }
        totalFilasHoja = ultimaFilaConDatos;

        const filaHint = Number(casoData.filaNumero);
        const venBuscado = String(casoData.vendorId || casoData.vendor_id || '').trim();
        const opBuscado = String(casoData.casoOp || '').trim();
        const esOpValido = opBuscado && opBuscado !== 'Sin caso OP' && opBuscado !== '-' && !opBuscado.startsWith('TEMP_') && !opBuscado.startsWith('SIN_OP_') && !opBuscado.includes('_r');

        // Solo buscar filaTarget si estamos EDITANDO un caso existente (!esNuevo)
        // Si esNuevo === true, SIEMPRE se insertará una nueva fila al final de la tabla (nuevaFila = totalFilasHoja + 1)
        if (!esNuevo) {
          // 1. Prioridad: Verificar por número de fila en Sheets
          if (filaHint >= 3) {
            filaTarget = filaHint;
          }

          // 2. Si no confirmó por filaHint, buscar de abajo hacia arriba por casoOp
          if (!filaTarget && esOpValido) {
            for (let i = rows.length - 1; i >= 0; i--) {
              const op = String(rows[i]?.[0] || '').trim();
              if (op === opBuscado) {
                filaTarget = i + 1;
                break;
              }
            }
          }

          // 3. Buscar por vendorId o id
          if (!filaTarget) {
            for (let i = rows.length - 1; i >= 0; i--) {
              const op = String(rows[i]?.[0] || '').trim();
              const ven = String(rows[i]?.[1] || '').trim();
              if (
                (venBuscado && ven === venBuscado) ||
                (op && (op === idBusqueda || idBusqueda.startsWith(op + '_'))) ||
                (ven && (ven === idBusqueda || idBusqueda.startsWith(ven + '_')))
              ) {
                filaTarget = i + 1;
                break;
              }
            }
          }

          // 4. Si no se encontró en búsquedas, forzar filaHint
          if (!filaTarget && filaHint >= 3) {
            filaTarget = filaHint;
          }
        }
      }

      const filaValores = mapearCasoAColumnasSheet(casoData);
      const valoresAAC = filaValores.slice(0, 29); // Columnas A:AC (Índices 0..28)
      const valFreezePos = casoData.fechaFreezePos || casoData.freezePos || '';
      const valFreezeCat = casoData.fechaFreezeCat || casoData.freezeCat || '';

      if (filaTarget >= 3) {
        // ACTUALIZAR fila existente
        const urlBatch = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`;
        const dataUpdates: any[] = [
          {
            range: `'Onboarding_New'!A${filaTarget}:AC${filaTarget}`,
            values: [valoresAAC]
          }
        ];

        // Sincronizar AP:AQ (Freeze POS y Catálogo)
        if (valFreezePos || valFreezeCat) {
          dataUpdates.push({
            range: `'Onboarding_New'!AP${filaTarget}:AQ${filaTarget}`,
            values: [[valFreezePos, valFreezeCat]]
          });
        }

        const apiRes = await fetchConReintento(urlBatch, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: dataUpdates
          })
        });

        if (!apiRes.ok) {
          const errText = await apiRes.text();
          throw new Error(`Google Sheets API [${apiRes.status}]: ${errText}`);
        }

        return res.status(200).json({
          success: true,
          updated: true,
          filaNumero: filaTarget,
          message: `Caso actualizado en Google Sheets (Fila #${filaTarget})`
        });
      } else {
        // INSERTAR nuevo caso detectando exactamente la última fila de la base
        const nuevaFila = totalFilasHoja > 0 ? (totalFilasHoja + 1) : 1878;

        // Asegurar que la cuadrícula de Sheets tenga capacidad exacta para la nueva fila
        try {
          const sheetIdOnboardingNew = 104076048;
          const urlMeta = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets(properties(sheetId,title,gridProperties))`;
          const resMeta = await fetchConReintento(urlMeta, { headers: { Authorization: `Bearer ${token}` } });
          if (resMeta.ok) {
            const meta = await resMeta.json();
            const sheetObj = meta.sheets?.find((s: any) => s.properties?.title === 'Onboarding_New' || s.properties?.sheetId === sheetIdOnboardingNew);
            const rowCount = sheetObj?.properties?.gridProperties?.rowCount || 0;
            const targetSheetId = sheetObj?.properties?.sheetId || sheetIdOnboardingNew;

            if (nuevaFila > rowCount && rowCount > 0) {
              const filasAAgregar = nuevaFila - rowCount;
              await fetchConReintento(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  requests: [
                    {
                      appendDimension: {
                        sheetId: targetSheetId,
                        dimension: 'ROWS',
                        length: filasAAgregar
                      }
                    }
                  ]
                })
              });
            }
          }
        } catch (errCap) {
          console.warn('Advertencia asegurando capacidad para nueva fila:', errCap);
        }

        const urlBatchNuevo = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`;
        const dataUpdatesNuevo: any[] = [
          {
            range: `'Onboarding_New'!A${nuevaFila}:AC${nuevaFila}`,
            values: [valoresAAC]
          }
        ];

        if (valFreezePos || valFreezeCat) {
          dataUpdatesNuevo.push({
            range: `'Onboarding_New'!AP${nuevaFila}:AQ${nuevaFila}`,
            values: [[valFreezePos, valFreezeCat]]
          });
        }

        const apiRes = await fetchConReintento(urlBatchNuevo, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: dataUpdatesNuevo
          })
        });

        if (!apiRes.ok) {
          const finalErr = await apiRes.text();
          throw new Error(`Google Sheets API [${apiRes.status}]: ${finalErr}`);
        }

        return res.status(200).json({
          success: true,
          created: true,
          filaNumero: nuevaFila,
          message: `Nuevo caso insertado en Google Sheets (Fila #${nuevaFila}, Columna G omitida)`
        });
      }
  } catch (err: any) {
    console.error('Error en /api/sheets/actualizar-caso:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
