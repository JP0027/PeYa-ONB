/**
 * Servicio para consultar y sincronizar data directamente desde Google Sheets.
 * Conecta con el endpoint del servidor /api/sheets/casos respaldado por la Cuenta de Servicio,
 * y con fallback a Google Apps Script si está configurado.
 */

export async function verificarEstadoCuentaServicio() {
  try {
    const res = await fetch('/api/sheets/status');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[GoogleSheets] Error verificando estado de cuenta de servicio:', err);
  }
  return { configured: false, email: null, file: null };
}

export async function guardarCuentaServicio(contenidoJson) {
  const res = await fetch('/api/sheets/service-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: typeof contenidoJson === 'string' ? contenidoJson : JSON.stringify(contenidoJson)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al guardar service-account.json');
  }
  return data;
}

export const DEFAULT_GAS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTVWtPU_-CvljcleGC019N_2oppauMInZhDGr5qap7peyZGR_8N6wHrf9T8SswI5bJGm7DJNsSfoX02/pub?gid=104076048&single=true&output=csv';

export function obtenerGasUrl() {
  const guardada = localStorage.getItem('PEDA_GAS_URL');
  if (!guardada || guardada.includes('AKfycbwSon9BeerNaPPqbd1wvCRxorbiWJzo-aHiyNkINbj2BKu8K7iFTh7LltfsaRiKb5P78g')) {
    localStorage.setItem('PEDA_GAS_URL', DEFAULT_GAS_URL);
    return DEFAULT_GAS_URL;
  }
  return guardada;
}

export function guardarGasUrl(url) {
  if (!url) {
    localStorage.removeItem('PEDA_GAS_URL');
  } else {
    localStorage.setItem('PEDA_GAS_URL', url.trim());
  }
}

/**
 * Código estándar y probado para colocar en Extensiones > Apps Script del archivo Google Sheets
 * Conserva la lógica de onEdit (regla de 96h, fecha de cierre y comentarios automáticos)
 * y añade doGet y doPost para sincronización bidireccional en tiempo real con PeYa ONB.
 */
