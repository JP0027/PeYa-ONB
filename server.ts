import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { sheetsBackendService } from './src/services/sheetsBackendService.js';

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

      // Si existe una URL de Google Apps Script configurada, reenviar la mutación directamente al Google Sheet
      const gasUrl = (casoData._gasUrl || req.headers['x-gas-url'] || PERMANENT_GAS_URL).toString().trim();
      let sheetsSincronizado = false;
      let gasMensaje = '';

      if (gasUrl && gasUrl.startsWith('http')) {
        let targetUrl = gasUrl;
        if (gasUrl.includes('/a/macros/')) {
          targetUrl = gasUrl.replace(/\/a\/macros\/[^/]+\/s\//, '/macros/s/');
        }
        try {
          const r = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(casoData)
          });
          const respTxt = await r.text();
          if (r.ok && !respTxt.includes('ServiceLogin') && !respTxt.includes('accounts.google.com')) {
            sheetsSincronizado = true;
            gasMensaje = 'Sincronizado con Google Sheets';
          } else {
            gasMensaje = 'Google Apps Script rechazó la conexión (requiere inicio de sesión de PedidosYa o permisos corporativos).';
            console.warn(`[actualizar-caso] GAS bloqueado por login: ${respTxt.slice(0, 120)}`);
          }
        } catch (e: any) {
          gasMensaje = `Error al conectar con Google Apps Script: ${e.message}`;
          console.warn('[actualizar-caso] Error reenviando a GAS:', e.message);
        }
      } else {
        gasMensaje = 'No hay Web App o Service Account conectada a Google Sheets.';
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

  // Montar Vite middleware para desarrollo o archivos estáticos en producción
  const distPath = path.resolve(process.cwd(), 'dist');
  const indexHtmlPath = path.resolve(distPath, 'index.html');
  const distExiste = fs.existsSync(indexHtmlPath);

  if (process.env.NODE_ENV === 'production' && distExiste) {
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(indexHtmlPath);
    });
  } else {
    // Si estamos en desarrollo o aún no se compila dist, Vite maneja el bundling
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Express + Vite] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Error fatal al iniciar servidor:', err);
  process.exit(1);
});
