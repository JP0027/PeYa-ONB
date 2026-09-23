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
        estado: caso.estado || 'En progreso',
        etapa: caso.etapa || 'Validación del Onboarding',
        sla_inicio: caso.sla_inicio || new Date().toISOString(),
        esActivo: typeof caso.esActivo === 'boolean' ? caso.esActivo : true,
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
 */
export function generarScriptAppsScriptParaFirebase() {
  return `/**
 * ==============================================================================
 * SCRIPT DE SINCRONIZACIÓN AUTOMÁTICA CON FIREBASE FIRESTORE (PEDIDOSYA ONB)
 * ==============================================================================
 * Este script se ejecuta DIRECTAMENTE DENTRO DE GOOGLE SHEETS con tus permisos corporativos.
 * Lee la hoja "Onboarding_New" y envía los casos directamente a Firebase Firestore.
 * 
 * INSTRUCCIONES DE USO:
 * 1. En Google Sheets ve a: Extensiones > Apps Script.
 * 2. Borra el código existente, pega este script completo y guarda (Ctrl+S).
 * 3. Cierra y recarga la hoja de Google Sheets.
 * 4. Aparecerá un menú arriba a la derecha: "🚀 Firebase ONB" > "☁️ Sincronizar Casos a Firebase".
 * 5. (Opcional): Para sincronización 100% automática cada 5 minutos:
 *    En Apps Script haz clic en el reloj de la izquierda (Activadores) > 
 *    Añadir activador > sincronizarCasosAFirebase > Basado en tiempo > Cada 5 minutos.
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
  if (lastRow < 3) {
    SpreadsheetApp.getActiveSpreadsheet().toast("No hay filas con datos en la hoja", "Aviso");
    return;
  }
  
  // Rango desde la fila 3 hasta la última fila, columnas A a Z
  const values = sheet.getRange(3, 1, lastRow - 2, 26).getValues();
  let enviados = 0;
  
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const casoOp = String(row[0] || '').trim(); // Col A: N° Caso OP
    const vendorId = String(row[1] || '').trim(); // Col B: ID / Vendor ID
    const tienda = String(row[2] || '').trim(); // Col C: Tienda
    
    // Si la fila está vacía, continuar
    if (!casoOp && !vendorId && !tienda) continue;
    
    const docId = casoOp || vendorId || ('CASO_' + (i + 3));
    const pais = String(row[3] || 'Argentina').trim();
    const kam = String(row[4] || '').trim();
    const integracion = String(row[5] || '').trim();
    const oportunidad = String(row[6] || '').trim();
    const asset = String(row[7] || '').trim();
    const propOportunidad = String(row[9] || '').trim();
    const propTicket = String(row[10] || '').trim();
    const agente = propTicket || propOportunidad || 'Sin asignación';
    const estado = String(row[17] || 'En progreso').trim();
    const etapa = String(row[18] || 'Validación del Onboarding').trim();
    
    // Estructura oficial de documento para Firestore REST API
    const firestoreDocument = {
      fields: {
        id: { stringValue: docId },
        casoOp: { stringValue: casoOp },
        vendorId: { stringValue: vendorId },
        vendor_id: { stringValue: vendorId },
        tienda: { stringValue: tienda },
        pais: { stringValue: pais },
        kam: { stringValue: kam },
        integracion: { stringValue: integracion },
        oportunidad: { stringValue: oportunidad },
        asset: { stringValue: asset },
        propietarioOportunidad: { stringValue: propOportunidad },
        propietarioTicket: { stringValue: propTicket },
        agente: { stringValue: agente },
        estado: { stringValue: estado },
        etapa: { stringValue: etapa },
        esActivo: { booleanValue: !estado.toLowerCase().includes('cerrado') && !estado.toLowerCase().includes('fallido') },
        origen: { stringValue: 'Google Sheets (ONB 2026)' },
        actualizadoEn: { stringValue: new Date().toISOString() }
      }
    };
    
    // Enviar a Firestore REST API
    const firestoreUrl = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/casos/' + encodeURIComponent(docId);
    
    try {
      UrlFetchApp.fetch(firestoreUrl, {
        method: 'patch',
        contentType: 'application/json',
        payload: JSON.stringify(firestoreDocument),
        muteHttpExceptions: true
      });
      enviados++;
    } catch (e) {
      Logger.log("Error enviando caso " + docId + ": " + e);
    }
  }
  
  SpreadsheetApp.getActiveSpreadsheet().toast("Se sincronizaron " + enviados + " casos con Firebase exitosamente.", "🚀 Firebase Actualizado");
}
`;
}
