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

async function fetchConReintento(url: string, options: RequestInit, maxReintentos: number = 3): Promise<Response> {
  let lastErr: any = null;
  for (let i = 0; i < maxReintentos; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, 600 * (i + 1)));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr || new Error('Google Sheets API request failed');
}

async function guardarSeccionIntegraciones(seccion: string, items: any[]): Promise<any> {
  const token = await getToken();
  let rangoClear = '';
  let rangoUpdate = '';
  let values: any[][] = [];

  const secLower = String(seccion || '').toLowerCase().trim();

  switch (secLower) {
    case 'integraciones':
      rangoClear = "Integraciones_Sponsorship!A2:C";
      rangoUpdate = `Integraciones_Sponsorship!A2:C${Math.max(items.length + 1, 2)}`;
      values = items.map(item => {
        const nom = typeof item === 'object' ? item.nombre : String(item);
        const sp = (typeof item === 'object' && (String(item.sponsorship).toUpperCase() === 'SI' || item.sponsorship === true)) ? 'SI' : 'NO';
        const cont = (typeof item === 'object' && typeof item.contactos === 'string') ? item.contactos : '';
        return [nom, sp, cont];
      });
      break;

    case 'paises':
      rangoClear = "Integraciones_Sponsorship!E2:E";
      rangoUpdate = `Integraciones_Sponsorship!E2:E${Math.max(items.length + 1, 2)}`;
      values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
      break;

    case 'oportunidades':
      rangoClear = "Integraciones_Sponsorship!G2:G";
      rangoUpdate = `Integraciones_Sponsorship!G2:G${Math.max(items.length + 1, 2)}`;
      values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
      break;

    case 'assets':
      rangoClear = "Integraciones_Sponsorship!I2:I";
      rangoUpdate = `Integraciones_Sponsorship!I2:I${Math.max(items.length + 1, 2)}`;
      values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
      break;

    case 'agentes':
      rangoClear = "Integraciones_Sponsorship!K2:K";
      rangoUpdate = `Integraciones_Sponsorship!K2:K${Math.max(items.length + 1, 2)}`;
      values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
      break;

    case 'estados':
      rangoClear = "Integraciones_Sponsorship!M2:M";
      rangoUpdate = `Integraciones_Sponsorship!M2:M${Math.max(items.length + 1, 2)}`;
      values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
      break;

    case 'etapas':
      rangoClear = "Integraciones_Sponsorship!O2:O";
      rangoUpdate = `Integraciones_Sponsorship!O2:O${Math.max(items.length + 1, 2)}`;
      values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
      break;

    default:
      throw new Error(`Sección no reconocida: ${seccion}`);
  }

  // 1. Limpiar rango antiguo
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(rangoClear)}:clear`;
  await fetchConReintento(clearUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  // 2. Escribir nuevos valores
  if (values.length > 0) {
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(rangoUpdate)}?valueInputOption=USER_ENTERED`;
    const resUpdate = await fetchConReintento(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: rangoUpdate,
        values
      })
    });

    if (!resUpdate.ok) {
      const errText = await resUpdate.text();
      throw new Error(`Error en Google Sheets API [${resUpdate.status}]: ${errText}`);
    }
  }

  // 3. Leer la hoja completa actualizada
  const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent("'Integraciones_Sponsorship'!A:O")}?valueRenderOption=FORMATTED_VALUE`;
  const resRead = await fetchConReintento(readUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    }
  });

  let catalogos: any = null;
  if (resRead.ok) {
    const data = await resRead.json();
    const rows = data.values || [];
    const integraciones: { nombre: string; sponsorship: string; contactos?: string }[] = [];
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
      const contactosInt = String(r[2] || '').trim();
      if (nombreInt) {
        integraciones.push({
          nombre: nombreInt,
          sponsorship: (sponsInt === 'SI' || sponsInt === 'SÍ' || sponsInt === 'TRUE' || sponsInt === 'VERDADERO') ? 'SI' : 'NO',
          contactos: contactosInt
        });
      }

      const pais = String(r[4] || '').trim();
      if (pais) paisesSet.add(pais);

      const op = String(r[6] || '').trim();
      if (op) oportunidadesSet.add(op);

      const asset = String(r[8] || '').trim();
      if (asset) assetsSet.add(asset);

      const agente = String(r[10] || '').trim();
      if (agente) agentesSet.add(agente);

      const estado = String(r[12] || '').trim();
      if (estado) estadosSet.add(estado);

      const etapa = String(r[14] || '').trim();
      if (etapa) etapasSet.add(etapa);
    }

    catalogos = {
      integraciones,
      paises: Array.from(paisesSet),
      oportunidades: Array.from(oportunidadesSet),
      assets: Array.from(assetsSet),
      agentes: Array.from(agentesSet),
      estados: Array.from(estadosSet),
      etapas: Array.from(etapasSet)
    };
  }

  return {
    success: true,
    message: `Columna "${seccion}" sincronizada con éxito en Integraciones_Sponsorship.`,
    catalogos
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const { seccion, items } = req.body || {};
      if (!seccion || !Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'Se requiere seccion y array de items' });
      }
      const resultado = await guardarSeccionIntegraciones(seccion, items);
      return res.status(200).json(resultado);
    } catch (err: any) {
      console.error('Error en POST /api/sheets/catalogos:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  try {
    const token = await getToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent("'Integraciones_Sponsorship'!A:O")}?valueRenderOption=FORMATTED_VALUE`;
    const apiRes = await fetchConReintento(url, {
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

    const integraciones: { nombre: string; sponsorship: string; contactos?: string }[] = [];
    const paisesSet = new Set<string>();
    const oportunidadesSet = new Set<string>();
    const assetsSet = new Set<string>();
    const agentesSet = new Set<string>();
    const estadosSet = new Set<string>();
    const etapasSet = new Set<string>();

    let headerIdx = 0;
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      const lineStr = (rows[i] || []).map((c: any) => String(c || '').toLowerCase()).join(' ');
      if (lineStr.includes('país') || lineStr.includes('pais') || lineStr.includes('oportunidad')) {
        headerIdx = i;
        break;
      }
    }

    const headers: string[] = (rows[headerIdx] || []).map((h: any) => String(h || '').trim().toLowerCase());
    const findCol = (name: string, fallbackIdx: number): number => {
      const idx = headers.findIndex(h => h.includes(name));
      return idx >= 0 ? idx : fallbackIdx;
    };

    const colPais = findCol('país', 4);
    const colOportunidad = findCol('oportunidad', 6);
    const colAsset = findCol('asset', 8);
    const colAgente = findCol('agente', 10);
    const colEstado = findCol('estado', 12);
    const colEtapa = findCol('etapa', 14);

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const nombreInt = String(r[0] || '').trim();
      const sponsInt = String(r[1] || '').trim().toUpperCase();
      const contactosInt = String(r[2] || '').trim();
      if (nombreInt) {
        integraciones.push({
          nombre: nombreInt,
          sponsorship: (sponsInt === 'SI' || sponsInt === 'SÍ' || sponsInt === 'TRUE' || sponsInt === 'VERDADERO') ? 'SI' : 'NO',
          contactos: contactosInt
        });
      }

      const pais = String(r[colPais] || '').trim();
      if (pais) paisesSet.add(pais);

      const op = String(r[colOportunidad] || '').trim();
      if (op) oportunidadesSet.add(op);

      const asset = String(r[colAsset] || '').trim();
      if (asset) assetsSet.add(asset);

      const agente = String(r[colAgente] || '').trim();
      if (agente) agentesSet.add(agente);

      const estado = String(r[colEstado] || '').trim();
      if (estado) estadosSet.add(estado);

      const etapa = String(r[colEtapa] || '').trim();
      if (etapa) etapasSet.add(etapa);
    }

    return res.status(200).json({
      success: true,
      catalogos: {
        integraciones,
        paises: Array.from(paisesSet),
        oportunidades: Array.from(oportunidadesSet),
        assets: Array.from(assetsSet),
        agentes: Array.from(agentesSet),
        estados: Array.from(estadosSet),
        etapas: Array.from(etapasSet)
      }
    });
  } catch (err: any) {
    console.error('Error en /api/sheets/catalogos:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
