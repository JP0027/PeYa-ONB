import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { sheetsBackendService } from './src/services/sheetsBackendService';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '15mb' }));

  // Endpoint de salud y diagnóstico
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Estado de la conexión con Google Sheets
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

  // Importar directamente archivo CSV de Google Sheets
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

  // Proxy seguro para consultar Google Apps Script Web App o enlaces de Google Sheets
  app.get('/api/sheets/gas-proxy', async (req, res) => {
    try {
      let gasUrl = String(req.query.url || PERMANENT_GAS_URL).trim();
      if (!gasUrl || !gasUrl.startsWith('http')) {
        gasUrl = PERMANENT_GAS_URL;
      }

      // Si es un enlace directo a Google Sheets (docs.google.com)
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
                error: 'El documento requiere inicio de sesión corporativo. Por favor descárgalo como .csv y súbelo en la pestaña "2. Cargar CSV / Planilla".'
              });
            }
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
        } catch (csvErr: any) {
          console.warn('[gas-proxy] Error al intentar exportar CSV de Google Sheets:', csvErr);
        }
      }

      // Normalizar URLs internas de dominio /a/macros/pedidosya.com/s/ a /macros/s/
      let targetUrl = gasUrl;
      const esDominioPedidosYa = gasUrl.includes('pedidosya.com') || gasUrl.includes('/a/macros/');
      if (gasUrl.includes('/a/macros/')) {
        targetUrl = gasUrl.replace(/\/a\/macros\/[^/]+\/s\//, '/macros/s/');
      }

      console.log(`[API /api/sheets/gas-proxy] Consultando Web App: ${targetUrl}`);
      const separator = targetUrl.includes('?') ? '&' : '?';
      const endpoint = `${targetUrl}${separator}action=getCasos&sheet=Onboarding&t=${Date.now()}`;

      let response = await fetch(endpoint, {
        headers: { 'Accept': 'application/json, text/plain, */*' },
        redirect: 'follow'
      });

      // Si falló con la normalizada, reintentar con la original
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
          error: `Google Apps Script respondió con error HTTP ${response.status}: ${response.statusText}`
        });
      }

      const rawText = await response.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        // Detectar si Google devolvió pantalla de login corporativo
        const esGoogleLogin = rawText.includes('accounts.google.com') || 
                              rawText.includes('ServiceLogin') || 
                              rawText.includes('AccountChooser') ||
                              rawText.includes('Sign in - Google Accounts');

        if (esGoogleLogin) {
          return res.status(401).json({
            success: false,
            esDominioCorporativo: esDominioPedidosYa,
            error: 'Google Apps Script solicita inicio de sesión porque la Web App pertenece al dominio corporativo (@pedidosya.com) o su acceso está restringido.',
            detalles: esDominioPedidosYa
              ? 'Dar acceso a tu cuenta personal en Google Drive da permiso al archivo, pero la Web App de Apps Script fue creada bajo el dominio @pedidosya.com y Google bloquea peticiones anónimas externas. Solución más rápida: pestaña "2. Cargar CSV / Planilla" (Descargar CSV desde tu Google Sheet y soltarlo aquí).'
              : 'En tu Google Sheet ve a Extensiones > Apps Script > Implementar > Gestionar implementaciones > Editar > Cambia "Quién tiene acceso" a "Cualquier usuario" (Anyone).'
          });
        }

        return res.status(502).json({
          success: false,
          error: 'La respuesta de Google Apps Script no es un JSON válido. Asegúrate de que la Web App devuelva ContentService.createTextOutput(...) y tenga acceso "Cualquier usuario".',
          rawPreview: rawText.slice(0, 300)
        });
      }

      // Normalizar estructura si viene en { casos: [...] } o { data: [...] } o directo [...]
      let listaFilas: any[] = [];
      if (Array.isArray(data)) {
        listaFilas = data;
      } else if (Array.isArray(data.casos)) {
        listaFilas = data.casos;
      } else if (Array.isArray(data.data)) {
        listaFilas = data.data;
      }

      if (listaFilas.length === 0) {
        return res.json({
          success: true,
          message: 'Se conectó con el script pero no devolvió filas de casos.',
          total: 0,
          activos: 0,
          casos: []
        });
      }

      // Si la primera fila es un array (matriz 2D), usar parsearFilasDinamicas
      let casosParseados: any[] = [];
      if (Array.isArray(listaFilas[0])) {
        casosParseados = sheetsBackendService.parsearFilasDinamicas(listaFilas, 'Google Apps Script');
      } else {
        // Son objetos con nombres de campos
        casosParseados = listaFilas.map((fila, idx) => {
          const casoOp = String(fila["N° Caso OP"] || fila["casoOp"] || fila["Caso OP"] || '');
          const vendorId = String(fila["ID"] || fila["vendorId"] || fila["vendor_id"] || '');
          const estado = String(fila["Estado del caso"] || fila["estado"] || 'En progreso');
          const estadoLower = estado.toLowerCase();
          const esCerrado = estadoLower.includes('cerrado') || estadoLower.includes('fallido');
          const esActivo = !esCerrado && (estadoLower.includes('en progreso') || estadoLower.includes('nuevo') || estadoLower.includes('ticket hc'));

          return {
            id: casoOp || vendorId || `GAS-${idx + 1}`,
            casoOp,
            vendorId,
            vendor_id: vendorId,
            tienda: String(fila["Tienda"] || fila["tienda"] || ''),
            pais: String(fila["País"] || fila["pais"] || ''),
            kam: String(fila["Kam"] || fila["kam"] || ''),
            integracion: String(fila["Integración"] || fila["integracion"] || ''),
            oportunidad: String(fila["Oportunidad"] || fila["oportunidad"] || ''),
            asset: String(fila["Asset"] || fila["asset"] || ''),
            casoSeguimiento: String(fila["N° Caso Seguimiento"] || fila["casoSeguimiento"] || ''),
            propietarioOportunidad: String(fila["Propietario Oportunidad"] || fila["propietarioOportunidad"] || ''),
            propietarioTicket: String(fila["Propietario de Ticket HeroCare"] || fila["propietarioTicket"] || fila["agente"] || ''),
            agente: String(fila["Propietario de Ticket HeroCare"] || fila["agente"] || fila["propietarioOportunidad"] || 'Sin asignación'),
            tieneCasoInicio: String(fila["¿Tiene caso de onboarding inicial?"] || fila["tieneCasoInicio"] || 'Si'),
            comentarios: String(fila["Comentarios del Onboarding"] || fila["comentarios"] || ''),
            fechaCreacion: String(fila["Fecha de creación de la OP"] || fila["fechaCreacion"] || ''),
            estado,
            etapa: String(fila["Etapa del onboarding"] || fila["etapa"] || 'Validación del Onboarding'),
            sla_inicio: String(fila["Fecha de inicio de seguimiento de OP"] || fila["sla_inicio"] || new Date().toISOString()),
            esActivo,
            origen: 'Google Apps Script',
            filaNumero: fila.filaNumero || idx + 2
          };
        });
      }

      // Guardar en la cache del servidor para persistencia
      sheetsBackendService.guardarCasosCache(casosParseados);

      res.json({
        success: true,
        total: casosParseados.length,
        activos: casosParseados.filter(c => c.esActivo).length,
        casos: casosParseados
      });
    } catch (err: any) {
      console.error('[API /api/sheets/gas-proxy] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Inyección o guardado seguro de service-account.json
  app.post('/api/sheets/service-account', (req, res) => {
    try {
      const payload = req.body;
      if (!payload) {
        return res.status(400).json({ success: false, error: 'Cuerpo de solicitud vacío' });
      }
      const resultado = sheetsBackendService.guardarCredenciales(payload);
      if (resultado.success) {
        res.json({ success: true, message: resultado.message });
      } else {
        res.status(400).json({ success: false, error: resultado.message });
      }
    } catch (err: any) {
      console.error('[API /api/sheets/service-account] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Consulta de filas reales de Onboarding_New!A3:AZ
  app.get('/api/sheets/casos', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
      const tieneCreds = sheetsBackendService.tieneCredenciales();
      const casosMemoria = sheetsBackendService.getCasosEnMemoria();

      if (!tieneCreds && casosMemoria.length === 0) {
        return res.status(503).json({
          success: false,
          error: 'No se ha detectado conexión activa con Google Sheets ni datos en caché.',
          needsServiceAccount: true
        });
      }

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

  // Estado de sincronización en tiempo real para clientes simultáneos
  app.get('/api/sheets/sync-status', (_req, res) => {
    res.json({
      success: true,
      ultimoCambioTimestamp: sheetsBackendService.obtenerUltimoCambio(),
      totalCasos: sheetsBackendService.obtenerTotal()
    });
  });

  // Actualización o creación de caso sin duplicar registro
  app.post('/api/sheets/actualizar-caso', async (req, res) => {
    try {
      const casoData = req.body;
      if (!casoData || (!casoData.id && !casoData.casoOp)) {
        return res.status(400).json({ success: false, error: 'Se requiere id o casoOp' });
      }
      const resultado = sheetsBackendService.actualizarCaso(casoData);

      let sheetsSincronizado = false;
      let gasMensaje = '';

      if (sheetsBackendService.tieneCredenciales() && resultado.caso) {
        try {
          const syncRes = await sheetsBackendService.sincronizarCasoConGoogleSheets(resultado.caso);
          sheetsSincronizado = syncRes.success;
          if (syncRes.success) {
            gasMensaje = `Sincronizado exitosamente con Google Sheets (Fila #${syncRes.filaNumero})`;
          } else {
            gasMensaje = `Error al sincronizar con Sheets: ${syncRes.error}`;
          }
        } catch (e: any) {
          gasMensaje = `Error al sincronizar con Service Account: ${e.message}`;
        }
      } else {
        gasMensaje = 'No hay Service Account conectada a Google Sheets.';
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

  // Obtener lista completa de catálogos desde hoja Integraciones_Sponsorship
  app.get('/api/sheets/catalogos', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
      const catalogos = await sheetsBackendService.obtenerCatalogosSheet();
      res.json({ success: true, catalogos });
    } catch (err: any) {
      console.error('[API /api/sheets/catalogos] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Guardar columna/sección del catálogo en hoja Integraciones_Sponsorship
  app.post('/api/sheets/catalogos/guardar-seccion', async (req, res) => {
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

  // Obtener lista de integraciones de Sponsorship (retrocompatibilidad)
  app.get('/api/sheets/integraciones', async (req, res) => {
    try {
      const cat = await sheetsBackendService.obtenerCatalogosSheet();
      res.json({ success: true, integraciones: cat.integraciones });
    } catch (err: any) {
      console.error('[API /api/sheets/integraciones] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Registrar Push
  app.post('/api/sheets/registrar-push', async (req, res) => {
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

  // Eliminar Caso de Sheets y Cache
  app.post('/api/sheets/eliminar-caso', async (req, res) => {
    try {
      const { casoId, casoOp, filaNumero } = req.body;
      const target = casoId || casoOp;
      if (!target && !filaNumero) {
        return res.status(400).json({ success: false, error: 'Se requiere casoId, casoOp o filaNumero' });
      }

      const resultado = await sheetsBackendService.eliminarCaso(target, typeof filaNumero === 'number' ? filaNumero : undefined);
      res.json(resultado);
    } catch (err: any) {
      console.error('[API /api/sheets/eliminar-caso] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Montar Vite middleware para desarrollo o archivos estáticos en producción
  const distPath = path.resolve(process.cwd(), 'dist');
  const indexHtmlPath = path.resolve(distPath, 'index.html');
  let distExiste = fs.existsSync(indexHtmlPath);

  // Si estamos en producción pero no se compiló dist/ (ej: si Render ejecutó solo 'npm install'),
  // compilarlo automáticamente para evitar que el servidor falle al servir la app.
  if (!distExiste && process.env.VITE_DEV !== 'true') {
    console.log('[Server] dist/index.html no encontrado. Iniciando compilación automática con Vite...');
    try {
      const { execSync } = await import('child_process');
      execSync('npx vite build', { stdio: 'inherit' });
      distExiste = fs.existsSync(indexHtmlPath);
      if (distExiste) {
        console.log('[Server] Compilación automática de dist/ completada con éxito.');
      }
    } catch (buildErr: any) {
      console.warn('[Server] No se pudo compilar dist automáticamente:', buildErr?.message);
    }
  }

  if (distExiste && process.env.VITE_DEV !== 'true') {
    console.log('[Server] Sirviendo frontend estático desde dist/');
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(indexHtmlPath);
    });
  } else {
    // Si estamos en desarrollo forzado o como fallback si no existe dist, Vite maneja el bundling
    console.log('[Server] Iniciando Vite middleware dinámico...');
    try {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          watch: {
            ignored: [
              '**/data_cached_casos.json',
              '**/*.json',
              '**/scratch/**',
              '**/.git/**',
              '**/dist/**'
            ]
          }
        },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } catch (viteErr: any) {
      console.error('[Server] Error iniciando Vite middleware:', viteErr);
      app.use((req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.status(500).send(`
          <html>
            <body style="background:#0f111a;color:#fff;font-family:sans-serif;padding:40px;text-align:center;">
              <h2 style="color:#f43f5e;">Compilación frontend requerida</h2>
              <p>El directorio <code>dist/index.html</code> no fue encontrado y la compilación falló.</p>
              <p>Por favor asegúrate de configurar el <b>Build Command</b> en Render como: <br><code style="background:#1e293b;padding:4px 8px;border-radius:4px;margin-top:8px;display:inline-block;">npm install && npm run build</code></p>
            </body>
          </html>
        `);
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Express + Vite] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Error fatal al iniciar servidor:', err);
  process.exit(1);
});
