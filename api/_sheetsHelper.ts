import { JWT } from 'google-auth-library';

export const SPREADSHEET_ID = process.env.VITE_GOOGLE_SHEET_ID || '1obGQuhQx0FcxdoHNYUMzGqOzLFalhA63W8ze1tygHkk';

// Credenciales oficiales de Service Account en Base64 (onb-integraciones@onb-data.iam.gserviceaccount.com)
const DEFAULT_CREDS_B64 = 'ew0KICAidHlwZSI6ICJzZXJ2aWNlX2FjY291bnQiLA0KICAicHJvamVjdF9pZCI6ICJvbmItZGF0YSIsDQogICJwcml2YXRlX2tleV9pZCI6ICIyODRkZTRiY2ViMWJkNzc2NmEyZjA2NjhmMzU3ODhkZjM4MDFjZTU1IiwNCiAgInByaXZhdGVfa2V5IjogIi0tLS0tQkVHSU4gUFJJVkFURSBLRVktLS0tLVxuTUlJRXZnSUJBREFOQmdrcWhraUc5dzBCQVFFRkFBU0NCS2d3Z2dTa0FnRUFBb0lCQVFEZzFOdk9RNDR6OUtvVVxub0lvZkswRDFiRFBGc3EvS0VoNTRlL01YWGNoajZ4T29jSGZ4am9ONXRpZlA0dmFEN0lyVWhCZVFENlpTZ2R0Q1xuNFVnK3dLUUJqWVA3T1FTQWM2czBYSzBsbnJYNmkzY0o1NDJOWHd2V2RYRXJ5SmVuTDU4WU91WHRoTmIweFM2TFxuYStwa2V1Vk85TVRzYzByanZWMEpUQ1BPK3NaaDFzeGFhcXZzSlVpT3YrSWNHcFo0R2ljVmVtTURWS3FUR3NzWlxubkQyL1FFdkMzR2Rrb3BoNkEvdStDYWw2M1hYdURWeE1oQlNTWnNuV0Rla21pbkV3N2g1cGptNXprYklsQlJodVxuanowYk1oaTlTYjhOYXF5dTZQUXdNY0gveXBCKzF6Rkh2aXB4dDFYK1hWZzJ1N21WM2p0OUg3RnhIYWRuaHlXQVxuWm5Ic3VRZEZBZ01CQUFFQ2dnRUFDRTd3RDlJV1JnYm92Qm9SKzBTTmJNOENwaHAyMHVMOWhrVktVK3c1ZExFaVxuQ1FEeSt4VzI5NzlLcWF6V1N1OXBwL1hPVmNWYm5PNllqQzJvRGsyWnpKdzVWWVlqWVBNbFQxVGlGSGhRMEVFK1xueW1VVFZEZEFIWkk1ekR6b1FjWTBQUXNtMFFnRGdOM0NoN3R3QTN1T2VzUk5KMUc4REQ0YUJlSEVRYWlwdm13YlxuREJtcVZrTng3UFJxS0pWaTVubSt2OFo4YXluK1dsTDdjOGluZm9CeEJuRjh6dTNvaW4xaGtNeHR4Z2hQOWF2clxuMzM5TURTRktVWDJvOHY3bXhoNUk5TnZQb0ZmUkI4eEJ2V0trTWRQWEJUSXp2UDl5YVRJQndUdXI3aGNFa2VveVxuT3BSMnVpZkU4aHNqbUpqajZuNGRtWXZSNlFmOFlEYTBxQUNHK0NaQk1RS0JnUUQ3TWorMzNVdThkUmllOVZFVVxuWTZzRFUvWVlMb0Q5NGgzUEJyV0JDamFsMzVWanJRejg3bFB6WGpUcU4rVjBsdHM0T2ZFSDBSOUlwbGlnTDRtelxuNVJSbUVLYWZjZC9QVExOMVNLVjd1NHJ0bUV4V1JZb2xOSERjeGpoaDBTcEQrbGhFWFgxUXpOOGs2bnhDNmlVTFxuNHl1RWpJQ1dVL2lNYnI5MytValhqSUErZlFLQmdRRGxJWW5yR1NUVEV2bkF6TDFFQXFTSVBuaHpVWEhjUXFISVxuNjNISHhhaGxnZ3VIWWEwWVNkTHgyNWc1TGNpUDV6YkZCRi9Vb2lGMHpvaEMwVWd2WngyN3YvbVJrMkZNcE1aaVxuY1F2MXlmMFdiQ2loeVpvRUZ2QmFsTzd5VHpCWElXTUZrV2ZPSlF3bkZZYThvL2tObzBNSEI1WHFCNU1RNktJOFxubk9PYjlkdmVhUUtCZ0JnemJTUWZzKzVDTWM4T3YzTUJielp3M21MU0NDZHRvNFdRbGVnS3ZkMFpQMkZOQ05WTlxuZU5VWG5HMThXU1QwYThacy9xWE1KZ0Z2MVZZSmZuRFFmemllSGc5NmZ4K1B1akp3ZjFEK2JwSVpmREZMbmRXYlxueWN2YlpRODNnYVR1OTVZT2s4WTNGc0NOdnM4TGsrb2pSc3dNWlU4V1kvblRxYXE3WDZNMHJCNVpBb0dCQUxaYlxuMWdkOVVIaUpEcXNxaDZ1Y0t0U2dXMzcwSUJsOEVvVDFGZTQzMnNsSEVlUGlrai9WYVlUQ0Q4bmFMVmlTWFYyNlxuR0ljRHJucm5jVDAwa1MzZzlLSWJyUVgyZFNicHNWWmh3SElURzFHQUxXcHVLQnovSUxZRytKRnpBdmNsaEVqSFxuTEFXK0tJam1zZ0JxeEduZE9SaGNLaTFEY0FHeUZJVUhISU5nem1lWkFvR0JBSWgrWjhiMUx3V1dIcVBGR1VJblxubWtYN1dONkxRZGI2VnloMU5KVSsrUlR1QzFBTmdpdGt0YmE2c3ZVd1dKbzBNN0pTaFduZ2ZhSlZ0dVhjZEU5b1xuU1d0L2hrZXJOV1hBdURHZTREUDhTY0tiZWI4MVNEcDdteVk1WlR0bTVBRldqbUNYeFBkQmp5M05NSm1GbDNSOFxuVVoxNE5LQzhQVjVKbGVnRWRkZU54UTNoXG4tLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tXG4iLA0KICAiY2xpZW50X2VtYWlsIjogIm9uYi1pbnRlZ3JhY2lvbmVzQG9uYi1kYXRhLmlhbS5nc2VydmljZWFjY291bnQuY29tIiwNCiAgImNsaWVudF9pZCI6ICIxMDQxNjU3MjMyMTE5NjUyNjY5NzQiLA0KICAiYXV0aF91cmkiOiAiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL2F1dGgiLA0KICAidG9rZW5fdXJpIjogImh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuIiwNCiAgImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLA0KICAiY2xpZW50X3g1MDlfY2VydF91cmwiOiAiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vcm9ib3QvdjEvbWV0YWRhdGEveDUwOS9vbmItaW50ZWdyYWNpb25lcyU0MG9uYi1kYXRhLmlhbS5nc2VydmljZWFjY291bnQuY29tIiwNCiAgInVuaXZlcnNlX2RvbWFpbiI6ICJnb29nbGVhcGlzLmNvbSINCn0NCg==';

