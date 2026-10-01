import { setCORS, obtenerCatalogosSheet } from '../_sheetsHelper';

export default async function handler(req: any, res: any) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const catalogos = await obtenerCatalogosSheet();
    return res.status(200).json({
      success: true,
      catalogos
    });
  } catch (err: any) {
    console.error('[API /api/sheets/catalogos] Error consultando Integraciones_Sponsorship:', err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
