import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const payload = req.body;
    if (!payload) {
      return res.status(400).json({ success: false, error: 'Cuerpo de solicitud vacío' });
    }
    return res.status(200).json({
      success: true,
      message: 'Credenciales procesadas correctamente.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