let cachedToken: string | null = null;
let tokenExpiry = 0;

export function setCORS(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function obtenerCredenciales(): { client_email: string; private_key: string } {
  const b64 = process.env.SERVICE_ACCOUNT_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_BASE64 || DEFAULT_CREDS_B64;
  const decoded = Buffer.from(b64, 'base64').toString('utf-8');
  const parsed = JSON.parse(decoded);
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key
  };
}

export async function obtenerAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  const creds = obtenerCredenciales();
  const client = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/spreadsheets'
    ]
  });
  const res = await client.authorize();
  cachedToken = res.access_token || '';
  tokenExpiry = (res.expiry_date as number) || (Date.now() + 3500 * 1000);
  return cachedToken;
}

/**
 * Consulta la hoja Onboarding_New y mapea todas las filas
 */
export async function obtenerTodasLasFilas(): Promise<any[]> {
  const token = await obtenerAuthToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent("'Onboarding_New'!A2:AZ")}?valueRenderOption=FORMATTED_VALUE`;
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google Sheets API Onboarding_New error [${res.status}]: ${errorBody}`);
  }

  const json = await res.json();
  const rows: any[][] = json.values || [];
  return parsearFilasOnboarding(rows);
}

/**
 * Consulta la hoja Integraciones_Sponsorship y mapea los catálogos
 */
