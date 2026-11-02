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

    const lines = csvText.split(/\r?\n/).map(l => l.split(/,|\t/));
    const casos: any[] = [];
    if (lines.length > 1) {
      const headers = lines[0].map(h => String(h || '').trim());
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        if (!row || row.length === 0) continue;
        const casoOp = String(row[0] || '').trim();
        const vendorId = String(row[1] || '').trim();
        const tienda = String(row[2] || '').trim();
        if (!casoOp && !vendorId && !tienda) continue;
        const estado = String(row[14] || 'En progreso').trim();
        casos.push({
          id: casoOp || vendorId || `CSV-${i}`,
          casoOp,
          vendorId,
          vendor_id: vendorId,
          tienda,
          pais: String(row[3] || 'Argentina').trim(),
          kam: String(row[4] || '').trim(),
          integracion: String(row[5] || '').trim(),
          estado,
          etapa: String(row[15] || 'Validación del Onboarding').trim(),
          esActivo: !estado.toLowerCase().includes('cerrad') && !estado.toLowerCase().includes('fallid'),
          origen: origen || 'Archivo CSV importado',
          filaNumero: i + 1
        });
      }
    }

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
