import { JWT } from 'google-auth-library';

const SPREADSHEET_ID = process.env.VITE_GOOGLE_SHEET_ID || '1obGQuhQx0FcxdoHNYUMzGqOzLFalhA63W8ze1tygHkk';
const CREDS_B64 = 'ew0KICAidHlwZSI6ICJzZXJ2aWNlX2FjY291bnQiLA0KICAicHJvamVjdF9pZCI6ICJvbmItZGF0YSIsDQogICJwcml2YXRlX2tleV9pZCI6ICIyODRkZTRiY2ViMWJkNzc2NmEyZjA2NjhmMzU3ODhkZjM4MDFjZTU1IiwNCiAgInByaXZhdGVfa2V5IjogIi0tLS0tQkVHSU4gUFJJVkFURSBLRVktLS0tLVxuTUlJRXZnSUJBREFOQmdrcWhraUc5dzBCQVFFRkFBU0NCS2d3Z2dTa0FnRUFBb0lCQVFEZzFOdk9RNDR6OUtvVVxub0lvZkswRDFiRFBGc3EvS0VoNTRlL01YWGNoajZ4T29jSGZ4am9ONXRpZlA0dmFEN0lyVWhCZVFENlpTZ2R0Q1xuNFVnK3dLUUJqWVA3T1FTQWM2czBYSzBsbnJYNmkzY0o1NDJOWHd2V2RYRXJ5SmVuTDU4WU91WHRoTmIweFM2TFxuYStwa2V1Vk85TVRzYzByanZWMEpUQ1BPK3NaaDFzeGFhcXZzSlVpT3YrSWNHcFo0R2ljVmVtTURWS3FUR3NzWlxubkQyL1FFdkMzR2Rrb3BoNkEvdStDYWw2M1hYdURWeE1oQlNTWnNuV0Rla21pbkV3N2g1cGptNXprYklsQlJodVxuanowYk1oaTlTYjhOYXF5dTZQUXdNY0gveXBCKzF6Rkh2aXB4dDFYK1hWZzJ1N21WM2p0OUg3RnhIYWRuaHlXQVxuWm5Ic3VRZEZBZ01CQUFFQ2dnRUFDRTd3RDlJV1JnYm92Qm9SKzBTTmJNOENwaHAyMHVMOWhrVktVK3c1ZExFaVxuQ1FEeSt4VzI5NzlLcWF6V1N1OXBwL1hPVmNWYm5PNllqQzJvRGsyWnpKdzVWWVlqWVBNbFQxVGlGSGhRMEVFK1xueW1VVFZEZEFIWkk1ekR6b1FjWTBQUXNtMFFnRGdOM0NoN3R3QTN1T2VzUk5KMUc4REQ0YUJlSEVRYWlwdm13YlxuREJtcVZrTng3UFJxS0pWaTVubSt2OFo4YXluK1dsTDdjOGluZm9CeEJuRjh6dTNvaW4xaGtNeHR4Z2hQOWF2clxuMzM5TURTRktVWDJvOHY3bXhoNUk5TnZQb0ZmUkI4eEJ2V0trTWRQWEJUSXp2UDl5YVRJQndUdXI3aGNFa2VveVxuT3BSMnVpZkU4aHNqbUpqajZuNGRtWXZSNlFmOFlEYTBxQUNHK0NaQk1RS0JnUUQ3TWorMzNVdThkUmllOVZFVVxuWTZzRFUvWVlMb0Q5NGgzUEJyV0JDamFsMzVWanJRejg3bFB6WGpUcU4rVjBsdHM0T2ZFSDBSOUlwbGlnTDRtelxuNVJSbUVLYWZjZC9QVExOMVNLVjd1NHJ0bUV4V1JZb2xOSERjeGpoaDBTcEQrbGhFWFgxUXpOOGs2bnhDNmlVTFxuNHl1RWpJQ1dVL2lNYnI5MytValhqSUErZlFLQmdRRGxJWW5yR1NUVEV2bkF6TDFFQXFTSVBuaHpVWEhjUXFISVxuNjNISHhhaGxnZ3VIWWEwWVNkTHgyNWc1TGNpUDV6YkZCRi9Vb2lGMHpvaEMwVWd2WngyN3YvbVJrMkZNcE1aaVxuY1F2MXlmMFdiQ2loeVpvRUZ2QmFsTzd5VHpCWElXTUZrV2ZPSlF3bkZZYThvL2tObzBNSEI1WHFCNU1RNktJOFxubk9PYjlkdmVhUUtCZ0JnemJTUWZzKzVDTWM4T3YzTUJielp3M21MU0NDZHRvNFdRbGVnS3ZkMFpQMkZOQ05WTlxuZU5VWG5HMThXU1QwYThacy9xWE1KZ0Z2MVZZSmZuRFFmemllSGc5NmZ4K1B1akp3ZjFEK2JwSVpmREZMbmRXYlxueWN2YlpRODNnYVR1OTVZT2s4WTNGc0NOdnM4TGsrb2pSc3dNWlU4V1kvblRxYXE3WDZNMHJCNVpBb0dCQUxaYlxuMWdkOVVIaUpEcXNxaDZ1Y0t0U2dXMzcwSUJsOEVvVDFGZTQzMnNsSEVlUGlrai9WYVlUQ0Q4bmFMVmlTWFYyNlxuR0ljRHJucm5jVDAwa1MzZzlLSWJyUVgyZFNicHNWWmh3SElURzFHQUxXcHVLQnovSUxZRytKRnpBdmNsaEVqSFxuTEFXK0tJam1zZ0JxeEduZE9SaGNLaTFEY0FHeUZJVUhISU5nem1lWkFvR0JBSWgrWjhiMUx3V1dIcVBGR1VJblxubWtYN1dONkxRZGI2VnloMU5KVSsrUlR1QzFBTmdpdGt0YmE2c3ZVd1dKbzBNN0pTaFduZ2ZhSlZ0dVhjZEU5b1xuU1d0L2hrZXJOV1hBdURHZTREUDhTY0tiZWI4MVNEcDdteVk1WlR0bTVBRldqbUNYeFBkQmp5M05NSm1GbDNSOFxuVVoxNE5LQzhQVjVKbGVnRWRkZU54UTNoXG4tLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tXG4iLA0KICAiY2xpZW50X2VtYWlsIjogIm9uYi1pbnRlZ3JhY2lvbmVzQG9uYi1kYXRhLmlhbS5nc2VydmljZWFjY291bnQuY29tIiwNCiAgImNsaWVudF9pZCI6ICIxMDQxNjU3MjMyMTE5NjUyNjY5NzQiLA0KICAiYXV0aF91cmkiOiAiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL2F1dGgiLA0KICAidG9rZW5fdXJpIjogImh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuIiwNCiAgImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLA0KICAiY2xpZW50X3g1MDlfY2VydF91cmwiOiAiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vcm9ib3QvdjEvbWV0YWRhdGEveDUwOS9vbmItaW50ZWdyYWNpb25lcyU0MG9uYi1kYXRhLmlhbS5nc2VydmljZWFjY291bnQuY29tIiwNCiAgInVuaXZlcnNlX2RvbWFpbiI6ICJnb29nbGVhcGlzLmNvbSINCn0NCg==';

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const decoded = JSON.parse(Buffer.from(CREDS_B64, 'base64').toString('utf-8'));
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
    const dia = parseInt(matchDDMMTime[1], 10);
    const mes = parseInt(matchDDMMTime[2], 10);
    let anio = parseInt(matchDDMMTime[3], 10);
    if (anio < 100) anio += 2000;
    const hora = String(matchDDMMTime[4]).padStart(2, '0');
    const min = String(matchDDMMTime[5]).padStart(2, '0');
    const seg = matchDDMMTime[6] !== undefined ? String(matchDDMMTime[6]).padStart(2, '0') : '00';
    return `${dia}/${mes}/${anio} ${hora}:${min}:${seg}`;
  }

  // 2. YYYY-MM-DD o YYYY/MM/DD con hora
  const matchISOTime = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (matchISOTime) {
    const anio = parseInt(matchISOTime[1], 10);
    const mes = parseInt(matchISOTime[2], 10);
    const dia = parseInt(matchISOTime[3], 10);
    const hora = String(matchISOTime[4]).padStart(2, '0');
    const min = String(matchISOTime[5]).padStart(2, '0');
    const seg = matchISOTime[6] !== undefined ? String(matchISOTime[6]).padStart(2, '0') : '00';
    return `${dia}/${mes}/${anio} ${hora}:${min}:${seg}`;
  }

  // 3. DD/MM/YYYY o DD-MM-YYYY sin hora -> estampa hora actual para completar formato
  const matchDDMM = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (matchDDMM) {
    const dia = parseInt(matchDDMM[1], 10);
    const mes = parseInt(matchDDMM[2], 10);
    let anio = parseInt(matchDDMM[3], 10);
    if (anio < 100) anio += 2000;
    const now = new Date();
    const hora = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const seg = String(now.getSeconds()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${min}:${seg}`;
  }

  // 4. YYYY-MM-DD o YYYY/MM/DD sin hora -> estampa hora actual para completar formato
  const matchISO = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (matchISO) {
    const anio = parseInt(matchISO[1], 10);
    const mes = parseInt(matchISO[2], 10);
    const dia = parseInt(matchISO[3], 10);
    const now = new Date();
    const hora = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const seg = String(now.getSeconds()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${min}:${seg}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const dia = d.getDate();
    const mes = d.getMonth() + 1;
    const anio = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const seg = String(d.getSeconds()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${min}:${seg}`;
  }

  return str;
}