export const APPS_SCRIPT_TEMPLATE = `/**
 * Google Apps Script para PeYa ONB (PedidosYa) - Hoja: Onboarding
 * Integra:
 * 1. onEdit(e): Automatización de comentarios y fecha de cierre por edición manual en Sheets.
 * 2. doGet(e): Lectura en tiempo real de todos los casos desde PeYa ONB.
 * 3. doPost(e): Actualización y creación de casos en tiempo real desde PeYa ONB.
 */

// --- CONFIGURACIÓN DE COLUMNAS (Coincide con la hoja Onboarding) ---
const START_ROW = 6;       // Fila donde inician los datos (fila 5 son los títulos)
const COL_ENVIO = 6;       // Columna F (6): Fecha de Envío
const COL_CIERRE = 7;      // Columna G (7): Fecha de Cierre
const COL_STATUS = 19;     // Columna S (19): Estado del onboarding
const COL_COMENTARIO = 20; // Columna T (20): Detalle / Comentario del onboarding
const COL_ESTADO = 21;     // Columna U (21): Estado del caso ("En progreso", "Nuevo", "Fallido", etc.)

// --- MAPA DE COMENTARIOS AUTOMÁTICOS ---
const comentariosMap = { 
  "Sin integración confirmada": "Se envió el correo al ejecutivo comercial y Partner para que nos indiquen con cuál integración trabajarían.",
  "En proceso de seteo": "Se envió el correo a la integración con copia al ejecutivo comercial y Partner, con los datos para configurar (Chain ID y Remote ID); esperamos la confirmación por parte de la integración para proceder con el seteo.",
  "En proceso de carga de catálogo": "Estamos a la espera de que el equipo de integración confirme la carga del menú (si gestiona catálogo de manera individual), nos indique el menú a unificar (si gestiona catálogo de manera unificada) o realice el envío de archivos codificados (si no gestiona catálogo) para poder programar el pedido de prueba.",
  "En proceso para pruebas": "Se verifica que el perfil cuenta con catálogo integrado. Se propone realizar las pruebas dos horas después de la hora actual del caso, asegurando que se encuentre dentro del horario operativo del partner.",
  "Pedido de prueba realizado": "Se realizó el envío de la prueba correctamente y se finalizó el proceso de onboarding.",
  "Fallido": "Se cierra como Fallido debido a la falta de respuesta del equipo de integración para continuar con el proceso. Por proceso, la OP se cierra después de 96 horas de inactividad."
};

/**
 * 1. EVENTO ONEDIT (Para ediciones directas en la hoja de cálculo de Google Sheets)
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  if (sheetName !== "Onboarding" && sheetName !== "Onboarding_New") return;

  const row = range.getRow();
  const col = range.getColumn();

  if (row < START_ROW) return;

  // Actualizar comentario automático
  if (col === COL_STATUS || col === COL_ESTADO) {
    const estadoCasoVal = sheet.getRange(row, COL_ESTADO).getValue().toString().trim().toLowerCase();
    let comentario = "";

    if (estadoCasoVal === "fallido") {
      comentario = comentariosMap["Fallido"] || "";
    } else {
      const estadoOnboarding = sheet.getRange(row, COL_STATUS).getValue().toString().trim();
      comentario = comentariosMap[estadoOnboarding] || "";
    }

    if (comentario) {
      sheet.getRange(row, COL_COMENTARIO).setValue(comentario);
    }
  }

  // Actualizar fecha de cierre al cambiar de estado
  if (col === COL_ESTADO) {
    const filaInicio = Math.max(row, START_ROW);
    const numFilas = range.getLastRow() - filaInicio + 1;
    if (numFilas <= 0) return;

    const datos = sheet.getRange(filaInicio, COL_ENVIO, numFilas, 16).getValues();
    const hoy = new Date();
    const estadosAbiertos = new Set(["En progreso", "Nuevo", "en progreso", "nuevo", ""]);
    
    const nuevosValores = datos.map(function(fila) {
      const fechaEnvio = fila[0];
      const fechaCierre = fila[1];
      const estado = String(fila[15] || "").trim();

      if (!(fechaEnvio instanceof Date)) return [fechaCierre];
      if (estadosAbiertos.has(estado)) return ["-"];

      return [(fechaCierre instanceof Date) ? fechaCierre : hoy];
    });

    sheet.getRange(filaInicio, COL_CIERRE, numFilas, 1).setValues(nuevosValores);
  }
}

/**
 * 2. ENDPOINT DOGET (Para lectura en tiempo real desde la plataforma PeYa ONB)
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Onboarding") || ss.getSheetByName("Onboarding_New") || ss.getActiveSheet();
    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(sheet.getLastColumn(), 25);
    
    if (lastRow < START_ROW) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, total: 0, casos: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Leer encabezados de la fila 5 (o anterior)
    const headerRowIdx = START_ROW - 1; // Fila 5
    const headers = sheet.getRange(headerRowIdx, 1, 1, lastCol).getValues()[0].map(function(h) {
      return String(h || "").trim();
    });

    // Leer todas las filas de datos desde START_ROW
    const numDatos = lastRow - START_ROW + 1;
    const data = sheet.getRange(START_ROW, 1, numDatos, lastCol).getValues();

    const casos = [];
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var filaNum = START_ROW + i;
      
      var casoOp = String(row[0] || "").trim(); // Col A
      var vendorId = String(row[1] || "").trim(); // Col B
      var tienda = String(row[2] || "").trim(); // Col C
      
      // Si la fila está vacía, continuar
      if (!casoOp && !vendorId && !tienda) continue;

      var fechaEnvio = row[COL_ENVIO - 1];
      var fechaCierre = row[COL_CIERRE - 1];
      var statusOnb = String(row[COL_STATUS - 1] || "").trim();
      var comentarios = String(row[COL_COMENTARIO - 1] || "").trim();
      var estado = String(row[COL_ESTADO - 1] || "En progreso").trim();

      // Formatear fechas legibles
      var fechaEnvioStr = (fechaEnvio instanceof Date) ? Utilities.formatDate(fechaEnvio, "GMT-3", "yyyy-MM-dd HH:mm") : String(fechaEnvio || "");
      var fechaCierreStr = (fechaCierre instanceof Date) ? Utilities.formatDate(fechaCierre, "GMT-3", "yyyy-MM-dd HH:mm") : String(fechaCierre || "-");

      var item = {
        filaNumero: filaNum,
        id: casoOp || vendorId || ("CASO-" + filaNum),
        casoOp: casoOp,
        vendorId: vendorId,
        vendor_id: vendorId,
        tienda: tienda,
        pais: String(row[3] || "").trim(),
        kam: String(row[4] || "").trim(),
        fechaEnvio: fechaEnvioStr,
        fechaCierre: fechaCierreStr,
        integracion: String(row[7] || "").trim(),
        propietarioOportunidad: String(row[8] || "").trim(),
        propietarioTicket: String(row[9] || "").trim(),
        agente: String(row[9] || row[8] || "Sin asignar").trim(),
        etapa: statusOnb || "Validación del Onboarding",
        statusOnboarding: statusOnb,
        comentarios: comentarios,
        estado: estado,
        esActivo: !estado.toLowerCase().includes("cerrado") && !estado.toLowerCase().includes("fallido")
      };

      // Incluir todos los encabezados adicionales mapeados dinámicamente
      headers.forEach(function(h, cIdx) {
        if (h && item[h] === undefined) {
          var val = row[cIdx];
          item[h] = (val instanceof Date) ? Utilities.formatDate(val, "GMT-3", "yyyy-MM-dd HH:mm") : String(val || "");
        }
      });

      casos.push(item);
    }

    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      total: casos.length, 
      hoja: sheet.getName(),
      casos: casos 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 3. ENDPOINT DOPOST (Para guardar modificaciones y nuevos casos desde PeYa ONB)
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Onboarding") || ss.getSheetByName("Onboarding_New") || ss.getActiveSheet();
    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(sheet.getLastColumn(), 25);
    
    const casoOpBuscado = String(payload.casoOp || payload.id || "").trim();
    const vendorBuscado = String(payload.vendorId || payload.vendor_id || "").trim();

    let filaEncontrada = -1;

    // Buscar si ya existe por Caso OP (Columna A) o Vendor ID (Columna B)
    if (lastRow >= START_ROW) {
      const idsData = sheet.getRange(START_ROW, 1, lastRow - START_ROW + 1, 2).getValues();
      for (let i = 0; i < idsData.length; i++) {
        const cOp = String(idsData[i][0] || "").trim();
        const vId = String(idsData[i][1] || "").trim();
        if ((casoOpBuscado && cOp === casoOpBuscado) || (vendorBuscado && vId === vendorBuscado)) {
          filaEncontrada = START_ROW + i;
          break;
        }
      }
    }

    const hoy = new Date();

    if (filaEncontrada !== -1) {
      // --- ACTUALIZAR CASO EXISTENTE ---
      // 1. Estado del caso (Columna U / 21)
      if (payload.estado) {
        sheet.getRange(filaEncontrada, COL_ESTADO).setValue(payload.estado);
      }

      // 2. Estado del onboarding (Columna S / 19)
      const nuevoStatus = payload.statusOnboarding || payload.etapa;
      if (nuevoStatus) {
        sheet.getRange(filaEncontrada, COL_STATUS).setValue(nuevoStatus);
      }

      // 3. Comentarios del onboarding (Columna T / 20)
      if (payload.comentarios) {
        sheet.getRange(filaEncontrada, COL_COMENTARIO).setValue(payload.comentarios);
      } else if (nuevoStatus && comentariosMap[nuevoStatus]) {
        // Asignar comentario automático si no se envió uno personalizado
        sheet.getRange(filaEncontrada, COL_COMENTARIO).setValue(comentariosMap[nuevoStatus]);
      }

      // 4. Propietario Oportunidad o HeroCare (Columna 9 o 10)
      if (payload.propietarioOportunidad) {
        sheet.getRange(filaEncontrada, 9).setValue(payload.propietarioOportunidad);
      }
      if (payload.propietarioTicket || payload.agente) {
        sheet.getRange(filaEncontrada, 10).setValue(payload.propietarioTicket || payload.agente);
      }

      // 5. Aplicar regla de fecha de cierre automática
      const estadoActual = String(payload.estado || sheet.getRange(filaEncontrada, COL_ESTADO).getValue()).trim().toLowerCase();
      if (estadoActual.includes("cerrado") || estadoActual.includes("fallido")) {
        sheet.getRange(filaEncontrada, COL_CIERRE).setValue(hoy);
      } else if (estadoActual.includes("en progreso") || estadoActual.includes("nuevo")) {
        sheet.getRange(filaEncontrada, COL_CIERRE).setValue("-");
      }

      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        updated: true, 
        fila: filaEncontrada,
        mensaje: "Caso actualizado correctamente en Google Sheets."
      })).setMimeType(ContentService.MimeType.JSON);

    } else {
      // --- REGISTRAR NUEVO CASO ---
      const nuevaFila = new Array(lastCol).fill("");
      nuevaFila[0] = payload.casoOp || "";
      nuevaFila[1] = payload.vendorId || "";
      nuevaFila[2] = payload.tienda || "";
      nuevaFila[3] = payload.pais || "";
      nuevaFila[4] = payload.kam || "";
      nuevaFila[COL_ENVIO - 1] = hoy;
      nuevaFila[COL_CIERRE - 1] = "-";
      nuevaFila[7] = payload.integracion || "";
      nuevaFila[8] = payload.propietarioOportunidad || "";
      nuevaFila[9] = payload.propietarioTicket || payload.agente || "";
      nuevaFila[COL_STATUS - 1] = payload.statusOnboarding || payload.etapa || "Sin integración confirmada";
      nuevaFila[COL_COMENTARIO - 1] = payload.comentarios || comentariosMap[nuevaFila[COL_STATUS - 1]] || "";
      nuevaFila[COL_ESTADO - 1] = payload.estado || "En progreso";

      sheet.appendRow(nuevaFila);

      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        created: true, 
        fila: sheet.getLastRow(),
        mensaje: "Nuevo caso registrado correctamente en Google Sheets."
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;

/**
 * Parsea un texto CSV / TSV directamente en el navegador del cliente (compatible con Netlify y servidores estáticos)
 */
export function parsearCSVCliente(csvText, origen = 'Google Sheets') {
  if (!csvText || typeof csvText !== 'string') return [];

  const lines = [];
  let currentLine = [];
  let currentField = '';
  let inQuotes = false;

  const firstLine = csvText.split('\n')[0] || '';
  const delimiter = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',');

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentLine.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentLine.push(currentField);
      currentField = '';
      if (currentLine.some(c => String(c).trim().length > 0)) {
        lines.push(currentLine);
      }
      currentLine = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentLine.length > 0) {
    currentLine.push(currentField);
    if (currentLine.some(c => String(c).trim().length > 0)) {
      lines.push(currentLine);
    }
  }

  if (lines.length < 2) return [];

  // Buscar fila de encabezados
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const rowText = (lines[i] || []).map(v => String(v || '').toLowerCase()).join(' ');
    if (rowText.includes('caso op') || (rowText.includes('tienda') && rowText.includes('integrac'))) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = (lines[headerRowIdx] || []).map(h => String(h || '').trim());
  const findCol = (predicate) => headers.findIndex(h => predicate(h.toLowerCase()));

  const colCasoOp = findCol(h => (h.includes('caso') && h.includes('op')) || h === 'n° caso op');
  const colVendorId = findCol(h => h === 'id' || h.includes('vendor'));
  const colTienda = findCol(h => h.includes('tienda'));
  const colPais = findCol(h => h.includes('país') || h.includes('pais'));
  const colKam = findCol(h => h.includes('kam'));
  const colIntegracion = findCol(h => h.includes('integrac'));
  const colOportunidad = findCol(h => h.includes('oportunidad') && !h.includes('propietario'));
  const colAsset = findCol(h => h.includes('asset'));
  const colSeguimiento = findCol(h => h.includes('seguimiento'));
  const colPropOp = findCol(h => h.includes('propietario') && h.includes('oportunidad'));
  const colPropTicket = findCol(h => h.includes('herocare') || (h.includes('propietario') && h.includes('ticket')));
  const colTieneInicio = findCol(h => h.includes('onboarding inicial') || h.includes('inicio?'));
  const colComentarios = findCol(h => h.includes('comentario'));
  const colFechaCreacion = findCol(h => h.includes('creación') || h.includes('creacion'));
  const colEstado = findCol(h => h.includes('estado'));
  const colEtapa = findCol(h => h.includes('etapa'));
  const colSlaInicio = findCol(h => h.includes('inicio de seguimiento') || h.includes('sla'));

  const rows = lines.slice(headerRowIdx + 1);
  const casos = [];

  rows.forEach((row, idx) => {
    const getVal = (colIdx, fallback = '') => {
      if (colIdx >= 0 && row[colIdx] !== undefined && row[colIdx] !== null) {
        return String(row[colIdx]).trim();
      }
      return fallback;
    };

    const casoOp = getVal(colCasoOp, '');
    const vendorId = getVal(colVendorId, '');
    const tienda = getVal(colTienda, '');

    if (!casoOp && !vendorId && !tienda) return;

    const estado = getVal(colEstado, 'En progreso') || 'En progreso';
    const estadoLower = estado.toLowerCase();
    const esCerrado = estadoLower.includes('cerrado') || estadoLower.includes('fallido');
    const esActivo = !esCerrado && (estadoLower.includes('en progreso') || estadoLower.includes('nuevo') || estadoLower.includes('ticket hc'));

    const propOp = getVal(colPropOp, '');
    const propTick = getVal(colPropTicket, '');
    const agente = propTick || propOp || 'Sin asignación';

    casos.push({
      id: casoOp || vendorId || `CASO-${idx + 1}`,
      casoOp,
      vendorId,
      vendor_id: vendorId,
      tienda,
      pais: getVal(colPais, 'Argentina'),
      kam: getVal(colKam, ''),
      integracion: getVal(colIntegracion, 'Datalive'),
      oportunidad: getVal(colOportunidad, ''),
      asset: getVal(colAsset, ''),
      casoSeguimiento: getVal(colSeguimiento, ''),
      propietarioOportunidad: propOp,
      propietarioTicket: propTick,
      agente,
      tieneCasoInicio: getVal(colTieneInicio, 'Si'),
      comentarios: getVal(colComentarios, ''),
      fechaCreacion: getVal(colFechaCreacion, new Date().toISOString().split('T')[0]),
      estado,
      etapa: getVal(colEtapa, 'Validación del Onboarding'),
      sla_inicio: getVal(colSlaInicio, new Date().toISOString()),
      esActivo,
      origen,
      filaNumero: idx + 6
    });
  });

  return casos;
}

/**
 * Prueba la URL de Google Apps Script o enlace de Google Sheets
 * Funciona tanto con backend (/api/sheets/gas-proxy) como con fallback directo de cliente (Netlify)
 */
export async function probarConexionGas(gasUrl) {
  if (!gasUrl || !gasUrl.startsWith('http')) {
    throw new Error('Ingresa una URL válida de Google Apps Script o enlace publicado de Google Sheets.');
  }

  const urlLimpia = gasUrl.trim();

  // 1. Si es un enlace de Google Sheets o CSV publicado
  if (urlLimpia.includes('docs.google.com/spreadsheets') || urlLimpia.includes('output=csv')) {
    let csvUrl = urlLimpia;
    if (urlLimpia.includes('/edit')) {
      const idMatch = urlLimpia.match(/\/d\/([a-zA-Z0-9-_]+)/);
      const gidMatch = urlLimpia.match(/gid=([0-9]+)/);
      if (idMatch) {
        const sheetId = idMatch[1];
        const gid = gidMatch ? gidMatch[1] : '0';
        csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      }
    }

    // Intentar leer el CSV directamente y con proxies CORS de respaldo
    const urlsAProbar = [
      csvUrl,
      `https://corsproxy.io/?${encodeURIComponent(csvUrl)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(csvUrl)}`
    ];

    let detectoBloqueoCorporativo = false;

    for (const testUrl of urlsAProbar) {
      try {
        const resp = await fetch(testUrl);
        if (resp.ok) {
          const text = await resp.text();
          if (text.includes('accounts.google.com') || text.includes('ServiceLogin') || text.includes('Allow Google Sheets access') || text.includes('Sign in to your Google Account')) {
            detectoBloqueoCorporativo = true;
            continue;
          }
          const casos = parsearCSVCliente(text, 'Google Sheets Enlace');
          if (casos.length > 0) {
            localStorage.setItem('PEDA_CASOS_LOCAL', JSON.stringify(casos));
            return { success: true, total: casos.length, casos };
          }
        }
      } catch {
        // Probar siguiente alternativa de conexión
      }
    }

    if (detectoBloqueoCorporativo) {
      throw new Error('Google Workspace bloquea el enlace público. En tu Google Sheet ve a: Archivo > Compartir > Publicar en la web > abre la sección "Contenido publicado y configuración" > DESMARCA la casilla: "Requerir que los lectores inicien sesión con su cuenta de pedidosya.com" y haz clic en Publicar. Con ese paso quedará 100% automático.');
    }
  }

  // 2. Intento por proxy de backend si existe
  try {
    const res = await fetch(`/api/sheets/gas-proxy?url=${encodeURIComponent(urlLimpia)}`);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.success && Array.isArray(data.casos)) {
        localStorage.setItem('PEDA_CASOS_LOCAL', JSON.stringify(data.casos));
        return data;
      }
      if (data.error) {
        throw new Error(data.error);
      }
    } else if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Google solicita inicio de sesión corporativo. Asegúrate de configurar "Quién tiene acceso: Cualquier usuario" en Apps Script.');
    }
  } catch (err) {
    if (err.message && (err.message.includes('corporativo') || err.message.includes('sesión') || err.message.includes('Cualquier usuario'))) {
      throw err;
    }
    console.warn('[probarConexionGas] Backend no disponible (ej. Netlify), intentando llamada cliente:', err);
  }

  // 3. Fallback directo de cliente para Web App de Apps Script
  try {
    const separator = urlLimpia.includes('?') ? '&' : '?';
    const targetUrl = `${urlLimpia}${separator}action=getCasos&sheet=Onboarding&t=${Date.now()}`;
    const directRes = await fetch(targetUrl, { mode: 'cors', redirect: 'follow' });
    if (directRes.ok) {
      const directText = await directRes.text();
      let directJson;
      try {
        directJson = JSON.parse(directText);
      } catch {
        if (directText.includes('ServiceLogin') || directText.includes('accounts.google.com')) {
          throw new Error('Google Workspace solicita inicio de sesión corporativo. Para acceso automático: en Google Apps Script > Implementar > Gestionar implementaciones > Editar > cambia "Quién tiene acceso" a "Cualquier usuario" (Anyone). O usa "Publicar en la web" como CSV.');
        }
      }

      if (directJson && directJson.casos && Array.isArray(directJson.casos)) {
        localStorage.setItem('PEDA_CASOS_LOCAL', JSON.stringify(directJson.casos));
        return { success: true, total: directJson.casos.length, casos: directJson.casos };
      }
    }
  } catch (directErr) {
    if (directErr.message && (directErr.message.includes('Google Workspace') || directErr.message.includes('Cualquier usuario'))) {
      throw directErr;
    }
  }

  // 4. Si hay casos en localStorage previamente guardados, devolverlos
  const local = localStorage.getItem('PEDA_CASOS_LOCAL');
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { success: true, total: parsed.length, casos: parsed, desdeCacheLocal: true };
      }
    } catch {
      // Continuar
    }
  }

  throw new Error('En Google Apps Script ve a: Implementar > Gestionar implementaciones > Editar > y en "Quién tiene acceso" selecciona: "Cualquier usuario" (Anyone). O alternativamente publica la hoja como CSV (Archivo > Compartir > Publicar en la web).');
}

