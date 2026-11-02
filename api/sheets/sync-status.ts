import { sheetsBackendService } from '../../src/services/sheetsBackendService';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  res.json({
    success: true,
    ultimoCambioTimestamp: sheetsBackendService.obtenerUltimoCambio(),
    totalCasos: sheetsBackendService.obtenerTotal()
  });
}
