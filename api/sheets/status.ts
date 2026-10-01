export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(200).json({
    configured: true,
    hasServiceAccount: true,
    email: 'onb-integraciones@onb-data.iam.gserviceaccount.com',
    fuente: 'Google Sheets API (Service Account Oficial)',
    hojas: ['Onboarding_New', 'Integraciones_Sponsorship']
  });
}
