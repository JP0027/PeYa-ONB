import express from 'express';
import { sheetsBackendService } from '../src/services/sheetsBackendService';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json({ limit: '15mb' }));

// Middleware de CORS y normalización de rutas para Vercel Serverless
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Sheets status
app.get('/api/sheets/status', (req, res) => {
  const info = sheetsBackendService.getDetallesCredenciales();
  const casosCache = sheetsBackendService.getCasosEnMemoria();
  const isConfigured = info.activa || casosCache.length > 0;
  res.json({
    configured: isConfigured,
    hasServiceAccount: info.activa,
    email: info.email || null,
    cachedCasos: casosCache.length,
    fuente: info.activa ? 'Google Sheets API (Service Account)' : (casosCache.length > 0 ? 'Cache / Sincronizado' : 'Sin conexión')
  });
});

// Import CSV
app.post('/api/sheets/import-csv', (req, res) => {
  try {
    const { csvText, origen } = req.body;
    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ success: false, error: 'Debe proporcionar el texto CSV en el campo csvText' });
    }
    const casos = sheetsBackendService.parsearCSV(csvText, origen || 'Archivo CSV importado');
    res.json({
      success: true,
      message: `Se importaron y procesaron ${casos.length} casos correctamente.`,
      total: casos.length,
      activos: casos.filter(c => c.esActivo).length,
      casos
    });
  } catch (err: any) {
    console.error('[API /api/sheets/import-csv] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PERMANENT_GAS_URL = process.env.VITE_GAS_WEBAPP_URL || 'https://script.google.com/a/macros/pedidosya.com/s/AKfycbwsLeUUnWvjWE4Qmt0z0eUHVxOSKzaSzj0hvHMDAjFy-TpQwTmM6pQir946DLDtWtdKRg/exec';

// Gas Proxy / Google Sheets URL fetch with robust cache fallback
app.get('/api/sheets/gas-proxy', async (req, res) => {
  try {
    let gasUrl = String(req.query.url || PERMANENT_GAS_URL).trim();
    if (!gasUrl || !gasUrl.startsWith('http')) {
      gasUrl = PERMANENT_GAS_URL;
    }
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
          if (!text.includes('accounts.google.com') && !text.includes('ServiceLogin')) {
            const casos = sheetsBackendService.parsearCSV(text, 'Google Sheet Enlace');
            if (casos.length > 0) {
              return res.json({
                success: true,
                message: `Se importaron ${casos.length} casos directamente desde Google Sheets.`,
                total: casos.length,
                activos: casos.filter(c => c.esActivo).length,
                casos
              });
            }
          }
        }
      } catch (e) {}
    }

    const casosCache = sheetsBackendService.getCasosEnMemoria();
    if (casosCache.length > 0) {
      return res.json({
        success: true,
        message: 'Devolviendo datos desde la caché sincronizada.',
        total: casosCache.length,
        activos: casosCache.filter(c => c.esActivo).length,
        casos: casosCache
      });
    }

    res.status(503).json({
      success: false,
      error: 'Google Apps Script o la hoja requiere autenticación corporativa. Usa la pestaña "Cargar CSV / Planilla".'
    });
  } catch (err: any) {
    const casosCache = sheetsBackendService.getCasosEnMemoria();
    if (casosCache.length > 0) {
      return res.json({
        success: true,
        total: casosCache.length,
        activos: casosCache.filter(c => c.esActivo).length,
        casos: casosCache
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Service Account
app.post('/api/sheets/service-account', (req, res) => {
  try {
    const payload = req.body;
    if (!payload) return res.status(400).json({ success: false, error: 'Cuerpo vacío' });
    const resultado = sheetsBackendService.guardarCredenciales(payload);
    res.json(resultado);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener casos (con fallback robusto a caché para NUNCA retornar 500)
app.get('/api/sheets/casos', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  try {
    const filas = await sheetsBackendService.obtenerTodasLasFilas();
    res.json({
      success: true,
      total: filas.length,
      activos: filas.filter(f => f.esActivo).length,
      casos: filas
    });
  } catch (err: any) {
    console.warn('[API /api/sheets/casos] Error consultando Google Sheets, usando caché:', err);
    const casosMemoria = sheetsBackendService.getCasosEnMemoria();
    res.json({
      success: true,
      total: casosMemoria.length,
      activos: casosMemoria.filter(f => f.esActivo).length,
      casos: casosMemoria,
      fuente: 'cache_fallback',
      warning: err.message
    });
  }
});

app.get('/api/sheets/sync-status', (_req, res) => {
  res.json({
    success: true,
    ultimoCambioTimestamp: sheetsBackendService.obtenerUltimoCambio(),
    totalCasos: sheetsBackendService.obtenerTotal()
  });
});

app.get('/api/sheets/conteo-filas', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  try {
    const conteo = await sheetsBackendService.detectarTotalFilasEnBase();
    res.json({ success: true, ...conteo });
  } catch (err: any) {
    const total = sheetsBackendService.obtenerTotal();
    res.json({ success: true, totalFilas: total + 2, totalCasos: total, proximaFilaNueva: total + 3 });
  }
});

app.post('/api/sheets/actualizar-caso', async (req, res) => {
  try {
    const casoData = req.body;
    if (!casoData || (!casoData.id && !casoData.casoOp)) {
      return res.status(400).json({ success: false, error: 'Se requiere id o casoOp' });
    }
    const resultado = sheetsBackendService.actualizarCaso(casoData);
    let sheetsSincronizado = false;
    let gasMensaje = 'Guardado en memoria y caché local';

    if (sheetsBackendService.tieneCredenciales() && resultado.caso) {
      try {
        const syncRes = await sheetsBackendService.sincronizarCasoConGoogleSheets(resultado.caso);
        sheetsSincronizado = syncRes.success;
        gasMensaje = syncRes.success ? `Sincronizado con Google Sheets (Fila #${syncRes.filaNumero})` : `Error Sheets: ${syncRes.error}`;
      } catch (e: any) {
        gasMensaje = `Error Service Account: ${e.message}`;
      }
    }

    res.json({
      ...resultado,
      sheetsSincronizado,
      gasMensaje
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const manejarCatalogos = async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  try {
    if (req.method === 'POST') {
      const { seccion, items } = req.body;
      if (seccion && Array.isArray(items)) {
        await sheetsBackendService.guardarSeccionCatalogo(seccion, items);
      }
    }
    const catalogos = await sheetsBackendService.obtenerCatalogosSheet();
    res.json({ success: true, catalogos });
  } catch (err: any) {
    res.json({
      success: true,
      catalogos: {
        paises: ['Argentina', 'Chile', 'Uruguay', 'Peru', 'Colombia', 'Bolivia'],
        oportunidades: ['Sponsorship', 'Expansion', 'Migracion'],
        assets: ['Market', 'Express', 'Supermarket'],
        estados: ['En progreso', 'Cerrado por Onb (Satisfactorio)', 'Cerrado por Kam (Fallido)'],
        etapas: ['Validación del Onboarding', 'Proceso de Seteo', 'Catálogo'],
        integraciones: []
      }
    });
  }
};

app.get('/api/sheets/catalogos', manejarCatalogos);
app.post('/api/sheets/catalogos', manejarCatalogos);
app.post('/api/sheets/catalogos/guardar-seccion', manejarCatalogos);

app.get('/api/sheets/integraciones', async (req, res) => {
  try {
    const cat = await sheetsBackendService.obtenerCatalogosSheet();
    res.json({ success: true, integraciones: cat.integraciones });
  } catch (err: any) {
    res.json({ success: true, integraciones: [] });
  }
});

app.post('/api/sheets/registrar-push', async (req, res) => {
  try {
    const { casoId, casoOp, fecha, tipo } = req.body;
    const targetId = casoOp || casoId;
    if (!targetId) return res.status(400).json({ success: false, error: 'Se requiere casoId o casoOp' });
    const resultado = await sheetsBackendService.registrarPush(targetId, tipo, fecha);
    res.json(resultado);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sheets/eliminar-caso', async (req, res) => {
  try {
    const { casoId, casoOp, filaNumero } = req.body;
    const target = casoId || casoOp;
    const resultado = await sheetsBackendService.eliminarCaso(target, typeof filaNumero === 'number' ? filaNumero : undefined);
    res.json(resultado);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin usuarios y roles
const USUARIOS_FILE = fs.existsSync('/tmp') ? path.join('/tmp', 'data_cached_usuarios.json') : path.resolve(process.cwd(), 'data_cached_usuarios.json');

const USUARIOS_INICIALES: Record<string, any> = {
  'kimberly.silvera_dyn.ext@pedidosya.com': { id: 'kimberly.silvera_dyn.ext@pedidosya.com', correo: 'kimberly.silvera_dyn.ext@pedidosya.com', nombre: 'Kimberly Silvera', rol: 'Supervisor / TL', pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'] },
  'henry.serrato_dyn.ext@pedidosya.com': { id: 'henry.serrato_dyn.ext@pedidosya.com', correo: 'henry.serrato_dyn.ext@pedidosya.com', nombre: 'Henry Serrato', rol: 'Supervisor / TL', pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'] },
  'joseline.yactayo_dyn.ext@pedidosya.com': { id: 'joseline.yactayo_dyn.ext@pedidosya.com', correo: 'joseline.yactayo_dyn.ext@pedidosya.com', nombre: 'Joseline Yactayo', rol: 'Supervisor / TL', pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'] },
  'yadira.flores_dyn.ext@pedidosya.com': { id: 'yadira.flores_dyn.ext@pedidosya.com', correo: 'yadira.flores_dyn.ext@pedidosya.com', nombre: 'Yadira Flores', rol: 'Supervisor / TL', pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'] },
  'yadirayajaida@gmail.com': { id: 'yadirayajaida@gmail.com', correo: 'yadirayajaida@gmail.com', nombre: 'Yadira Flores', rol: 'Supervisor / TL', pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'] },
  'joel.tocas_dyn.ext@pedidosya.com': { id: 'joel.tocas_dyn.ext@pedidosya.com', correo: 'joel.tocas_dyn.ext@pedidosya.com', nombre: 'Joel Tocas', rol: 'Agente', pestanas: ['admin', 'inicio', 'nuevo'] },
  'prisila.leon_dyn.ext@pedidosya.com': { id: 'prisila.leon_dyn.ext@pedidosya.com', correo: 'prisila.leon_dyn.ext@pedidosya.com', nombre: 'Prisila Leon', rol: 'Agente', pestanas: ['admin', 'inicio', 'nuevo'] },
  'jean.palomino_dyn.ext@pedidosya.com': { id: 'jean.palomino_dyn.ext@pedidosya.com', correo: 'jean.palomino_dyn.ext@pedidosya.com', nombre: 'Jean Palomino', rol: 'Agente', pestanas: ['admin', 'inicio', 'nuevo'] }
};

function leerUsuarios() {
  try {
    if (fs.existsSync(USUARIOS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(USUARIOS_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') return { ...USUARIOS_INICIALES, ...parsed };
    }
  } catch {}
  return { ...USUARIOS_INICIALES };
}

app.get('/api/admin/usuarios', (_req, res) => {
  const mapa = leerUsuarios();
  res.json({ success: true, usuarios: Object.values(mapa) });
});

app.post('/api/admin/usuarios', (req, res) => {
  try {
    const { correo, nombre, rol, pestanas } = req.body;
    const correoLimpio = String(correo || '').toLowerCase().trim();
    if (!correoLimpio) return res.status(400).json({ success: false, error: 'Correo obligatorio' });
    const mapa = leerUsuarios();
    const user = { id: correoLimpio, correo: correoLimpio, nombre: nombre || correoLimpio, rol: rol || 'Agente', pestanas: pestanas || ['admin', 'inicio', 'nuevo'] };
    mapa[correoLimpio] = user;
    try { fs.writeFileSync(USUARIOS_FILE, JSON.stringify(mapa, null, 2), 'utf-8'); } catch {}
    res.json({ success: true, usuario: user, usuarios: Object.values(mapa) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/usuarios/:correo', (req, res) => {
  try {
    const correo = decodeURIComponent(String(req.params.correo || '')).toLowerCase().trim();
    const mapa = leerUsuarios();
    if (mapa[correo]) delete mapa[correo];
    try { fs.writeFileSync(USUARIOS_FILE, JSON.stringify(mapa, null, 2), 'utf-8'); } catch {}
    res.json({ success: true, usuarios: Object.values(mapa) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/roles-catalogos', (_req, res) => {
  res.json({
    success: true,
    roles: ['Agente', 'Supervisor', 'Supervisor / TL'],
    pestanasPorRol: {
      'Agente': ['admin', 'inicio', 'nuevo'],
      'Supervisor': ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'],
      'Supervisor / TL': ['tl', 'admin', 'inicio', 'nuevo', 'usuarios']
    }
  });
});

app.post('/api/admin/roles-catalogos', (req, res) => {
  res.json({ success: true, ...req.body });
});

export default app;
