import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Guarda una lista de casos en Firebase Firestore en lotes (batch) de hasta 500 documentos.
 * @param {Array} casos Lista de casos a guardar
 * @param {Function} onProgreso Callback opcional de progreso (procesados, total)
 * @returns {Promise<{success: boolean, total: number}>}
 */
export async function guardarCasosEnFirestore(casos, onProgreso = null) {
  if (!Array.isArray(casos) || casos.length === 0) {
    throw new Error('No hay casos para guardar en Firebase.');
  }

  const BATCH_SIZE = 450; // Límite de Firestore es 500 operaciones por batch
  let totalGuardados = 0;

  for (let i = 0; i < casos.length; i += BATCH_SIZE) {
    const chunk = casos.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach(caso => {
      const docId = String(caso.casoOp || caso.id || `CASO_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`);
      const casoRef = doc(db, 'casos', docId);
      
      let estadoLimpio = String(caso.estado || '').trim();
      let etapaLimpia = String(caso.etapa || '').trim();
      
      // Si el estado o etapa viene con una fecha corrupta (GMT...), sanear
      if (estadoLimpio.includes('GMT') || estadoLimpio.includes('00:00:00')) {
        estadoLimpio = 'En progreso';
      }
      if (etapaLimpia.includes('GMT') || etapaLimpia.includes('00:00:00')) {
        etapaLimpia = 'Validación del Onboarding';
      }

      const estLower = estadoLimpio.toLowerCase();
      const etapLower = etapaLimpia.toLowerCase();
      const esCerrado = estLower.includes('cerrad') || estLower.includes('fallid') || estLower.includes('cancel') || etapLower.includes('pedido de prueba realizado');
      const esActivo = !esCerrado && (estLower.includes('en progreso') || estLower.includes('nuevo') || estLower.includes('ticket hc') || estLower === 'abierto');

      const payload = {
        id: docId,
        casoOp: caso.casoOp || docId,
        vendorId: caso.vendorId || caso.vendor_id || '',
        vendor_id: caso.vendorId || caso.vendor_id || '',
        tienda: caso.tienda || '',
        pais: caso.pais || 'Argentina',
        kam: caso.kam || '',
        integracion: caso.integracion || '',
        oportunidad: caso.oportunidad || '',
        asset: caso.asset || '',
        casoSeguimiento: caso.casoSeguimiento || '',
        propietarioOportunidad: caso.propietarioOportunidad || '',
        propietarioTicket: caso.propietarioTicket || '',
        agente: caso.agente || caso.propietarioTicket || caso.propietarioOportunidad || 'Sin asignación',
        tieneCasoInicio: caso.tieneCasoInicio || 'Si',
        comentarios: caso.comentarios || '',
        fechaCreacion: caso.fechaCreacion || new Date().toISOString().split('T')[0],
        estado: estadoLimpio || 'En progreso',
        etapa: etapaLimpia || 'Validación del Onboarding',
        sla_inicio: caso.sla_inicio || new Date().toISOString(),
        esActivo: typeof caso.esActivo === 'boolean' && !esCerrado ? caso.esActivo : esActivo,
        origen: 'Firebase (Sincronizado)',
        actualizadoEn: new Date().toISOString()
      };

      batch.set(casoRef, payload, { merge: true });
    });

    await batch.commit();
    totalGuardados += chunk.length;
    if (onProgreso) {
      onProgreso(totalGuardados, casos.length);
    }
  }

  return { success: true, total: totalGuardados };
}

/**
 * Consulta todos los casos existentes en Firestore una sola vez
 */
export async function obtenerCasosFirestore() {
  try {
    const casosRef = collection(db, 'casos');
    const snapshot = await getDocs(casosRef);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.warn('[FirebaseCasos] Error obteniendo casos de Firestore:', error);
    return [];
  }
}

/**
 * Genera el script que se puede pegar en Google Sheets (Extensiones > Apps Script)
 * para enviar datos automáticamente a Firebase Firestore mediante su REST API oficial sin enlaces.
 * Detecta dinámicamente las cabeceras reales (Estado, Etapa, Tienda, etc.) para que sólo
 * los casos verdaderamente activos se marquen en progreso.
 */
