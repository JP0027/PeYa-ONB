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

export async function guardarSeccionIntegraciones(seccion: string, items: any[]): Promise<{ success: boolean; message: string; catalogos?: any }> {
  const token = await getToken();
  let rangoClear = '';
  let rangoUpdate = '';
  let values: any[][] = [];

  switch (seccion.toLowerCase()) {
    case 'integraciones':
      rangoClear = "Integraciones_Sponsorship!A2:B";
      rangoUpdate = `Integraciones_Sponsorship!A2:B${Math.max(items.length + 1, 2)}`;
      values = items.map(item => {
        const nom = typeof item === 'object' ? item.nombre : String(item);
        const sp = (typeof item === 'object' && (String(item.sponsorship).toUpperCase() === 'SI' || item.sponsorship === true)) ? 'SI' : 'NO';
        return [nom, sp];
      });
      break;

    case 'paises':
      rangoClear = "Integraciones_Sponsorship!D2:D";
      rangoUpdate = `Integraciones_Sponsorship!D2:D${Math.max(items.length + 1, 2)}`;
      values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
      break;

    case 'oportunidades':
      rangoClear = "Integraciones_Sponsorship!F2:F";
      rangoUpdate = `Integraciones_Sponsorship!F2:F${Math.max(items.length + 1, 2)}`;
      values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
      break;

    case 'assets':
      rangoClear = "Integraciones_Sponsorship!H2:H";
      rangoUpdate = `Integraciones_Sponsorship!H2:H${Math.max(items.length + 1, 2)}`;
      values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
      break;

    case 'agentes':
      rangoClear = "Integraciones_Sponsorship!J2:J";
      rangoUpdate = `Integraciones_Sponsorship!J2:J${Math.max(items.length + 1, 2)}`;
      values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
      break;

    case 'estados':
      rangoClear = "Integraciones_Sponsorship!L2:L";
      rangoUpdate = `Integraciones_Sponsorship!L2:L${Math.max(items.length + 1, 2)}`;
      values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
      break;

    case 'etapas':
      rangoClear = "Integraciones_Sponsorship!N2:N";
      rangoUpdate = `Integraciones_Sponsorship!N2:N${Math.max(items.length + 1, 2)}`;
      values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
      break;

    default:
      throw new Error(`Sección no reconocida: ${seccion}`);
  }

  // 1. Limpiar rango antiguo
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(rangoClear)}:clear`;
  await fetch(clearUrl, {
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
    const resUpdate = await fetch(updateUrl, {
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

  // 3. Leer la hoja completa para devolver el catálogo actualizado
  const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent("'Integraciones_Sponsorship'!A:N")}?valueRenderOption=FORMATTED_VALUE`;
  const resRead = await fetch(readUrl, {
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
      if (pais && pais.toLowerCase() !== 'país' && pais.toLowerCase() !== 'pais') paisesSet.add(pais);

      const op = String(r[5] || '').trim();
      if (op && op.toLowerCase() !== 'oportunidad') oportunidadesSet.add(op);

      const asset = String(r[7] || '').trim();
      if (asset && asset.toLowerCase() !== 'asset') assetsSet.add(asset);

      const agente = String(r[9] || '').trim();
      if (agente && agente.toLowerCase() !== 'agente') agentesSet.add(agente);

      const estado = String(r[11] || '').trim();
      if (estado && estado.toLowerCase() !== 'estado' && estado.toLowerCase() !== 'estado del caso') estadosSet.add(estado);

      const etapa = String(r[13] || '').trim();
      if (etapa && etapa.toLowerCase() !== 'etapa' && etapa.toLowerCase() !== 'etapa del onboarding') etapasSet.add(etapa);
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
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido, use POST' });
  }

  try {
    const { seccion, items } = req.body || {};
    if (!seccion || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Se requiere seccion y array de items' });
    }

    const resultado = await guardarSeccionIntegraciones(seccion, items);
    return res.status(200).json(resultado);
  } catch (err: any) {
    console.error('Error en /api/sheets/catalogos/guardar-seccion:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
