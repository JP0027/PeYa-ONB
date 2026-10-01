import express from 'express';
import { sheetsBackendService } from '../src/services/sheetsBackendService';

const app = express();

app.use(express.json({ limit: '15mb' }));

// Configurar CORS abierto para llamadas directas y proxies
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Endpoint de salud
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', server: 'vercel-serverless', timestamp: new Date().toISOString() });
});

// Estado de la conexión
app.get(['/api/sheets/status', '/sheets/status'], async (req, res) => {
  try {
    const creds = await sheetsBackendService.obtenerCredenciales();
    const info = sheetsBackendService.getDetallesCredenciales();
    const casosCache = sheetsBackendService.getCasosEnMemoria();
    const isConfigured = Boolean(creds) || casosCache.length > 0;

    res.json({
      configured: isConfigured,
      hasServiceAccount: Boolean(creds),
      email: creds?.client_email || info.email || null,
      cachedCasos: casosCache.length,
      fuente: creds ? 'Google Sheets API (Service Account)' : 'Offline / Cache'
    });
  } catch (err: any) {
    res.json({ configured: false, error: err.message });
  }
});

// Obtener casos en vivo desde hoja Onboarding_New
app.get(['/api/sheets/casos', '/sheets/casos'], async (req, res) => {
  try {
    console.log('[API /api/sheets/casos] Consultando casos...');
    const filas = await sheetsBackendService.obtenerTodasLasFilas();
    res.json({
      success: true,
      total: filas.length,
      activos: filas.filter(f => f.esActivo).length,
      casos: filas
    });
  } catch (err: any) {
    console.error('[API /api/sheets/casos] Error consultando Google Sheets:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Obtener lista de catálogos en vivo desde hoja Integraciones_Sponsorship
app.get(['/api/sheets/catalogos', '/sheets/catalogos'], async (req, res) => {
  try {
    console.log('[API /api/sheets/catalogos] Consultando catálogos...');
    const catalogos = await sheetsBackendService.obtenerCatalogosSheet();
    res.json({ success: true, catalogos });
  } catch (err: any) {
    console.error('[API /api/sheets/catalogos] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Actualizar o crear un caso directamente en Google Sheets
app.post(['/api/sheets/actualizar-caso', '/sheets/actualizar-caso'], async (req, res) => {
  try {
    const casoData = req.body;
    if (!casoData || (!casoData.id && !casoData.casoOp)) {
      return res.status(400).json({ success: false, error: 'Se requiere id o casoOp' });
    }
    const resultado = sheetsBackendService.actualizarCaso(casoData);

    let sheetsSincronizado = false;
    let gasMensaje = '';

    if (resultado.caso) {
      try {
        const syncRes = await sheetsBackendService.sincronizarCasoConGoogleSheets(resultado.caso);
        sheetsSincronizado = syncRes.success;
        gasMensaje = syncRes.success
          ? `Sincronizado exitosamente con Google Sheets (Fila #${syncRes.filaNumero})`
          : `Error al sincronizar con Sheets: ${syncRes.error}`;
      } catch (e: any) {
        gasMensaje = `Error al sincronizar con Service Account: ${e.message}`;
      }
    }

    res.json({
      ...resultado,
      sheetsSincronizado,
      gasMensaje
    });
  } catch (err: any) {
    console.error('[API /api/sheets/actualizar-caso] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Guardar sección del catálogo en hoja Integraciones_Sponsorship
app.post(['/api/sheets/catalogos/guardar-seccion', '/sheets/catalogos/guardar-seccion'], async (req, res) => {
  try {
    const { seccion, items } = req.body;
    if (!seccion || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Se requiere seccion y array de items' });
    }

    const resultado = await sheetsBackendService.guardarSeccionCatalogo(seccion, items);
    if (resultado.success) {
      const catalogosActualizados = await sheetsBackendService.obtenerCatalogosSheet();
      res.json({ success: true, message: resultado.message, catalogos: catalogosActualizados });
    } else {
      res.status(400).json({ success: false, error: resultado.message });
    }
  } catch (err: any) {
    console.error('[API /api/sheets/catalogos/guardar-seccion] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Registrar Push
app.post(['/api/sheets/registrar-push', '/sheets/registrar-push'], async (req, res) => {
  try {
    const { casoId, fecha, tipo } = req.body;
    if (!casoId) {
      return res.status(400).json({ success: false, error: 'Se requiere casoId' });
    }

    const resultado = await sheetsBackendService.registrarPush(casoId, tipo, fecha);
    if (resultado.success) {
      res.json(resultado);
    } else {
      res.status(404).json(resultado);
    }
  } catch (err: any) {
    console.error('[API /api/sheets/registrar-push] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Eliminar caso
app.post(['/api/sheets/eliminar-caso', '/sheets/eliminar-caso'], async (req, res) => {
  try {
    const { casoId, casoOp } = req.body;
    const target = casoId || casoOp;
    if (!target) {
      return res.status(400).json({ success: false, error: 'Se requiere casoId o casoOp para eliminar' });
    }

    const resultado = await sheetsBackendService.eliminarCaso(String(target));
    res.json(resultado);
  } catch (err: any) {
    console.error('[API /api/sheets/eliminar-caso] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Proxy seguro para fallback GAS / CSV
app.get(['/api/sheets/gas-proxy', '/sheets/gas-proxy'], async (req, res) => {
  try {
    const gasUrl = String(req.query.url || '').trim();
    if (!gasUrl || !gasUrl.startsWith('http')) {
      return res.status(400).json({ success: false, error: 'URL requerida' });
    }
    const resp = await fetch(gasUrl, { redirect: 'follow' });
    const text = await resp.text();
    res.send(text);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default app;