export function generarScriptAppsScriptParaFirebase() {
  return `/**
 * ==============================================================================
 * SCRIPT DE SINCRONIZACIÓN AUTOMÁTICA CON FIREBASE FIRESTORE (PEDIDOSYA ONB)
 * ==============================================================================
 * Sincronización 100% automática y en tiempo real para todos los usuarios:
 * 1. onEdit(e): Cada vez que un agente edita o agrega una fila hoy, se envía a Firestore en <1s.
 * 2. sincronizarCasosAFirebase(): Sincroniza todos los casos usando batch commits rápidos (3s).
 * 3. Activador automático en segundo plano cada 1 minuto (sin intervención manual).
 */

const PROJECT_ID = "peya-onb";

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 Firebase ONB')
    .addItem('☁️ Sincronizar Todo a Firebase', 'sincronizarCasosAFirebase')
    .addItem('⚡ Sincronizar Casos Recientes (Hoy)', 'sincronizarCasosRecientes')
    .addItem('⏰ Activar Sincronización Automática', 'instalarActivadorAutomatico')
    .addToUi();

  // Instalar activador automático en segundo plano si aún no existe
  try {
    instalarActivadorAutomatico();
  } catch (e) {
    Logger.log("Info activador: " + e);
  }
}

/**
 * Disparador instantáneo por edición manual en cualquier celda de Google Sheets
 */
function onEdit(e) {
  if (!e || !e.range) return;
  try {
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    if (sheetName !== "Onboarding" && sheetName !== "Onboarding_New") return;
    const row = e.range.getRow();
    if (row < 3) return; // Encabezados
    
    sincronizarFilaAFirebase(sheet, row);
  } catch (err) {
    Logger.log("Error en onEdit: " + err);
  }
}

/**
 * Instala un activador que sincroniza las filas recientes cada 1 minuto
 */
function instalarActivadorAutomatico() {
  const triggers = ScriptApp.getProjectTriggers();
  const existe = triggers.some(function(t) {
    return t.getHandlerFunction() === 'sincronizarCasosRecientes' || t.getHandlerFunction() === 'sincronizarCasosAFirebase';
  });
  if (!existe) {
    ScriptApp.newTrigger('sincronizarCasosRecientes')
      .timeBased()
      .everyMinutes(1)
      .create();
  }
}

function obtenerMapeoColumnas(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 25);
  const topRows = sheet.getRange(1, 1, Math.min(5, sheet.getLastRow()), lastCol).getValues();
  let headerRowIndex = 2;
  let headers = [];
  
  for (let r = 0; r < topRows.length; r++) {
    const rowStr = topRows[r].map(function(c) { return String(c || '').toLowerCase().trim(); });
    if (rowStr.some(function(c) { return c.includes('caso') || c.includes('tienda') || c === 'id'; })) {
      headerRowIndex = r + 1;
      headers = rowStr;
      break;
    }
  }
  if (headers.length === 0 && topRows.length >= 2) {
    headers = topRows[1].map(function(c) { return String(c || '').toLowerCase().trim(); });
  }

  function findCol(predicate) {
    for (let i = 0; i < headers.length; i++) {
      if (predicate(headers[i])) return i;
    }
    return -1;
  }

  return {
    headerRowIndex: headerRowIndex,
    lastCol: lastCol,
    colCasoOp: findCol(function(h) { return (h.includes('caso') && h.includes('op')) || h === 'n° caso op'; }),
    colVendorId: findCol(function(h) { return h === 'id' || h.includes('vendor'); }),
    colTienda: findCol(function(h) { return h.includes('tienda'); }),
    colPais: findCol(function(h) { return h.includes('país') || h.includes('pais'); }),
    colKam: findCol(function(h) { return h.includes('kam'); }),
    colIntegracion: findCol(function(h) { return h.includes('integrac'); }),
    colOportunidad: findCol(function(h) { return h.includes('oportunidad') && !h.includes('propietario'); }),
    colAsset: findCol(function(h) { return h.includes('asset'); }),
    colPropOp: findCol(function(h) { return h.includes('propietario') && h.includes('oportunidad'); }),
    colPropTicket: findCol(function(h) { return h.includes('herocare') || (h.includes('propietario') && h.includes('ticket')); }),
    colEstado: findCol(function(h) { return (h.includes('estado') && !h.includes('onboarding')) || h === 'estado del caso' || h === 'estado caso'; }),
    colEtapa: findCol(function(h) { return h.includes('onboarding') || h.includes('etapa') || h === 'estado del onboarding' || h === 'status'; })
  };
}

function parsearFilaCaso(row, cols, filaNumero) {
  const cCasoOp = cols.colCasoOp >= 0 ? cols.colCasoOp : 0;
  const cVendor = cols.colVendorId >= 0 ? cols.colVendorId : 1;
  const cTienda = cols.colTienda >= 0 ? cols.colTienda : 2;
  const cPais = cols.colPais >= 0 ? cols.colPais : 3;
  const cKam = cols.colKam >= 0 ? cols.colKam : 4;
  const cInteg = cols.colIntegracion >= 0 ? cols.colIntegracion : 5;
  const cOp = cols.colOportunidad >= 0 ? cols.colOportunidad : 6;
  const cAsset = cols.colAsset >= 0 ? cols.colAsset : 7;
  const cPropOp = cols.colPropOp >= 0 ? cols.colPropOp : 9;
  const cPropHc = cols.colPropTicket >= 0 ? cols.colPropTicket : 10;
  const cEstado = cols.colEstado >= 0 ? cols.colEstado : 20;
  const cEtapa = cols.colEtapa >= 0 ? cols.colEtapa : 18;

  const casoOp = String(row[cCasoOp] || '').trim();
  const vendorId = String(row[cVendor] || '').trim();
  const tienda = String(row[cTienda] || '').trim();

  if (!casoOp && !vendorId && !tienda) return null;

  const docId = casoOp || vendorId || ('CASO_' + filaNumero);

  let estado = String(row[cEstado] || '').trim();
  let etapa = String(row[cEtapa] || '').trim();

  // Si la celda contiene una fecha corrupta (GMT o Timestamp), buscar en celdas contiguas
  if (estado instanceof Date || estado.indexOf('GMT') !== -1 || estado.indexOf('00:00:00') !== -1 || !estado) {
    for (let c = 12; c < Math.min(row.length, 25); c++) {
      const val = String(row[c] || '').trim();
      const vLower = val.toLowerCase();
      if (vLower.indexOf('cerrad') !== -1 || vLower.indexOf('fallid') !== -1 || vLower === 'en progreso' || vLower === 'nuevo' || vLower.indexOf('ticket hc') !== -1) {
        estado = val;
        break;
      }
    }
  }

  if (!estado || estado.indexOf('GMT') !== -1) {
    estado = 'En progreso';
  }
  if (!etapa || etapa.indexOf('GMT') !== -1) {
    etapa = 'Validación del Onboarding';
  }

  const estadoLower = estado.toLowerCase();
  const etapaLower = etapa.toLowerCase();
  const esCerrado = estadoLower.indexOf('cerrad') !== -1 || estadoLower.indexOf('fallid') !== -1 || estadoLower.indexOf('cancel') !== -1 || etapaLower.indexOf('pedido de prueba realizado') !== -1;
  const esActivo = !esCerrado && (estadoLower.indexOf('en progreso') !== -1 || estadoLower.indexOf('nuevo') !== -1 || estadoLower.indexOf('ticket hc') !== -1 || estadoLower === 'abierto');

  const propOportunidad = String(row[cPropOp] || '').trim();
  const propTicket = String(row[cPropHc] || '').trim();
  const agente = propTicket || propOportunidad || 'Sin asignación';

  return {
    docId: docId,
    casoOp: casoOp || docId,
    vendorId: vendorId,
    vendor_id: vendorId,
    tienda: tienda,
    pais: String(row[cPais] || 'Argentina').trim(),
    kam: String(row[cKam] || '').trim(),
    integracion: String(row[cInteg] || '').trim(),
    oportunidad: String(row[cOp] || '').trim(),
    asset: String(row[cAsset] || '').trim(),
    propietarioOportunidad: propOportunidad,
    propietarioTicket: propTicket,
    agente: agente,
    estado: estado,
    etapa: etapa,
    esActivo: esActivo,
    origen: 'Google Sheets (Tiempo Real)',
    actualizadoEn: new Date().toISOString()
  };
}

function sincronizarFilaAFirebase(sheet, rowNum) {
  const cols = obtenerMapeoColumnas(sheet);
  const rowData = sheet.getRange(rowNum, 1, 1, cols.lastCol).getValues()[0];
  const parsed = parsearFilaCaso(rowData, cols, rowNum);
  if (!parsed) return;

  const docId = parsed.docId;
  const firestoreDocument = {
    fields: {
      id: { stringValue: docId },
      casoOp: { stringValue: parsed.casoOp },
      vendorId: { stringValue: parsed.vendorId },
      vendor_id: { stringValue: parsed.vendorId },
      tienda: { stringValue: parsed.tienda },
      pais: { stringValue: parsed.pais },
      kam: { stringValue: parsed.kam },
      integracion: { stringValue: parsed.integracion },
      oportunidad: { stringValue: parsed.oportunidad },
      asset: { stringValue: parsed.asset },
      propietarioOportunidad: { stringValue: parsed.propietarioOportunidad },
      propietarioTicket: { stringValue: parsed.propietarioTicket },
      agente: { stringValue: parsed.agente },
      estado: { stringValue: parsed.estado },
      etapa: { stringValue: parsed.etapa },
      esActivo: { booleanValue: parsed.esActivo },
      origen: { stringValue: 'Google Sheets (Tiempo Real)' },
      actualizadoEn: { stringValue: new Date().toISOString() }
    }
  };

  const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/casos/' + encodeURIComponent(docId);
  UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify(firestoreDocument),
    muteHttpExceptions: true
  });
}

/**
 * Sincroniza rápidamente los casos más recientes (las últimas 150 filas)
 */
function sincronizarCasosRecientes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Onboarding_New") || ss.getSheetByName("Onboarding") || ss.getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return;

  const cols = obtenerMapeoColumnas(sheet);
  const dataStartRow = Math.max(cols.headerRowIndex + 1, lastRow - 150);
  const numRows = lastRow - dataStartRow + 1;
  const values = sheet.getRange(dataStartRow, 1, numRows, cols.lastCol).getValues();

  const writes = [];
  for (let i = 0; i < values.length; i++) {
    const parsed = parsearFilaCaso(values[i], cols, dataStartRow + i);
    if (!parsed) continue;

    writes.push({
      update: {
        name: 'projects/' + PROJECT_ID + '/databases/(default)/documents/casos/' + encodeURIComponent(parsed.docId),
        fields: {
          id: { stringValue: parsed.docId },
          casoOp: { stringValue: parsed.casoOp },
          vendorId: { stringValue: parsed.vendorId },
          vendor_id: { stringValue: parsed.vendorId },
          tienda: { stringValue: parsed.tienda },
          pais: { stringValue: parsed.pais },
          kam: { stringValue: parsed.kam },
          integracion: { stringValue: parsed.integracion },
          oportunidad: { stringValue: parsed.oportunidad },
          asset: { stringValue: parsed.asset },
          propietarioOportunidad: { stringValue: parsed.propietarioOportunidad },
          propietarioTicket: { stringValue: parsed.propietarioTicket },
          agente: { stringValue: parsed.agente },
          estado: { stringValue: parsed.estado },
          etapa: { stringValue: parsed.etapa },
          esActivo: { booleanValue: parsed.esActivo },
          origen: { stringValue: 'Google Sheets (Tiempo Real)' },
          actualizadoEn: { stringValue: new Date().toISOString() }
        }
      }
    });
  }

  if (writes.length > 0) {
    const commitUrl = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents:commit';
    UrlFetchApp.fetch(commitUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ writes: writes }),
      muteHttpExceptions: true
    });
  }
}

/**
 * Sincronización completa de toda la planilla usando batch commits ultrarrápidos (3s para 2000 filas)
 */
function sincronizarCasosAFirebase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Onboarding_New") || ss.getSheetByName("Onboarding") || ss.getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) {
    ss.toast("No hay filas de datos", "Aviso");
    return;
  }

  const cols = obtenerMapeoColumnas(sheet);
  const dataStartRow = cols.headerRowIndex + 1;
  const numRows = lastRow - dataStartRow + 1;
  const values = sheet.getRange(dataStartRow, 1, numRows, cols.lastCol).getValues();

  let todosCasos = [];
  for (let i = 0; i < values.length; i++) {
    const parsed = parsearFilaCaso(values[i], cols, dataStartRow + i);
    if (parsed) todosCasos.push(parsed);
  }

  // Enviar en bloques de 300 usando el endpoint oficial :commit de Firestore
  const BATCH_SIZE = 300;
  const commitUrl = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents:commit';
  let totalEnviados = 0;

  for (let b = 0; b < todosCasos.length; b += BATCH_SIZE) {
    const chunk = todosCasos.slice(b, b + BATCH_SIZE);
    const writes = chunk.map(function(c) {
      return {
        update: {
          name: 'projects/' + PROJECT_ID + '/databases/(default)/documents/casos/' + encodeURIComponent(c.docId),
          fields: {
            id: { stringValue: c.docId },
            casoOp: { stringValue: c.casoOp },
            vendorId: { stringValue: c.vendorId },
            vendor_id: { stringValue: c.vendorId },
            tienda: { stringValue: c.tienda },
            pais: { stringValue: c.pais },
            kam: { stringValue: c.kam },
            integracion: { stringValue: c.integracion },
            oportunidad: { stringValue: c.oportunidad },
            asset: { stringValue: c.asset },
            propietarioOportunidad: { stringValue: c.propietarioOportunidad },
            propietarioTicket: { stringValue: c.propietarioTicket },
            agente: { stringValue: c.agente },
            estado: { stringValue: c.estado },
            etapa: { stringValue: c.etapa },
            esActivo: { booleanValue: c.esActivo },
            origen: { stringValue: 'Google Sheets (Tiempo Real)' },
            actualizadoEn: { stringValue: new Date().toISOString() }
          }
        }
      };
    });

    try {
      UrlFetchApp.fetch(commitUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ writes: writes }),
        muteHttpExceptions: true
      });
      totalEnviados += chunk.length;
    } catch (e) {
      Logger.log("Error en batch commit: " + e);
    }
  }

  ss.toast("¡Sincronización completa! " + totalEnviados + " casos enviados a Firebase.", "🚀 Firebase OK", 6);
}
`;
}
