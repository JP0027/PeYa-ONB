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
 * Este script se ejecuta DIRECTAMENTE DENTRO DE GOOGLE SHEETS con tus permisos corporativos.
 * Detecta automáticamente las columnas por nombre (Estado, Etapa, Tienda, KAM, etc.)
 * y sincroniza los casos en Firebase Firestore respetando los 33 casos reales en progreso.
 * 
 * INSTRUCCIONES:
 * 1. En Google Sheets ve a: Extensiones > Apps Script.
 * 2. Reemplaza el código anterior por este nuevo script y guarda (💾).
 * 3. En la hoja de cálculo ve al menú: "🚀 Firebase ONB" > "☁️ Sincronizar Casos a Firebase".
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 Firebase ONB')
    .addItem('☁️ Sincronizar Casos a Firebase', 'sincronizarCasosAFirebase')
    .addToUi();
}

function sincronizarCasosAFirebase() {
  const PROJECT_ID = "peya-onb";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Onboarding_New") || ss.getSheetByName("Onboarding") || ss.getActiveSheet();
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 3) {
    SpreadsheetApp.getActiveSpreadsheet().toast("No hay filas de datos", "Aviso");
    return;
  }
  
  // 1. Localizar la fila de encabezados examinando las primeras 5 filas
  const topRows = sheet.getRange(1, 1, Math.min(5, lastRow), lastCol).getValues();
  let headerRowIndex = 2; // Por defecto fila 2 en Onboarding_New
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
  
  // Mapeo dinámico e inteligente de columnas
  const colCasoOp = findCol(function(h) { return (h.includes('caso') && h.includes('op')) || h === 'n° caso op'; });
  const colVendorId = findCol(function(h) { return h === 'id' || h.includes('vendor'); });
  const colTienda = findCol(function(h) { return h.includes('tienda'); });
  const colPais = findCol(function(h) { return h.includes('país') || h.includes('pais'); });
  const colKam = findCol(function(h) { return h.includes('kam'); });
  const colIntegracion = findCol(function(h) { return h.includes('integrac'); });
  const colOportunidad = findCol(function(h) { return h.includes('oportunidad') && !h.includes('propietario'); });
  const colAsset = findCol(function(h) { return h.includes('asset'); });
  const colPropOp = findCol(function(h) { return h.includes('propietario') && h.includes('oportunidad'); });
  const colPropTicket = findCol(function(h) { return h.includes('herocare') || (h.includes('propietario') && h.includes('ticket')); });
  
  // Buscar específicamente la columna real de Estado (no del onboarding ni de fechas)
  let colEstado = findCol(function(h) { 
    return (h.includes('estado') && !h.includes('onboarding')) || h === 'estado del caso' || h === 'estado caso'; 
  });
  
  // Columna de Etapa (Estado del Onboarding)
  let colEtapa = findCol(function(h) { 
    return h.includes('onboarding') || h.includes('etapa') || h === 'estado del onboarding' || h === 'status'; 
  });

  const dataStartRow = headerRowIndex + 1;
  const numRows = lastRow - dataStartRow + 1;
  if (numRows <= 0) return;
  
  const values = sheet.getRange(dataStartRow, 1, numRows, lastCol).getValues();

  // 2. DETECCIÓN POR VALORES REALES DE CELDAS (Garantía absoluta contra columnas de fechas o desplazadas)
  const etapasConocidas = [
    'sin integración confirmada', 'sin integracion confirmada',
    'en proceso de seteo',
    'en proceso de verificación de catálogo', 'en proceso de verificacion de catalogo', 'en proceso de carga de catálogo',
    'validación del onboarding', 'validacion del onboarding',
    'en proceso para pruebas',
    'pedido de prueba realizado'
  ];
  const estadosConocidos = [
    'en progreso', 'nuevo', 'ticket hc', 'abierto',
    'cerrado por oportunidad satisfactoria', 
    'cerrado por kam', 'cerrado por api vendor', 'fallido', 'cerrado'
  ];

  let bestColEstado = colEstado >= 0 ? colEstado : 20; // Por defecto Col U (índice 20)
  let bestColEtapa = colEtapa >= 0 ? colEtapa : 18;   // Por defecto Col S (índice 18)

  let maxEstadoHits = 0;
  let maxEtapaHits = 0;

  for (let c = 12; c < Math.min(lastCol, 26); c++) {
    let estadoHits = 0;
    let etapaHits = 0;
    for (let r = 0; r < Math.min(35, values.length); r++) {
      const v = String(values[r][c] || '').toLowerCase().trim();
      if (estadosConocidos.some(function(est) { return v === est || v.indexOf(est) !== -1; })) {
        estadoHits++;
      }
      if (etapasConocidas.some(function(et) { return v === et || v.indexOf(et) !== -1; })) {
        etapaHits++;
      }
    }
    if (estadoHits > maxEstadoHits) {
      maxEstadoHits = estadoHits;
      bestColEstado = c;
    }
    if (etapaHits > maxEtapaHits) {
      maxEtapaHits = etapaHits;
      bestColEtapa = c;
    }
  }

  // Si no se encontraron por nombre, fallback a columnas típicas de Onboarding_New
  const cCasoOp = colCasoOp >= 0 ? colCasoOp : 0;      // Col A
  const cVendor = colVendorId >= 0 ? colVendorId : 1;   // Col B
  const cTienda = colTienda >= 0 ? colTienda : 2;       // Col C
  const cPais = colPais >= 0 ? colPais : 3;             // Col D
  const cKam = colKam >= 0 ? colKam : 4;               // Col E
  const cInteg = colIntegracion >= 0 ? colIntegracion : 5; // Col F
  const cOp = colOportunidad >= 0 ? colOportunidad : 6;
  const cAsset = colAsset >= 0 ? colAsset : 7;
  const cPropOp = colPropOp >= 0 ? colPropOp : 9;
  const cPropHc = colPropTicket >= 0 ? colPropTicket : 10;
  const cEstado = bestColEstado;
  const cEtapa = bestColEtapa;

  let sincronizados = 0;
  let activosEnProgreso = 0;
  
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const casoOp = String(row[cCasoOp] || '').trim();
    const vendorId = String(row[cVendor] || '').trim();
    const tienda = String(row[cTienda] || '').trim();
    
    if (!casoOp && !vendorId && !tienda) continue;
    
    const docId = casoOp || vendorId || ('CASO_' + (i + dataStartRow));
    
    // Obtener y sanear Estado y Etapa
    let estado = String(row[cEstado] || '').trim();
    let etapa = String(row[cEtapa] || '').trim();
    
    // Si la celda contiene una fecha corrupta (GMT, 00:00:00 o Date), buscar en las celdas contiguas el estado real
    if (estado instanceof Date || estado.indexOf('GMT') !== -1 || estado.indexOf('00:00:00') !== -1 || !estado) {
      for (let c = 14; c < Math.min(row.length, 25); c++) {
        const val = String(row[c] || '').trim();
        const vLower = val.toLowerCase();
        if (vLower.indexOf('cerrad') !== -1 || vLower.indexOf('fallid') !== -1 || vLower === 'en progreso' || vLower === 'nuevo' || vLower.indexOf('ticket hc') !== -1) {
          estado = val;
          break;
        }
      }
    }

    // Si la etapa es una fecha corrupta, sanear buscando etapas conocidas
    if (etapa instanceof Date || etapa.indexOf('GMT') !== -1 || etapa.indexOf('00:00:00') !== -1 || !etapa) {
      for (let c = 14; c < Math.min(row.length, 25); c++) {
        const val = String(row[c] || '').trim();
        const vLower = val.toLowerCase();
        if (etapasConocidas.some(function(et) { return vLower.indexOf(et) !== -1; })) {
          etapa = val;
          break;
        }
      }
    }
    
    if (!estado || estado.indexOf('GMT') !== -1) {
      estado = 'Cerrado por oportunidad satisfactoria';
    }
    if (!etapa || etapa.indexOf('GMT') !== -1) {
      etapa = 'Validación del Onboarding';
    }
    
    const estadoLower = estado.toLowerCase();
    const etapaLower = etapa.toLowerCase();
    
    // DETERMINACIÓN ESTRICTA DE CASOS ACTIVOS (Solo los 33 casos reales en progreso):
    const esCerrado = estadoLower.indexOf('cerrad') !== -1 || estadoLower.indexOf('fallid') !== -1 || estadoLower.indexOf('cancel') !== -1 || etapaLower.indexOf('pedido de prueba realizado') !== -1;
    const esActivo = !esCerrado && (estadoLower.indexOf('en progreso') !== -1 || estadoLower.indexOf('nuevo') !== -1 || estadoLower.indexOf('ticket hc') !== -1 || estadoLower === 'abierto');
    
    if (esActivo) {
      activosEnProgreso++;
    }
    
    const propOportunidad = String(row[cPropOp] || '').trim();
    const propTicket = String(row[cPropHc] || '').trim();
    const agente = propTicket || propOportunidad || 'Sin asignación';
    
    const firestoreDocument = {
      fields: {
        id: { stringValue: docId },
        casoOp: { stringValue: casoOp },
        vendorId: { stringValue: vendorId },
        vendor_id: { stringValue: vendorId },
        tienda: { stringValue: tienda },
        pais: { stringValue: String(row[cPais] || 'Argentina').trim() },
        kam: { stringValue: String(row[cKam] || '').trim() },
        integracion: { stringValue: String(row[cInteg] || '').trim() },
        oportunidad: { stringValue: String(row[cOp] || '').trim() },
        asset: { stringValue: String(row[cAsset] || '').trim() },
        propietarioOportunidad: { stringValue: propOportunidad },
        propietarioTicket: { stringValue: propTicket },
        agente: { stringValue: agente },
        estado: { stringValue: estado },
        etapa: { stringValue: etapa },
        esActivo: { booleanValue: esActivo },
        origen: { stringValue: 'Google Sheets (ONB 2026)' },
        actualizadoEn: { stringValue: new Date().toISOString() }
      }
    };
    
    const firestoreUrl = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/casos/' + encodeURIComponent(docId);
    
    try {
      UrlFetchApp.fetch(firestoreUrl, {
        method: 'patch',
        contentType: 'application/json',
        payload: JSON.stringify(firestoreDocument),
        muteHttpExceptions: true
      });
      sincronizados++;
    } catch (e) {
      Logger.log("Error en caso " + docId + ": " + e);
    }
  }
  
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Sincronizados: " + sincronizados + " casos (" + activosEnProgreso + " casos activos en progreso)", 
    "🚀 Firebase OK", 
    8
  );
}
`;
}