/**
 * Envía un archivo o texto CSV para procesar e incorporar en el backend o en el almacenamiento local
 */
export async function importarCasosCSV(csvText, origen = 'Archivo CSV') {
  const casosParseados = parsearCSVCliente(csvText, origen);
  if (casosParseados.length > 0) {
    localStorage.setItem('PEDA_CASOS_LOCAL', JSON.stringify(casosParseados));
  }

  try {
    const res = await fetch('/api/sheets/import-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText, origen })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Si el backend no existe (Netlify), responder con los datos locales
  }

  if (casosParseados.length > 0) {
    return {
      success: true,
      message: `Se importaron ${casosParseados.length} casos correctamente en el navegador.`,
      total: casosParseados.length,
      activos: casosParseados.filter(c => c.esActivo).length,
      casos: casosParseados
    };
  }

  throw new Error('No se detectaron filas válidas en el CSV proporcionado.');
}

/**
 * Consulta la data del Google Sheet (Onboarding)
 * Soporta Netlify y localmente usando caché de navegador
 */
export async function consultarCasosGoogleSheets() {
  const gasUrl = obtenerGasUrl();

  // 1. Intento por proxy de Apps Script / Google Sheets
  if (gasUrl) {
    try {
      const data = await probarConexionGas(gasUrl);
      if (data.success && Array.isArray(data.casos) && data.casos.length > 0) {
        localStorage.setItem('PEDA_CASOS_LOCAL', JSON.stringify(data.casos));
        return data.casos;
      }
    } catch (errGas) {
      console.warn('[GoogleSheets] Consulta GAS no completada:', errGas.message);
    }
  }

  // 2. Intento por API backend /api/sheets/casos si existe
  try {
    const res = await fetch('/api/sheets/casos');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.casos) && data.casos.length > 0) {
        localStorage.setItem('PEDA_CASOS_LOCAL', JSON.stringify(data.casos));
        return data.casos;
      }
    }
  } catch {
    // Continuar a caché local
  }

  // 3. Fallback de resiliencia: leer de localStorage
  const local = localStorage.getItem('PEDA_CASOS_LOCAL');
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Ignorar
    }
  }

  return [];
}

/**
 * Actualiza o crea un caso en el backend y lo sincroniza con Google Apps Script si está configurado
 */
export async function actualizarCasoEnSheets(casoActualizado) {
  try {
    const local = localStorage.getItem('PEDA_CASOS_LOCAL');
    if (local) {
      const lista = JSON.parse(local);
      const idx = lista.findIndex(c => String(c.casoOp || c.id) === String(casoActualizado.casoOp || casoActualizado.id));
      if (idx !== -1) {
        lista[idx] = { ...lista[idx], ...casoActualizado };
      } else {
        lista.push({ ...casoActualizado, filaNumero: lista.length + 6 });
      }
      localStorage.setItem('PEDA_CASOS_LOCAL', JSON.stringify(lista));
    }
  } catch {
    // Continuar
  }

  const gasUrl = obtenerGasUrl();

  try {
    const res = await fetch('/api/sheets/actualizar-caso', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-gas-url': gasUrl || ''
      },
      body: JSON.stringify({ ...casoActualizado, _gasUrl: gasUrl })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    if (gasUrl && gasUrl.startsWith('http')) {
      try {
        await fetch(gasUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(casoActualizado)
        });
      } catch {
        // Ignorar
      }
    }
  }

  return { success: true, caso: casoActualizado };
}

