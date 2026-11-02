import { sheetsBackendService } from '../../src/services/sheetsBackendService';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { csvText, origen } = req.body || {};
    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ success: false, error: 'Debe proporcionar el texto CSV' });
    }

    const casos = sheetsBackendService.parsearCSV(csvText, origen || 'Archivo CSV importado');
    return res.json({
      success: true,
      message: `Se importaron ${casos.length} casos correctamente.`,
      total: casos.length,
      activos: casos.filter(c => c.esActivo).length,
      casos
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
