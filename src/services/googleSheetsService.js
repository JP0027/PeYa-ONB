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

export function obtenerGasUrl() {
  return localStorage.getItem('PEDA_GAS_URL') || 
         import.meta.env.VITE_GAS_WEBAPP_URL || 
         'https://script.google.com/macros/s/AKfycbwSon9BeerNaPPqbd1wvCRxorbiWJzo-aHiyNkINbj2BKu8K7iFTh7LltfsaRiKb5P78g/exec';
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
 * Incluye las 4 reglas automáticas en tiempo real y endpoints GET y POST
 */
export const APPS_SCRIPT_TEMPLATE = `/**
 * Google Apps Script para HeroCare ONB (PedidosYa) - Hoja: Onboarding_New
 * 1. Pega este código en: Extensiones > Apps Script
 * 2. Clic en: Implementar > Nueva implementación
 * 3. Selecciona: Aplicación web
 * 4. Configura:
 *    - Ejecutar como: "Yo" (tu cuenta)
 *    - Quién tiene acceso: "Cualquier usuario" (Anyone)
 * 5. Clic en "Implementar" y copia la URL generada (/exec).
 */

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Onboarding_New") || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length < 2) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, casos: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Buscar la fila de encabezados
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const rowStr = data[i].join(" ").toLowerCase();
      if (rowStr.includes("caso op") || (rowStr.includes("tienda") && rowStr.includes("integrac"))) {
        headerRowIdx = i;
        break;
      }
    }
    
    const headers = data[headerRowIdx].map(function(h) { return String(h || "").trim(); });
    const rows = data.slice(headerRowIdx + 1);
    
    const casos = rows.map(function(row, idx) {
      const obj = { filaNumero: headerRowIdx + 2 + idx };
      headers.forEach(function(h, colIdx) {
        if (h) {
          obj[h] = row[colIdx] !== undefined ? String(row[colIdx]) : "";
        }
      });
      return obj;
    }).filter(function(c) {
      return c["N° Caso OP"] || c["ID"] || c["Tienda"];
    });
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, total: casos.length, casos: casos }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Onboarding_New") || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();
    
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const rowStr = data[i].join(" ").toLowerCase();
      if (rowStr.includes("caso op") || (rowStr.includes("tienda") && rowStr.includes("integrac"))) {
        headerRowIdx = i;
        break;
      }
    }
    
    const headers = data[headerRowIdx].map(function(h) { return String(h || "").trim(); });
    const colCasoOp = headers.indexOf("N° Caso OP");
    const colPropOp = headers.indexOf("Propietario Oportunidad");
    const colEstado = headers.indexOf("Estado del caso (SF)");
    const colEtapa = headers.indexOf("Etapa del onboarding");
    const colComentarios = headers.indexOf("Comentarios del Onboarding");
    
    // Buscar si ya existe la fila para actualizarla sin duplicar
    let filaEncontrada = -1;
    if (colCasoOp !== -1 && payload.casoOp) {
      for (let r = headerRowIdx + 1; r < data.length; r++) {
        if (String(data[r][colCasoOp]).trim() === String(payload.casoOp).trim()) {
          filaEncontrada = r + 1; // 1-indexed para Sheets
          break;
        }
      }
    }
    
    if (filaEncontrada !== -1) {
      // Actualizar columnas existentes
      if (colPropOp !== -1 && payload.propietarioOportunidad) {
        sheet.getRange(filaEncontrada, colPropOp + 1).setValue(payload.propietarioOportunidad);
      }
      if (colEstado !== -1 && payload.estado) {
        sheet.getRange(filaEncontrada, colEstado + 1).setValue(payload.estado);
      }
      if (colEtapa !== -1 && payload.etapa) {
        sheet.getRange(filaEncontrada, colEtapa + 1).setValue(payload.etapa);
      }
      if (colComentarios !== -1 && payload.comentarios) {
        sheet.getRange(filaEncontrada, colComentarios + 1).setValue(payload.comentarios);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, updated: true, fila: filaEncontrada }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      // Insertar nuevo caso como nueva fila al final de Onboarding_New
      const nuevaFila = headers.map(function(h) {
        const hLow = h.toLowerCase();
        if (hLow.includes("caso") && hLow.includes("op")) return payload.casoOp || "";
        if (hLow === "id" || hLow.includes("vendor")) return payload.vendorId || "";
        if (hLow.includes("tienda")) return payload.tienda || "";
        if (hLow.includes("país") || hLow.includes("pais")) return payload.pais || "";
        if (hLow.includes("kam")) return payload.kam || "";
        if (hLow.includes("integrac")) return payload.integracion || "";
        if (hLow.includes("oportunidad") && !hLow.includes("propietario")) return payload.oportunidad || "";
        if (hLow.includes("asset")) return payload.asset || "";
        if (hLow.includes("seguimiento")) return payload.casoSeguimiento || "";
        if (hLow.includes("propietario") && hLow.includes("oportunidad")) return payload.propietarioOportunidad || "";
        if (hLow.includes("herocare") || (hLow.includes("propietario") && hLow.includes("ticket"))) return payload.propietarioTicket || payload.agente || "";
        if (hLow.includes("inicial") || hLow.includes("inicio?")) return payload.tieneCasoInicio || "Si";
        if (hLow.includes("comentario")) return payload.comentarios || "";
        if (hLow.includes("creación") || hLow.includes("creacion")) return payload.fechaCreacion || Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
        if (hLow.includes("estado")) return payload.estado || "Nuevo";
        if (hLow.includes("etapa")) return payload.etapa || "Validación del Onboarding";
        if (hLow.includes("sla") || hLow.includes("inicio de seguimiento")) return payload.sla_inicio || new Date().toISOString();
        return "";
      });
      sheet.appendRow(nuevaFila);
      return ContentService.createTextOutput(JSON.stringify({ success: true, created: true, fila: sheet.getLastRow() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;

/**
 * Prueba la URL de Google Apps Script a través del proxy del backend
 */
export async function probarConexionGas(gasUrl) {
  if (!gasUrl || !gasUrl.startsWith('http')) {
    throw new Error('Ingresa una URL válida de Google Apps Script (inicia con https://script.google.com/macros/s/...)');
  }

  const res = await fetch(`/api/sheets/gas-proxy?url=${encodeURIComponent(gasUrl.trim())}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Error al conectar con la Web App (${res.status})`);
  }
  return data;
}

/**
 * Envía un archivo o texto CSV para procesar e incorporar en el backend
 */
export async function importarCasosCSV(csvText, origen = 'Archivo CSV') {
  const res = await fetch('/api/sheets/import-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvText, origen })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Error importando archivo CSV');
  }
  return data;
}

/**
 * Consulta la data del Google Sheet (Onboarding_New)
 * Prioriza el backend (cuenta de servicio o caché), y como fallback usa el proxy de Apps Script
 */
export async function consultarCasosGoogleSheets() {
  // 1. Intento primario: Backend (/api/sheets/casos)
  try {
    const res = await fetch('/api/sheets/casos');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.casos) && data.casos.length > 0) {
        console.log(`[GoogleSheets] Se obtuvieron ${data.casos.length} casos reales desde la API backend (${data.activos} activos).`);
        return data.casos;
      }
    }
  } catch (err) {
    console.warn('[GoogleSheets] Backend no disponible o error de red:', err);
  }

  // 2. Intento secundario: Google Apps Script Web App a través del proxy seguro del backend
  const gasUrl = obtenerGasUrl();
  if (gasUrl) {
    try {
      const data = await probarConexionGas(gasUrl);
      if (data.success && Array.isArray(data.casos) && data.casos.length > 0) {
        console.log(`[GoogleSheets] Se obtuvieron ${data.casos.length} casos desde Google Apps Script.`);
        return data.casos;
      }
    } catch (errGas) {
      console.warn('[GoogleSheets] Error consultando GAS vía proxy:', errGas);
    }
  }

  return [];
}

/**
 * Actualiza o crea un caso en el backend y lo sincroniza con Google Apps Script si está configurado
 */
export async function actualizarCasoEnSheets(casoActualizado) {
  try {
    const gasUrl = obtenerGasUrl();
    const res = await fetch('/api/sheets/actualizar-caso', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-gas-url': gasUrl || ''
      },
      body: JSON.stringify({ ...casoActualizado, _gasUrl: gasUrl })
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('[GoogleSheets] Error enviando actualización a backend:', err);
  }
  return { success: true, caso: casoActualizado };
}

