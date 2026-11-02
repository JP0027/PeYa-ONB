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
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent("'Integraciones_Sponsorship'!A:C")}?valueRenderOption=FORMATTED_VALUE`;
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
    const integraciones: { nombre: string; sponsorship: string; contactos?: string }[] = [];

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
    }

    return res.status(200).json({
      success: true,
      integraciones
    });
  } catch (err: any) {
    console.error('Error en /api/sheets/integraciones:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