function mapearCasoAColumnasSheet(c: any): any[] {
  const pushKamPosStr = c.pushKamPos === true || String(c.pushKamPos).toUpperCase() === 'TRUE' ? 'TRUE' : (c.pushKamPos === false || String(c.pushKamPos).toUpperCase() === 'FALSE' ? 'FALSE' : '');
  const pushKamCatStr = c.pushKamCat === true || String(c.pushKamCat).toUpperCase() === 'TRUE' ? 'TRUE' : (c.pushKamCat === false || String(c.pushKamCat).toUpperCase() === 'FALSE' ? 'FALSE' : '');
  const sponsorship = c.sponsorship || c.descuentosBajoEstructuraSponsorship || 'NO';

  const fechaCreacionStr = formatearFechaHoraSheet(c.fechaCreacion || new Date());
  const slaInicioStr = formatearFechaHoraSheet(c.sla_inicio || c.fechaInicioSeguimientoOP || c.fechaCreacion || new Date());
  const fechaCierreStr = c.fechaCierre && c.fechaCierre !== '-' ? formatearFechaHoraSheet(c.fechaCierre) : (c.fechaCierre || '');
  const fechaInicioPosStr = c.fechaInicioPos && c.fechaInicioPos !== 'S/V' ? formatearFechaHoraSheet(c.fechaInicioPos) : (c.fechaInicioPos || '');
  const fechaPushPosStr = c.fechaPushPos && c.fechaPushPos !== 'S/V' ? formatearFechaHoraSheet(c.fechaPushPos) : (c.fechaPushPos || '');
  const fechaInicioCatStr = c.fechaInicioCat && c.fechaInicioCat !== 'S/V' ? formatearFechaHoraSheet(c.fechaInicioCat) : (c.fechaInicioCat || '');
  const fechaPushCatStr = c.fechaPushCat && c.fechaPushCat !== 'S/V' ? formatearFechaHoraSheet(c.fechaPushCat) : (c.fechaPushCat || '');

  return [
    c.casoOp || '',                                                      // A: N° Caso OP
    c.vendorId || c.vendor_id || '',                                     // B: ID
    c.tienda || '',                                                      // C: Tienda
    c.pais || '',                                                        // D: País
    c.kam || '',                                                         // E: Kam
    c.integracion || '',                                                 // F: Integración
    sponsorship,                                                         // G: Descuentos bajo estructura Sponsorship
    c.oportunidad || '',                                                 // H: Oportunidad
    c.asset || '',                                                       // I: Asset
    c.propietarioOportunidad || '',                                      // J: Propietario Oportunidad
    c.propietarioTicket || c.agente || '',                               // K: Propietario de Ticket HeroCare
    c.casoSeguimiento || '',                                             // L: N° Caso Seguimiento
    c.tieneCasoInicio || 'Si',                                           // M: ¿Tiene caso de onboarding en el inicio de seguimiento?
    c.comentarios || '',                                                 // N: Comentarios del Onboarding
    c.estado || 'En progreso',                                           // O: Estado del caso
    c.etapa || 'Validación del Onboarding',                              // P: Etapa del onboarding
    fechaCreacionStr,                                                    // Q: Fecha de creación de la OP
    slaInicioStr,                                                        // R: Fecha de inicio de seguimiento de OP
    fechaCierreStr,                                                      // S: Fecha de cierre de OP
    fechaInicioPosStr,                                                   // T: Fecha de inicio de seguimiento - Datos Faltantes POS API
    fechaPushPosStr,                                                     // U: Fecha de push de seguimiento - Datos Faltantes POS API
    c.respuestaPos || '',                                                // V: ¿Existe respuesta en el roadmap de Datos Faltantes POS API?
    pushKamPosStr,                                                       // W: Push KAM - Datos Faltantes POS API
    fechaInicioCatStr,                                                   // X: Fecha de inicio de seguimiento - Catálogo
    fechaPushCatStr,                                                     // Y: Fecha de push de seguimiento - Catálogo
    c.respuestaCat || '',                                                // Z: ¿Existe respuesta en el roadmap de Catálogo?
    pushKamCatStr                                                        // AA: Push KAM - Catálogo
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
    let filaTarget = typeof casoData.filaNumero === 'number' && casoData.filaNumero >= 3 ? casoData.filaNumero : 0;

    // 1. Si no tiene filaNumero, o para verificar, buscar en 'Onboarding_New'!A2:B
    if (!filaTarget || filaTarget < 3) {
      const urlCols = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'Onboarding_New'!A2:B?valueRenderOption=FORMATTED_VALUE`;
      const resCols = await fetch(urlCols, {
        headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' }
      });
      if (resCols.ok) {
        const dataCols = await resCols.json();
        const rows = dataCols.values || [];
        for (let i = 0; i < rows.length; i++) {
          const op = String(rows[i]?.[0] || '').trim();
          const ven = String(rows[i]?.[1] || '').trim();
          if (
            (op && (op === idBusqueda || idBusqueda.startsWith(op + '_'))) ||
            (ven && (ven === idBusqueda || idBusqueda.startsWith(ven + '_')))
          ) {
            filaTarget = i + 2;
            break;
          }
        }
      }
    }

    const filaValores = mapearCasoAColumnasSheet(casoData);

    if (filaTarget >= 3) {
      // ACTUALIZAR fila existente
      const rango = `'Onboarding_New'!A${filaTarget}:AA${filaTarget}`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(rango)}?valueInputOption=USER_ENTERED`;
      const apiRes = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: rango,
          values: [filaValores]
        })
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        return res.status(apiRes.status).json({ success: false, error: errText });
      }

      return res.status(200).json({
        success: true,
        updated: true,
        filaNumero: filaTarget,
        message: `Caso actualizado en Google Sheets (Fila #${filaTarget})`
      });
    } else {
      // INSERTAR nuevo caso al final
      const urlAppend = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent("'Onboarding_New'!A:AA")}:append?valueInputOption=USER_ENTERED`;
      const apiRes = await fetch(urlAppend, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [filaValores]
        })
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        return res.status(apiRes.status).json({ success: false, error: errText });
      }

      const appendData = await apiRes.json();
      let nuevaFila = 0;
      if (appendData?.updates?.updatedRange) {
        const match = appendData.updates.updatedRange.match(/A(\d+):/);
        if (match) nuevaFila = parseInt(match[1], 10);
      }

      return res.status(200).json({
        success: true,
        created: true,
        filaNumero: nuevaFila,
        message: `Nuevo caso insertado en Google Sheets (Fila #${nuevaFila})`
      });
    }
  } catch (err: any) {
    console.error('Error en /api/sheets/actualizar-caso:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
