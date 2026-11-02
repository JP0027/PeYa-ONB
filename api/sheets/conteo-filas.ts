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
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const res = await client.authorize();
  cachedToken = res.access_token || '';
  tokenExpiry = (res.expiry_date as number) || (Date.now() + 3500 * 1000);
  return cachedToken;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = await getToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'Onboarding_New'!A:B?valueRenderOption=FORMATTED_VALUE`;
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

    const json = await apiRes.json();
    const rows = json.values || [];
    
    let ultimaFilaConDatos = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i] || [];
      const op = String(row[0] || '').trim();
      const ven = String(row[1] || '').trim();
      if (op || ven) {
        ultimaFilaConDatos = i + 1;
        break;
      }
    }

    const totalFilas = ultimaFilaConDatos || (rows.length > 0 ? rows.length : 2);
    const totalCasos = Math.max(0, totalFilas - 2);
    const proximaFilaNueva = totalFilas + 1;

    return res.status(200).json({
      success: true,
      totalFilas,
      totalCasos,
      proximaFilaNueva
    });
  } catch (err: any) {
    console.error('Error en /api/sheets/conteo-filas:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