export async function obtenerCatalogosSheet(): Promise<{
  integraciones: { nombre: string; sponsorship: string }[];
  paises: string[];
  oportunidades: string[];
  assets: string[];
  agentes: string[];
  estados: string[];
  etapas: string[];
}> {
  const token = await obtenerAuthToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent("'Integraciones_Sponsorship'!A:N")}?valueRenderOption=FORMATTED_VALUE`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google Sheets API Integraciones_Sponsorship error [${res.status}]: ${errorBody}`);
  }

  const json = await res.json();
  const rows: any[][] = json.values || [];

  const integraciones: { nombre: string; sponsorship: string }[] = [];
  const paisesSet = new Set<string>();
  const oportunidadesSet = new Set<string>();
  const assetsSet = new Set<string>();
  const agentesSet = new Set<string>();
  const estadosSet = new Set<string>();
  const etapasSet = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const nombreInt = String(r[0] || '').trim();
    const sponsInt = String(r[1] || '').trim().toUpperCase();
    if (nombreInt && !nombreInt.toLowerCase().includes('integración') && !nombreInt.toLowerCase().includes('integracion')) {
      integraciones.push({
        nombre: nombreInt,
        sponsorship: sponsInt === 'SI' || sponsInt === 'SÍ' ? 'SI' : 'NO'
      });
    }

    const pais = String(r[3] || '').trim();
    if (pais && !pais.toLowerCase().includes('país') && !pais.toLowerCase().includes('pais')) paisesSet.add(pais);

    const op = String(r[5] || '').trim();
    if (op && !op.toLowerCase().includes('oportunidad')) oportunidadesSet.add(op);

    const asset = String(r[7] || '').trim();
    if (asset && !asset.toLowerCase().includes('asset')) assetsSet.add(asset);

    const agente = String(r[9] || '').trim();
    if (agente && !agente.toLowerCase().includes('agente')) agentesSet.add(agente);

    const estado = String(r[11] || '').trim();
    if (estado && !estado.toLowerCase().includes('estado')) estadosSet.add(estado);

    const etapa = String(r[13] || '').trim();
    if (etapa && !etapa.toLowerCase().includes('etapa')) etapasSet.add(etapa);
  }

  return {
    integraciones,
    paises: Array.from(paisesSet),
    oportunidades: Array.from(oportunidadesSet),
    assets: Array.from(assetsSet),
    agentes: Array.from(agentesSet),
    estados: Array.from(estadosSet),
    etapas: Array.from(etapasSet)
  };
}

/**
 * Parsea las filas de Onboarding_New a objetos de caso
 */
