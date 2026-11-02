import { JWT } from 'google-auth-library';
import { getServiceAccountCreds } from '../../src/services/credsHelper';

const SPREADSHEET_ID = process.env.VITE_GOOGLE_SHEET_ID || '1obGQuhQx0FcxdoHNYUMzGqOzLFalhA63W8ze1tygHkk';

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const decoded = getServiceAccountCreds();
  const client = new JWT({
    email: decoded.client_email,
    key: decoded.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/spreadsheets']
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

  // 3. DD/MM/YYYY o DD-MM-YYYY sin hora -> estampa hora 00:00:00
  const matchDDMM = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (matchDDMM) {
    const dia = parseInt(matchDDMM[1], 10);
    const mes = parseInt(matchDDMM[2], 10);
    let anio = parseInt(matchDDMM[3], 10);
    if (anio < 100) anio += 2000;
    return `${dia}/${mes}/${anio} 00:00:00`;
  }

  // 4. YYYY-MM-DD o YYYY/MM/DD sin hora
  const matchISO = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (matchISO) {
    const anio = parseInt(matchISO[1], 10);
    const mes = parseInt(matchISO[2], 10);
    const dia = parseInt(matchISO[3], 10);
    return `${dia}/${mes}/${anio} 00:00:00`;
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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = await getToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent("'Onboarding_New'!A1:AZ")}?valueRenderOption=FORMATTED_VALUE`;
    const apiRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(apiRes.status).json({ success: false, error: errText });
    }

    const data = await apiRes.json();
    const rows = data.values || [];
    
    // Parsear filas de Onboarding_New
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(6, rows.length); i++) {
      const rowText = (rows[i] || []).map((v: any) => String(v || '').toLowerCase()).join(' ');
      if (rowText.includes('caso op') || (rowText.includes('tienda') && rowText.includes('integrac'))) {
        headerRowIdx = i;
        break;
      }
    }

    const headers: string[] = (rows[headerRowIdx] || []).map((h: any) => String(h || '').trim());
    const findCol = (predicate: (h: string) => boolean): number => {
      return headers.findIndex((h: string) => predicate(h.toLowerCase()));
    };

    const colCasoOp = findCol(h => h.includes('caso op') || h === 'n° caso op');
    const colVendorId = findCol(h => h === 'id' || h === 'vendor id' || h.includes('vendor'));
    const colTienda = findCol(h => h === 'tienda' || h.includes('tienda'));
    const colPais = findCol(h => h.includes('país') || h.includes('pais'));
    const colKam = findCol(h => h.includes('kam') && !h.includes('push kam'));
    const colIntegracion = findCol(h => h.includes('integración') || h.includes('integrac'));
    const colSponsorship = findCol(h => h.includes('sponsorship'));
    const colOportunidad = findCol(h => h === 'oportunidad' || (h.includes('oportunidad') && !h.includes('propietario')));
    const colAsset = findCol(h => h.includes('asset'));
    const colPropOp = findCol(h => h.includes('propietario') && h.includes('oportunidad'));
    const colPropTicket = findCol(h => h.includes('herocare') || (h.includes('propietario') && h.includes('ticket')));
    const colSeguimiento = findCol(h => h === 'n° caso seguimiento' || h.includes('caso seguimiento'));
    const colTieneInicio = findCol(h => h.includes('inicio de seguimiento') && h.includes('?'));
    const colComentarios = findCol(h => h.includes('comentario'));
    const colEstado = findCol(h => h.includes('estado del caso') || h === 'estado');
    const colEtapa = findCol(h => h.includes('etapa'));
    const colEstadoTicketSeguimiento = findCol(h => h.includes('estado del ticket') || h.includes('estado ticket'));
    const colFechaCreacion = findCol(h => h.includes('creación') || h.includes('creacion'));
    const colSlaInicio = findCol(h => h.includes('inicio de seguimiento de op'));
    const colFechaCierre = findCol(h => h.includes('cierre de op') || (h.includes('cierre') && h.includes('op')));
    const colFechaCierreSeguimiento = findCol(h => h.includes('cierre de seguimiento'));
    const colFechaInicioPos = findCol(h => h.includes('inicio') && h.includes('pos'));
    const colFechaPushPos = findCol(h => h.includes('push') && h.includes('pos') && !h.includes('push kam'));
    const colRespPos = findCol(h => h.includes('¿existe respuesta') && h.includes('pos'));
    const colPushKamPos = findCol(h => h.includes('push kam') && h.includes('pos'));
    const colFechaInicioCat = findCol(h => h.includes('inicio') && (h.includes('catálogo') || h.includes('catalogo')));
    const colFechaPushCat = findCol(h => h.includes('push') && (h.includes('catálogo') || h.includes('catalogo')) && !h.includes('push kam'));
    const colRespCat = findCol(h => h.includes('¿existe respuesta') && (h.includes('catálogo') || h.includes('catalogo')));
    const colPushKamCat = findCol(h => h.includes('push kam') && (h.includes('catálogo') || h.includes('catalogo')));
    const colTiempoLV = findCol(h => h.includes('tiempo transcurrido') && h.includes('op'));
    const colTiempoPos = findCol(h => h.includes('tiempo transcurrido') && h.includes('pos'));
    const colTiempoCat = findCol(h => h.includes('tiempo transcurrido') && (h.includes('catálogo') || h.includes('catalogo')));
    const colRangoSlaOP = findCol(h => h.includes('rango sla') && h.includes('op'));
    const colRangoPos = findCol(h => h.includes('rango sla') && h.includes('pos'));
    const colRangoCat = findCol(h => h.includes('rango sla') && (h.includes('catálogo') || h.includes('catalogo')));
    const colFreezePos = findCol(h => h.includes('fecha de respuesta en roadmap pos') || (h.includes('freeze') && h.includes('pos')));
    const colFreezeCat = findCol(h => h.includes('fecha de respuesta en roadmap') && (h.includes('catálogo') || h.includes('catalogo')));
    const dataRows = rows.slice(headerRowIdx + 1);
    const casos: any[] = [];

    dataRows.forEach((row: any[], idx: number) => {
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
      let estado = getVal(colEstado >= 0 ? colEstado : 14, 'En progreso');
      let etapa = getVal(colEtapa >= 0 ? colEtapa : 15, 'Validación del Onboarding');
      const estadoTicketSeguimiento = getVal(colEstadoTicketSeguimiento >= 0 ? colEstadoTicketSeguimiento : 16, 'Abierto');
      const rawFechaCreacion = getVal(colFechaCreacion >= 0 ? colFechaCreacion : 17);
      const fechaCreacion = formatearFechaHoraSheet(rawFechaCreacion);
      const rawSlaInicio = getVal(colSlaInicio >= 0 ? colSlaInicio : 18, rawFechaCreacion || '');
      const sla_inicio = formatearFechaHoraSheet(rawSlaInicio);
      const rawFechaCierre = getVal(colFechaCierre >= 0 ? colFechaCierre : 19);
      const fechaCierre = rawFechaCierre && rawFechaCierre !== '-' ? formatearFechaHoraSheet(rawFechaCierre) : rawFechaCierre;
      const rawFechaCierreSeg = getVal(colFechaCierreSeguimiento >= 0 ? colFechaCierreSeguimiento : 20);
      const fechaCierreSeguimiento = rawFechaCierreSeg && rawFechaCierreSeg !== '-' ? formatearFechaHoraSheet(rawFechaCierreSeg) : rawFechaCierreSeg;
      const rawInicioPos = getVal(colFechaInicioPos >= 0 ? colFechaInicioPos : 21);
      const fechaInicioPos = rawInicioPos && rawInicioPos !== 'S/V' ? formatearFechaHoraSheet(rawInicioPos) : rawInicioPos;
      const rawPushPos = getVal(colFechaPushPos >= 0 ? colFechaPushPos : 22);
      const fechaPushPos = rawPushPos && rawPushPos !== 'S/V' ? formatearFechaHoraSheet(rawPushPos) : rawPushPos;
      const rawRespPos = getVal(colRespPos >= 0 ? colRespPos : 23, 'No');
      const respuestaPos = (rawRespPos.toLowerCase() === 'si' || rawRespPos.toLowerCase() === 'sí') ? 'Si' : (rawRespPos.toLowerCase() === 'no' ? 'No' : (rawRespPos.toUpperCase() === 'S/V' ? 'S/V' : rawRespPos));
      const rawPushKamPos = getVal(colPushKamPos >= 0 ? colPushKamPos : 24);
      const pushKamPos = ['TRUE', 'VERDADERO', 'SI', 'SÍ', '1'].includes(String(rawPushKamPos).trim().toUpperCase()) ? 'TRUE' : 'FALSE';
      const rawInicioCat = getVal(colFechaInicioCat >= 0 ? colFechaInicioCat : 25);
      const fechaInicioCat = rawInicioCat && rawInicioCat !== 'S/V' ? formatearFechaHoraSheet(rawInicioCat) : rawInicioCat;
      const rawPushCat = getVal(colFechaPushCat >= 0 ? colFechaPushCat : 26);
      const fechaPushCat = rawPushCat && rawPushCat !== 'S/V' ? formatearFechaHoraSheet(rawPushCat) : rawPushCat;
      const rawRespCat = getVal(colRespCat >= 0 ? colRespCat : 27, 'No');
      const respuestaCat = (rawRespCat.toLowerCase() === 'si' || rawRespCat.toLowerCase() === 'sí') ? 'Si' : (rawRespCat.toLowerCase() === 'no' ? 'No' : (rawRespCat.toUpperCase() === 'S/V' ? 'S/V' : rawRespCat));
      const rawPushKamCat = getVal(colPushKamCat >= 0 ? colPushKamCat : 28);
      const pushKamCat = ['TRUE', 'VERDADERO', 'SI', 'SÍ', '1'].includes(String(rawPushKamCat).trim().toUpperCase()) ? 'TRUE' : 'FALSE';
      const freezePos = getVal(colFreezePos >= 0 ? colFreezePos : 41);
      const freezeCat = getVal(colFreezeCat >= 0 ? colFreezeCat : 42);
      const tiempoTranscurridoOp = getVal(colTiempoLV >= 0 ? colTiempoLV : 30);
      const tiempoTranscurridoPos = getVal(colTiempoPos >= 0 ? colTiempoPos : -1);
      const tiempoTranscurridoCat = getVal(colTiempoCat >= 0 ? colTiempoCat : -1);
      const rangoSlaOp = getVal(colRangoSlaOP >= 0 ? colRangoSlaOP : 34);
      const rangoSlaPos = getVal(colRangoPos >= 0 ? colRangoPos : 35);
      const rangoSlaCat = getVal(colRangoCat >= 0 ? colRangoCat : 36);

      let horasSLA = 0;
      if (tiempoTranscurridoOp) {
        const s = tiempoTranscurridoOp.toLowerCase();
        const mDias = s.match(/(\d+)\s*d[ií]as?/);
        const mHoras = s.match(/(\d+)\s*h/);
        if (mDias) horasSLA += parseInt(mDias[1], 10) * 24;
        if (mHoras) horasSLA += parseInt(mHoras[1], 10);
      }

      const estadoNorm = estado.toLowerCase().trim();
      const esActivo = estadoNorm === 'en progreso' || estadoNorm === 'nuevo' || estadoNorm === 'abierto' || estadoNorm.includes('ticket hc') || estadoNorm.includes('sin oportunidad');

      const filaNumero = headerRowIdx + idx + 2;
      const idUnico = (casoOp && vendorId) ? `${casoOp}_${vendorId}_r${filaNumero}` : ((casoOp && casoOp !== '-') ? `${casoOp}_r${filaNumero}` : (vendorId ? `${vendorId}_r${filaNumero}` : `CASO-${filaNumero}`));

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
        estadoTicketSeguimiento,
        sla_inicio,
        esActivo,
        origen: 'Google Sheets (API)',
        filaNumero,
        fechaCierre,
        fechaCierreSeguimiento,
        fechaInicioPos,
        fechaPushPos,
        respuestaPos,
        pushKamPos,
        fechaInicioCat,
        fechaPushCat,
        respuestaCat,
        pushKamCat,
        freezePos,
        freezeCat,
        fechaFreezePos: freezePos,
        fechaFreezeCat: freezeCat,
        tiempoTranscurridoOp,
        tiempoTranscurridoPos,
        tiempoTranscurridoCat,
        tiempoTranscurridoLV: tiempoTranscurridoOp,
        rangoSlaOp,
        rangoSlaPos,
        rangoSlaCat,
        rangoSla: rangoSlaOp,
        horasSLA
      });
    });

    return res.status(200).json({
      success: true,
      total: casos.length,
      activos: casos.filter(c => c.esActivo).length,
      casos
    });
  } catch (err: any) {
    console.error('Error en /api/sheets/casos:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
