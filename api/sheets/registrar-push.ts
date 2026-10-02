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
    const { casoId, casoOp, filaNumero, fecha, tipo } = req.body || {};
    const idBusqueda = String(casoOp || casoId || '').trim();

    if (!idBusqueda) {
      return res.status(400).json({ success: false, error: 'Se requiere casoId o casoOp' });
    }

    const token = await getToken();

    // 1. Determinar columna y valor exacto
    let colLetra = '';
    let nuevoValor = '';
    if (tipo === 'pos') {
      colLetra = 'U';
      nuevoValor = String(fecha || '').trim();
    } else if (tipo === 'cat') {
      colLetra = 'Y';
      nuevoValor = String(fecha || '').trim();
    } else if (tipo === 'kam_pos') {
      colLetra = 'W';
      nuevoValor = 'TRUE';
    } else if (tipo === 'kam_cat') {
      colLetra = 'AA';
      nuevoValor = 'TRUE';
    }

    if (!colLetra) {
      return res.status(400).json({ success: false, error: `Tipo de push desconocido: ${tipo}` });
    }

    // 2. Buscar fila exacta de abajo hacia arriba por casoOp en Google Sheets
    let filaTarget = (typeof filaNumero === 'number' && filaNumero >= 2) ? filaNumero : 0;

    const urlCols = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'Onboarding_New'!A2:B?valueRenderOption=FORMATTED_VALUE`;
    const resCols = await fetch(urlCols, {
      headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' }
    });

    if (resCols.ok) {
      const dataCols = await resCols.json();
      const rows = dataCols.values || [];

      // Buscar de abajo hacia arriba tomando el último registrado
      for (let i = rows.length - 1; i >= 0; i--) {
        const op = String(rows[i]?.[0] || '').trim();
        const ven = String(rows[i]?.[1] || '').trim();
        if (
          (op && op !== 'Sin caso OP' && op !== '-' && (op === idBusqueda || idBusqueda.startsWith(op + '_'))) ||
          (ven && (ven === idBusqueda || idBusqueda.startsWith(ven + '_')))
        ) {
          filaTarget = i + 2;
          break;
        }
      }
    }

    if (filaTarget < 2) {
      return res.status(404).json({ success: false, error: `Caso OP ${idBusqueda} no encontrado en Google Sheets.` });
    }

    // 3. Actualizar ÚNICAMENTE la celda requerida (sin insertar ni sobreescribir otras filas)
    const celda = `'Onboarding_New'!${colLetra}${filaTarget}`;
    const urlPut = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(celda)}?valueInputOption=USER_ENTERED`;
    
    const apiRes = await fetch(urlPut, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: celda,
        values: [[nuevoValor]]
      })
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(apiRes.status).json({ success: false, error: errText });
    }

    return res.status(200).json({
      success: true,
      filaNumero: filaTarget,
      celda,
      tipo,
      valor: nuevoValor,
      message: `Push ${tipo} registrado en celda ${celda} de Google Sheets.`
    });
  } catch (err: any) {
    console.error('[API registrar-push] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
