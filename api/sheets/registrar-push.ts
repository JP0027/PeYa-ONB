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
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const res = await client.authorize();
  cachedToken = res.access_token || '';
  tokenExpiry = (res.expiry_date as number) || (Date.now() + 3500 * 1000);
  return cachedToken;
}

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
    const { 
      casoId, 
      casoOp, 
      filaNumero, 
      fecha, 
      tipo,
      respuestaPos,
      pushKamPos,
      fechaInicioPos,
      freezePos,
      respuestaCat,
      pushKamCat,
      fechaInicioCat,
      freezeCat
    } = req.body || {};
    const idBusqueda = String(casoOp || casoId || '').trim();

    if (!idBusqueda) {
      return res.status(400).json({ success: false, error: 'Se requiere casoId o casoOp' });
    }

    const token = await getToken();

    // 1. Consultar hoja completa A2:AQ para detectar la fila y los valores actuales
    let filaTarget = (typeof filaNumero === 'number' && filaNumero >= 2) ? filaNumero : 0;
    let targetRowData: any[] = [];

    const urlCols = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'Onboarding_New'!A2:AQ?valueRenderOption=FORMATTED_VALUE`;
    const resCols = await fetchConReintento(urlCols, {
      headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' }
    });

    if (resCols.ok) {
      const dataCols = await resCols.json();
      const rows = dataCols.values || [];

      if (filaTarget >= 2 && (filaTarget - 2) < rows.length) {
        const r = rows[filaTarget - 2] || [];
        const op = String(r[0] || '').trim();
        const ven = String(r[1] || '').trim();
        if (op === idBusqueda || ven === idBusqueda || idBusqueda.startsWith(op + '_') || idBusqueda.startsWith(ven + '_')) {
          targetRowData = r;
        } else {
          filaTarget = 0;
        }
      }

      if (!filaTarget) {
        for (let i = rows.length - 1; i >= 0; i--) {
          const op = String(rows[i]?.[0] || '').trim();
          const ven = String(rows[i]?.[1] || '').trim();
          if (
            (op && op !== 'Sin caso OP' && op !== '-' && (op === idBusqueda || idBusqueda.startsWith(op + '_'))) ||
            (ven && (ven === idBusqueda || idBusqueda.startsWith(ven + '_')))
          ) {
            filaTarget = i + 2;
            targetRowData = rows[i] || [];
            break;
          }
        }
      }
    }

    if (filaTarget < 2) {
      return res.status(404).json({ success: false, error: `Caso OP ${idBusqueda} no encontrado en Google Sheets.` });
    }

    // 2. Preparar actualizaciones según las 4 reglas oficiales
    const dataUpdates: any[] = [];
    const fechaHoraPush = String(fecha || '').trim();

    if (tipo === 'pos') {
      const etapaLower = String(targetRowData[15] || '').toLowerCase().trim();
      const esEsperaPos = etapaLower.includes('sin integración confirmada') || etapaLower.includes('sin integracion confirmada') || etapaLower.includes('en proceso de seteo');
      
      let respPosFinal = respuestaPos ? String(respuestaPos).trim() : (esEsperaPos ? 'No' : 'Si');
      if (respPosFinal.toLowerCase() === 'si' || respPosFinal.toLowerCase() === 'sí') respPosFinal = 'Si';
      else if (respPosFinal.toUpperCase() === 'S/V') respPosFinal = 'S/V';
      else respPosFinal = 'No';

      let pushKamPosStr = 'FALSE';
      let freezePosFinal = '';
      if (respPosFinal === 'Si') {
        pushKamPosStr = 'TRUE';
        freezePosFinal = freezePos || fechaHoraPush;
      } else if (respPosFinal === 'S/V') {
        pushKamPosStr = 'TRUE';
        freezePosFinal = '';
      } else {
        pushKamPosStr = 'FALSE';
        freezePosFinal = '';
      }

      const inicioActual = String(targetRowData[21] || '').trim();
      const tieneInicio = inicioActual && inicioActual !== '-' && inicioActual !== 'S/V';
      const fInicioFinal = tieneInicio ? inicioActual : (fechaInicioPos || targetRowData[18] || targetRowData[17] || fechaHoraPush);

      dataUpdates.push({
        range: `'Onboarding_New'!V${filaTarget}:Y${filaTarget}`,
        values: [[fInicioFinal, fechaHoraPush, respPosFinal, pushKamPosStr]]
      });

      dataUpdates.push({
        range: `'Onboarding_New'!AP${filaTarget}`,
        values: [[freezePosFinal]]
      });

    } else if (tipo === 'cat') {
      const etapaLower = String(targetRowData[15] || '').toLowerCase().trim();
      const esEsperaCat = etapaLower.includes('verificación de catálogo') || etapaLower.includes('verificacion de catalogo') || etapaLower.includes('carga de catálogo') || etapaLower.includes('carga de catalogo');

      let respCatFinal = respuestaCat ? String(respuestaCat).trim() : (esEsperaCat ? 'No' : 'Si');
      if (respCatFinal.toLowerCase() === 'si' || respCatFinal.toLowerCase() === 'sí') respCatFinal = 'Si';
      else if (respCatFinal.toUpperCase() === 'S/V') respCatFinal = 'S/V';
      else respCatFinal = 'No';

      let pushKamCatStr = 'FALSE';
      let freezeCatFinal = '';
      if (respCatFinal === 'Si') {
        pushKamCatStr = 'TRUE';
        freezeCatFinal = freezeCat || fechaHoraPush;
      } else if (respCatFinal === 'S/V') {
        pushKamCatStr = 'TRUE';
        freezeCatFinal = '';
      } else {
        pushKamCatStr = 'FALSE';
        freezeCatFinal = '';
      }

      const inicioActualCat = String(targetRowData[25] || '').trim();
      const tieneInicioCat = inicioActualCat && inicioActualCat !== '-' && inicioActualCat !== 'S/V';
      const fInicioCatFinal = tieneInicioCat ? inicioActualCat : (fechaInicioCat || targetRowData[18] || targetRowData[17] || fechaHoraPush);

      dataUpdates.push({
        range: `'Onboarding_New'!Z${filaTarget}:AC${filaTarget}`,
        values: [[fInicioCatFinal, fechaHoraPush, respCatFinal, pushKamCatStr]]
      });

      dataUpdates.push({
        range: `'Onboarding_New'!AQ${filaTarget}`,
        values: [[freezeCatFinal]]
      });

    } else if (tipo === 'kam_pos') {
      dataUpdates.push({
        range: `'Onboarding_New'!Y${filaTarget}`,
        values: [['TRUE']]
      });
    } else if (tipo === 'kam_cat') {
      dataUpdates.push({
        range: `'Onboarding_New'!AC${filaTarget}`,
        values: [['TRUE']]
      });
    } else {
      return res.status(400).json({ success: false, error: `Tipo de push desconocido: ${tipo}` });
    }

    // 3. Ejecutar batchUpdate atómico
    const urlBatch = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`;
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
      return res.status(apiRes.status).json({ success: false, error: errText });
    }

    return res.status(200).json({
      success: true,
      filaNumero: filaTarget,
      tipo,
      fecha: fechaHoraPush,
      updates: dataUpdates,
      message: `Push ${tipo} y reglas automáticas registradas exitosamente en fila #${filaTarget}.`
    });
  } catch (err: any) {
    console.error('[API registrar-push] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
