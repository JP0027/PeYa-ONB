import { sheetsBackendService } from '../../src/services/sheetsBackendService';

const PERMANENT_GAS_URL = process.env.VITE_GAS_WEBAPP_URL || 'https://script.google.com/a/macros/pedidosya.com/s/AKfycbwsLeUUnWvjWE4Qmt0z0eUHVxOSKzaSzj0hvHMDAjFy-TpQwTmM6pQir946DLDtWtdKRg/exec';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let gasUrl = String(req.query?.url || PERMANENT_GAS_URL).trim();
    if (!gasUrl || !gasUrl.startsWith('http')) {
      gasUrl = PERMANENT_GAS_URL;
    }

    // Si es enlace directo a Google Sheets
    if (gasUrl.includes('docs.google.com/spreadsheets')) {
      let csvExportUrl = gasUrl;
      if (gasUrl.includes('/pub') || gasUrl.includes('/pubhtml')) {
        csvExportUrl = gasUrl.replace(/\/pubhtml|\/pub/, '/pub');
        if (csvExportUrl.includes('?')) {
          csvExportUrl = csvExportUrl.replace(/output=[a-z]+/, 'output=csv');
          if (!csvExportUrl.includes('output=csv')) csvExportUrl += '&output=csv';
        } else {
          csvExportUrl += '?output=csv';
        }
      } else if (gasUrl.includes('/d/')) {
        const match = gasUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const gidMatch = gasUrl.match(/gid=([0-9]+)/);
        if (match && match[1]) {
          const sheetId = match[1];
          const gid = gidMatch ? gidMatch[1] : '0';
          csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
        }
      }

      try {
        const resp = await fetch(csvExportUrl, { redirect: 'follow' });
        if (resp.ok) {
          const text = await resp.text();
          if (text.includes('accounts.google.com') || text.includes('ServiceLogin')) {
            return res.status(401).json({
              success: false,
              error: 'El documento requiere inicio de sesión corporativo.'
            });
          }
          const casos = sheetsBackendService.parsearCSV(text, 'Google Sheet Enlace');
          if (casos.length > 0) {
            return res.json({
              success: true,
              message: `Se importaron ${casos.length} casos.`,
              total: casos.length,
              activos: casos.filter(c => c.esActivo).length,
              casos
            });
          }
        }
      } catch (csvErr: any) {
        console.warn('[gas-proxy] CSV export error:', csvErr);
      }
    }

    let targetUrl = gasUrl;
    if (gasUrl.includes('/a/macros/')) {
      targetUrl = gasUrl.replace(/\/a\/macros\/[^/]+\/s\//, '/macros/s/');
    }

    const separator = targetUrl.includes('?') ? '&' : '?';
    const endpoint = `${targetUrl}${separator}action=getCasos&sheet=Onboarding&t=${Date.now()}`;

    let response = await fetch(endpoint, {
      headers: { 'Accept': 'application/json, text/plain, */*' },
      redirect: 'follow'
    });

    if (!response.ok && targetUrl !== gasUrl) {
      const sepOrig = gasUrl.includes('?') ? '&' : '?';
      response = await fetch(`${gasUrl}${sepOrig}action=getCasos&sheet=Onboarding&t=${Date.now()}`, {
        headers: { 'Accept': 'application/json, text/plain, */*' },
        redirect: 'follow'
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `Google Apps Script error HTTP ${response.status}`
      });
    }

    const rawText = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return res.status(502).json({
        success: false,
        error: 'La respuesta de Apps Script no es JSON válido.'
      });
    }

    let listaFilas: any[] = [];
    if (Array.isArray(data)) listaFilas = data;
    else if (Array.isArray(data.casos)) listaFilas = data.casos;
    else if (Array.isArray(data.data)) listaFilas = data.data;

    const casosParseados = Array.isArray(listaFilas[0])
      ? sheetsBackendService.parsearFilasDinamicas(listaFilas, 'Google Apps Script')
      : listaFilas;

    return res.json({
      success: true,
      total: casosParseados.length,
      activos: casosParseados.filter(c => c.esActivo).length,
      casos: casosParseados
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
