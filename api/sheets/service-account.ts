import { sheetsBackendService } from '../../src/services/sheetsBackendService';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const payload = req.body;
    if (!payload) {
      return res.status(400).json({ success: false, error: 'Cuerpo vacio' });
    }
    const resultado = sheetsBackendService.guardarCredenciales(payload);
    if (resultado.success) {
      return res.json({ success: true, message: resultado.message });
    } else {
      return res.status(400).json({ success: false, error: resultado.message });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
