async function fetchConReintento(url: string, options: RequestInit, maxReintentos: number = 4): Promise<Response> {
  let ultimoError: any = null;
  for (let intento = 0; intento < maxReintentos; intento++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || res.status >= 500) {
        const esperaMs = (800 * Math.pow(2, intento)) + Math.floor(Math.random() * 300);
        await new Promise(r => setTimeout(r, esperaMs));
        continue;
      }
      return res;
    } catch (err: any) {
      ultimoError = err;
      const esperaMs = (800 * Math.pow(2, intento)) + Math.floor(Math.random() * 300);
      if (intento === maxReintentos - 1) throw err;
      await new Promise(r => setTimeout(r, esperaMs));
    }
  }
  throw ultimoError || new Error('Google Sheets API request failed');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido, use POST' });
  }

  try {
    const { casoId, casoOp, filaNumero } = req.body || {};
    const target = String(casoOp || casoId || '').trim();

    if (!target && !filaNumero) {
      return res.status(400).json({ success: false, error: 'Se requiere casoId, casoOp o filaNumero' });
    }

    const token = await getToken();
    let filaTarget = typeof filaNumero === 'number' && filaNumero >= 3 ? filaNumero : 0;

    // 1. Si tenemos filaNumero, verificar que la fila corresponda a este caso
    if (filaTarget >= 3 && target) {
      const urlCheck = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'Onboarding_New'!A${filaTarget}:B${filaTarget}?valueRenderOption=FORMATTED_VALUE`;
      const resCheck = await fetchConReintento(urlCheck, {
        headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' }
      });
        if (resCheck.ok) {
          const dataCheck = await resCheck.json();
          const row = dataCheck.values?.[0] || [];
          const opVal = String(row[0] || '').trim();
          const venVal = String(row[1] || '').trim();
          if (opVal !== target && venVal !== target && !target.includes(opVal)) {
            filaTarget = 0;
          }
        }
      }

      // 2. Si no sabemos la fila exacta o se movió, buscarla en 'Onboarding_New'!A2:B
      if (!filaTarget || filaTarget < 3) {
        const urlCols = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'Onboarding_New'!A2:B?valueRenderOption=FORMATTED_VALUE`;
        const resCols = await fetchConReintento(urlCols, {
          headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' }
        });

        if (resCols.ok) {
          const dataCols = await resCols.json();
          const rows = dataCols.values || [];
          for (let i = 0; i < rows.length; i++) {
            const op = String(rows[i]?.[0] || '').trim();
            const ven = String(rows[i]?.[1] || '').trim();
            if (
              (op && (op === target || target.startsWith(op + '_'))) ||
              (ven && (ven === target || target.startsWith(ven + '_')))
            ) {
              filaTarget = i + 2;
              break;
            }
          }
        }
      }

      if (!filaTarget || filaTarget < 3) {
        return res.status(404).json({
          success: false,
          error: `No se encontró la fila correspondiente al caso ${target} en Google Sheets.`
        });
      }

      // 3. Ejecutar eliminación de la fila en Google Sheets
      const urlBatch = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`;
      const resBatch = await fetchConReintento(urlBatch, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: SHEET_GID_ONBOARDING_NEW,
                  dimension: 'ROWS',
                  startIndex: filaTarget - 1,
                  endIndex: filaTarget
                }
              }
            }
          ]
        })
      });

      if (!resBatch.ok) {
        const errText = await resBatch.text();
        return res.status(resBatch.status).json({
          success: false,
          error: `Error al eliminar en Google Sheets: ${errText}`
        });
      }

      return res.status(200).json({
        success: true,
        message: `Fila ${filaTarget} eliminada correctamente de Google Sheets`,
        filaEliminada: filaTarget,
        casoOp: target
      });
  } catch (err: any) {
    console.error('Error en /api/sheets/eliminar-caso:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
