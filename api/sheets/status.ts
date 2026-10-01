import { setCORS, obtenerCredenciales } from '../_sheetsHelper';

export default function handler(req: any, res: any) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const creds = obtenerCredenciales();
    return res.status(200).json({
      configured: true,
      hasServiceAccount: true,
      email: creds.client_email,
      fuente: 'Google Sheets API (Service Account Oficial)',
      hojas: ['Onboarding_New', 'Integraciones_Sponsorship']
    });
  } catch (err: any) {
    return res.status(200).json({
      configured: false,
      error: err.message
    });
  }
}