function parsearFilasOnboarding(matriz: any[][]): any[] {
  if (!matriz || matriz.length < 2) return [];

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(6, matriz.length); i++) {
    const rowText = (matriz[i] || []).map(v => String(v || '').toLowerCase()).join(' ');
    if (rowText.includes('caso op') || (rowText.includes('tienda') && rowText.includes('integrac'))) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = (matriz[headerRowIdx] || []).map(h => String(h || '').trim());
  const findCol = (predicate: (h: string) => boolean): number => {
    return headers.findIndex(h => predicate(h.toLowerCase()));
  };

  const colCasoOp = findCol(h => (h.includes('caso') && h.includes('op')) || h === 'n° caso op');
  const colVendorId = findCol(h => h === 'id' || h.includes('vendor'));
  const colTienda = findCol(h => h.includes('tienda'));
  const colPais = findCol(h => h.includes('país') || h.includes('pais'));
  const colKam = findCol(h => h.includes('kam'));
  const colIntegracion = findCol(h => h.includes('integrac'));
  const colOportunidad = findCol(h => h.includes('oportunidad') && !h.includes('propietario'));
  const colAsset = findCol(h => h.includes('asset'));
  const colPropOp = findCol(h => h.includes('propietario') && h.includes('oportunidad'));
  const colPropTicket = findCol(h => h.includes('herocare') || (h.includes('propietario') && h.includes('ticket')));
  const colSeguimiento = findCol(h => h.includes('caso seguimiento') || (h.includes('caso') && h.includes('seguimiento')));
  const colTieneInicio = findCol(h => h.includes('onboarding') && h.includes('inicio') && h.includes('?'));
  const colComentarios = findCol(h => h.includes('comentario'));
  const colEstado = findCol(h => (h.includes('estado') && !h.includes('onboarding')) || h === 'estado del caso' || h === 'estado caso');
  const colEtapa = findCol(h => h.includes('etapa') || (h.includes('estado') && h.includes('onboarding')));
  const colFechaCreacion = findCol(h => h.includes('creación') || h.includes('creacion'));
  const colSlaInicio = findCol(h => h.includes('inicio de seguimiento de op'));
  const colFechaCierre = findCol(h => h.includes('cierre de op') || h.includes('cierre op'));

  const colFechaInicioPos = findCol(h => h.includes('inicio') && h.includes('pos'));
  const colFechaPushPos = findCol(h => h.includes('push') && h.includes('pos') && !h.includes('push kam'));
  const colRespPos = findCol(h => h.includes('respuesta') && h.includes('roadmap') && h.includes('pos') && !h.includes('fecha'));
  const colPushKamPos = findCol(h => h.includes('push kam') && h.includes('pos'));

  const colFechaInicioCat = findCol(h => h.includes('inicio') && (h.includes('catálogo') || h.includes('catalogo')));
  const colFechaPushCat = findCol(h => h.includes('push') && (h.includes('catálogo') || h.includes('catalogo')) && !h.includes('push kam'));
  const colRespCat = findCol(h => h.includes('respuesta') && h.includes('roadmap') && (h.includes('catálogo') || h.includes('catalogo')) && !h.includes('fecha'));
  const colPushKamCat = findCol(h => h.includes('push kam') && (h.includes('catálogo') || h.includes('catalogo')));

  const colTiempoLV = findCol(h => h.includes('tiempo transcurrido') && (h.includes('op') || h.includes('l-v') || h.includes('l v')));
  const colTiempoPos = findCol(h => h.includes('tiempo transcurrido') && h.includes('pos'));
  const colTiempoCat = findCol(h => h.includes('tiempo transcurrido') && (h.includes('catálogo') || h.includes('catalogo')));
  const colRangoSlaOP = findCol(h => (h.includes('rango sla') && (h.includes('op') || h.includes('horas'))) || h === 'rango sla op');
  const colRangoPos = findCol(h => h.includes('rango sla') && h.includes('pos'));
  const colRangoCat = findCol(h => h.includes('rango sla') && (h.includes('catálogo') || h.includes('catalogo')));

  const colFreezePos = findCol(h => h.includes('fecha de respuesta') && h.includes('pos'));
  const colFreezeCat = findCol(h => h.includes('fecha de respuesta') && (h.includes('catálogo') || h.includes('catalogo')));

  const rows = matriz.slice(headerRowIdx + 1);
  const casos: any[] = [];

  rows.forEach((row, idx) => {
    const getVal = (colIdx: number, fallback = ''): string => {
      if (colIdx >= 0 && row[colIdx] !== undefined && row[colIdx] !== null) {
        return String(row[colIdx]).trim();
      }
      return fallback;
    };

    const casoOp = getVal(colCasoOp >= 0 ? colCasoOp : 0);
    const vendorId = getVal(colVendorId >= 0 ? colVendorId : 1);
    const tienda = getVal(colTienda >= 0 ? colTienda : 2);

    if (!casoOp && !vendorId && !tienda) return;

    const pais = getVal(colPais >= 0 ? colPais : 3);
    const kam = getVal(colKam >= 0 ? colKam : 4);
    const integracion = getVal(colIntegracion >= 0 ? colIntegracion : 5);
    const oportunidad = getVal(colOportunidad >= 0 ? colOportunidad : 7);
    const asset = getVal(colAsset >= 0 ? colAsset : 8);
    const propietarioOportunidad = getVal(colPropOp >= 0 ? colPropOp : 9);
    const propietarioTicket = getVal(colPropTicket >= 0 ? colPropTicket : 10);
    const casoSeguimiento = getVal(colSeguimiento >= 0 ? colSeguimiento : 11);
    const tieneCasoInicio = getVal(colTieneInicio >= 0 ? colTieneInicio : 12, 'Si');
    const comentarios = getVal(colComentarios >= 0 ? colComentarios : 13);
    let estado = getVal(colEstado >= 0 ? colEstado : 14, 'Cerrado por oportunidad satisfactoria');
    let etapa = getVal(colEtapa >= 0 ? colEtapa : 15, 'Validación del Onboarding');
    const fechaCreacion = getVal(colFechaCreacion >= 0 ? colFechaCreacion : 16);
    const sla_inicio = getVal(colSlaInicio >= 0 ? colSlaInicio : 17, fechaCreacion || new Date().toISOString());

    const fechaCierre = getVal(colFechaCierre >= 0 ? colFechaCierre : 18);
    const fechaInicioPos = getVal(colFechaInicioPos >= 0 ? colFechaInicioPos : 19);
    const fechaPushPos = getVal(colFechaPushPos >= 0 ? colFechaPushPos : 20);
    const rawRespPos = getVal(colRespPos >= 0 ? colRespPos : 21);
    const respuestaPos = (rawRespPos.toLowerCase() === 'si' || rawRespPos.toLowerCase() === 'sí') ? 'Si' : (rawRespPos.toLowerCase() === 'no' ? 'No' : (rawRespPos.toUpperCase() === 'S/V' || rawRespPos.toUpperCase() === 'SV' ? 'S/V' : rawRespPos));
    const pushKamPos = getVal(colPushKamPos >= 0 ? colPushKamPos : 22);
    const fechaInicioCat = getVal(colFechaInicioCat >= 0 ? colFechaInicioCat : 23);
    const fechaPushCat = getVal(colFechaPushCat >= 0 ? colFechaPushCat : 24);
    const rawRespCat = getVal(colRespCat >= 0 ? colRespCat : 25);
    const respuestaCat = (rawRespCat.toLowerCase() === 'si' || rawRespCat.toLowerCase() === 'sí') ? 'Si' : (rawRespCat.toLowerCase() === 'no' ? 'No' : (rawRespCat.toUpperCase() === 'S/V' || rawRespCat.toUpperCase() === 'SV' ? 'S/V' : rawRespCat));
    const pushKamCat = getVal(colPushKamCat >= 0 ? colPushKamCat : 26);

    const tiempoTranscurridoOp = getVal(colTiempoLV >= 0 ? colTiempoLV : 30);
    const tiempoTranscurridoPos = getVal(colTiempoPos >= 0 ? colTiempoPos : 31);
    const tiempoTranscurridoCat = getVal(colTiempoCat >= 0 ? colTiempoCat : 32);

    const rangoSlaOp = getVal(colRangoSlaOP >= 0 ? colRangoSlaOP : 34);
    const rangoSlaPos = getVal(colRangoPos >= 0 ? colRangoPos : 35);
    const rangoSlaCat = getVal(colRangoCat >= 0 ? colRangoCat : 36);

    const fechaFreezePos = getVal(colFreezePos >= 0 ? colFreezePos : 39);
    const fechaFreezeCat = getVal(colFreezeCat >= 0 ? colFreezeCat : 40);

    let horasSLA = 0;
    if (tiempoTranscurridoOp) {
      const s = tiempoTranscurridoOp.toLowerCase();
      const mDias = s.match(/(\d+)\s*d[ií]as?/);
      const mHoras = s.match(/(\d+)\s*h/);
      const mMin = s.match(/(\d+)\s*m/);
      if (mDias) horasSLA += parseInt(mDias[1], 10) * 24;
      if (mHoras) horasSLA += parseInt(mHoras[1], 10);
      if (mMin) horasSLA += Math.round(parseInt(mMin[1], 10) / 60);
    }

    const estadoNorm = estado.toLowerCase().trim();
    const esActivo = estadoNorm === 'en progreso' || estadoNorm === 'nuevo' || estadoNorm === 'abierto' || estadoNorm.includes('ticket hc') || estadoNorm.includes('sin oportunidad');

    const filaNumero = headerRowIdx + 2 + idx;
    const idUnico = (casoOp && casoOp !== '-') ? casoOp : (vendorId ? `${vendorId}_${filaNumero}` : `fila_${filaNumero}`);

    casos.push({
      id: idUnico,
      casoOp,
      vendorId,
      vendor_id: vendorId,
      tienda,
      pais,
      kam,
      integracion,
      oportunidad,
      asset,
      casoSeguimiento,
      propietarioOportunidad,
      propietarioTicket,
      agente: propietarioTicket || propietarioOportunidad || '',
      tieneCasoInicio,
      comentarios,
      fechaCreacion,
      estado,
      etapa,
      sla_inicio,
      esActivo,
      origen: 'Google Sheets (API)',
      filaNumero,
      fechaCierre,
      fechaInicioPos,
      fechaPushPos,
      respuestaPos,
      pushKamPos,
      fechaInicioCat,
      fechaPushCat,
      respuestaCat,
      pushKamCat,
      tiempoTranscurridoOp,
      tiempoTranscurridoLV: tiempoTranscurridoOp,
      tiempoTranscurridoPos,
      tiempoTranscurridoCat,
      rangoSlaOp,
      rangoSla: rangoSlaOp,
      rangoSlaPos,
      rangoSlaCat,
      fechaFreezePos,
      fechaFreezeCat,
      horasSLA
    });
  });

  return casos;
}
