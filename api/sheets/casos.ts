import { setCORS, obtenerTodasLasFilas } from '../_sheetsHelper';

export default async function handler(req: any, res: any) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const casos = await obtenerTodasLasFilas();
    return res.status(200).json({
      success: true,
      total: casos.length,
      activos: casos.filter(c => c.esActivo).length,
      casos
    });
  } catch (err: any) {
    console.error('[API /api/sheets/casos] Error consultando Onboarding_New:', err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
