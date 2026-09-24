import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { limpiarTextoEtapa } from '../utils/onboardingRules';

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
      let etapaLimpia = limpiarTextoEtapa(caso.etapa, caso.comentarios, caso.integracion);
      
      // Si el estado viene con una fecha corrupta (GMT...), sanear
      if (estadoLimpio.includes('GMT') || estadoLimpio.includes('00:00:00') || !estadoLimpio) {
        estadoLimpio = 'En progreso';
      }

      const estLower = estadoLimpio.toLowerCase();
      const esCerrado = estLower.includes('cerrad') || estLower.includes('fallid') || estLower.includes('cancel');
      const esActivo = !esCerrado && (estLower.includes('progreso') || estLower === 'abierto' || estLower === 'nuevo' || !estLower);

      const payload = {
        id: docId,
        casoOp: caso.casoOp || docId,
        vendorId: caso.vendorId || caso.vendor_id || '',
        vendor_id: caso.vendorId || caso.vendor_id || '',
        tienda: caso.tienda || '',
        pais: caso.pais || 'Argentina',
        kam: caso.kam || '',
        integracion: caso.integracion || '',
        sponsorship: caso.sponsorship || 'NO',
        descuentosBajoEstructuraSponsorship: caso.descuentosBajoEstructuraSponsorship || caso.sponsorship || 'NO',
        oportunidad: caso.oportunidad || '',
        asset: caso.asset || 'Integración',
        casoSeguimiento: caso.casoSeguimiento || '',
        propietarioOportunidad: caso.propietarioOportunidad || '',
        propietarioTicket: caso.propietarioTicket || '',
        agente: caso.agente || caso.propietarioTicket || caso.propietarioOportunidad || 'Sin asignación',
        tieneCasoInicio: caso.tieneCasoInicio || 'Si',
        comentarios: caso.comentarios || '',
        fechaCreacion: caso.fechaCreacion || new Date().toISOString().split('T')[0],
        fechaInicioSeguimientoOP: caso.fechaInicioSeguimientoOP || '',
        fechaCierre: caso.fechaCierre || '',
        fechaInicioPos: caso.fechaInicioPos || '',
        fechaPushPos: caso.fechaPushPos || '',
        respuestaPos: caso.respuestaPos || '',
        pushKamPos: Boolean(caso.pushKamPos),
        fechaInicioCat: caso.fechaInicioCat || '',
        fechaPushCat: caso.fechaPushCat || '',
        respuestaCat: caso.respuestaCat || '',
        pushKamCat: Boolean(caso.pushKamCat),
        freezePos: caso.freezePos || '',
        freezeCat: caso.freezeCat || '',
        tiempoTranscurridoOp: caso.tiempoTranscurridoOp || '',
        tiempoTranscurridoPos: caso.tiempoTranscurridoPos || '',
        tiempoTranscurridoCat: caso.tiempoTranscurridoCat || '',
        mesCierre: caso.mesCierre || '',
        rangoSla: caso.rangoSla || '',
        rangoSlaPos: caso.rangoSlaPos || '',
        rangoSlaCat: caso.rangoSlaCat || '',
        duplicadoTicket: caso.duplicadoTicket || '',
        reingreso: caso.reingreso || '',
        estado: estadoLimpio || 'En progreso',
        etapa: etapaLimpia || 'Sin integración confirmada',
        sla_inicio: caso.sla_inicio || caso.fechaInicioSeguimientoOP || caso.fechaCreacion || new Date().toISOString(),
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
 * SCRIPT DE AUTOMATIZACIÓN Y SINCRONIZACIÓN CON FIREBASE - TABLA ONBOARDING_NEW
 * ==============================================================================
 * Integra al 100% las reglas de negocio oficiales de la tabla Onboarding_New:
 * 1. onEdit(e): Reglas de cierre OP, salto de etapa (S/V), avance lineal y freeze SLA.
 * 2. Sincronización instantánea con Firebase Firestore (< 1s por edición).
 * 3. Menú "🚀 Firebase ONB" y sincronización batch para todos los usuarios.
 * 4. Activador automático en segundo plano y botón de hoja para sync rápida.
 */

const NOMBRE_HOJA = "Onboarding_New";
const PROJECT_ID = "peya-onb";

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 Firebase ONB')
    .addItem('⚡ Sincronizar Casos de Hoy', 'sincronizarCasosRecientes')
    .addItem('☁️ Sincronizar Todo a Firebase', 'sincronizarCasosAFirebase')
    .addItem('⏰ Activar Sincronización Automática (1 min)', 'instalarActivadorAutomatico')
    .addToUi();

  try {
    instalarActivadorAutomatico();
  } catch (e) {
    Logger.log("Info activador: " + e);
  }
}

/**
 * Disparador instantáneo al editar la pestaña 'Onboarding_New' (Fila >= 3)
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== NOMBRE_HOJA) return;

  const row = e.range.getRow(), numRows = e.range.getNumRows();
  const col = e.range.getColumn(), numCols = e.range.getNumColumns();
  const lastCol = col + numCols - 1;

  // Columnas exactas según la documentación técnica oficial:
  const COL_ESTADO_CASO = 15; // O
  const COL_ESTADO_ONB = 16;  // P
  const COL_FECHA_CIERRE = 19; // S
  const COL_INICIO_POS = 20;   // T
  const COL_PUSH_POS = 21;     // U
  const COL_RESP_POS = 22;     // V
  const COL_CHECK_POS = 23;    // W
  const COL_INICIO_CAT = 24;   // X
  const COL_PUSH_CAT = 25;     // Y
  const COL_RESP_CAT = 26;     // Z
  const COL_CHECK_CAT = 27;    // AA
  const COL_FREEZE_POS = 40;   // AN (oculta)
  const COL_FREEZE_CAT = 41;   // AO (oculta)

  const primeraFila = Math.max(row, 3);
  const ultimaFila = row + numRows - 1;
  if (ultimaFila < 3) return;
  const filas = ultimaFila - primeraFila + 1;

  // Si la edición está en el rango de estados/seguimientos, aplicar reglas de negocio
  if (lastCol >= COL_ESTADO_CASO && col <= COL_CHECK_CAT) {
    const editaEstadoCaso = col <= COL_ESTADO_CASO && lastCol >= COL_ESTADO_CASO;
    const editaEstadoOnb = col <= COL_ESTADO_ONB && lastCol >= COL_ESTADO_ONB;
    const editaInicioPOS = col <= COL_INICIO_POS && lastCol >= COL_INICIO_POS;
    const editaInicioCAT = col <= COL_INICIO_CAT && lastCol >= COL_INICIO_CAT;
    const editaRespPOS = col <= COL_RESP_POS && lastCol >= COL_RESP_POS;
    const editaRespCAT = col <= COL_RESP_CAT && lastCol >= COL_RESP_CAT;

    const rangoBloque = sheet.getRange(primeraFila, COL_ESTADO_CASO, filas, 13);
    const datos = rangoBloque.getValues();
    const rangoFreeze = sheet.getRange(primeraFila, COL_FREEZE_POS, filas, 2);
    const freeze = rangoFreeze.getValues();

    const estadosAmbos = ["Validación del Onboarding", "En proceso para pruebas", "Pedido de prueba realizado"];
    const estadosSoloPOS = ["En proceso de verificación de catálogo"];

    for (let i = 0; i < filas; i++) {
      const d = datos[i];
      const estadoCaso = texto(d[0]);
      const estadoOnb = texto(d[1]);
      let inicioPOS = d[5], pushPOS = d[6], respPOS = normalizarRespuesta(d[7]), checkPOS = d[8];
      let inicioCAT = d[9], pushCAT = d[10], respCAT = normalizarRespuesta(d[11]), checkCAT = d[12];

      // C. Fecha de cierre de OP
      if (editaEstadoCaso) {
        d[4] = (estadoCaso === "" || estadoCaso === "Nuevo" || estadoCaso === "En progreso" || estadoCaso === "En progreso (sin oportunidad)") ? "" : new Date();
      }

      // D. Estado del onboarding -> S/V TOTAL solo si nunca inició el seguimiento
      if (editaEstadoOnb) {
        if (estadosAmbos.indexOf(estadoOnb) !== -1) {
          if (!tieneValor(inicioPOS)) {
            inicioPOS = "S/V"; pushPOS = "S/V"; respPOS = "S/V"; checkPOS = true;
          }
          if (!tieneValor(inicioCAT)) {
            inicioCAT = "S/V"; pushCAT = "S/V"; respCAT = "S/V"; checkCAT = true;
          }
        } else if (estadosSoloPOS.indexOf(estadoOnb) !== -1) {
          if (!tieneValor(inicioPOS)) {
            inicioPOS = "S/V"; pushPOS = "S/V"; respPOS = "S/V"; checkPOS = true;
          }
        }
      }

      // A. Fecha de inicio POS API
      if (editaInicioPOS) {
        const f = parsearFecha(inicioPOS);
        if (f) inicioPOS = f;
      }

      // B. Fecha de inicio Catálogo
      if (editaInicioCAT) {
        const f = parsearFecha(inicioCAT);
        if (f) inicioCAT = f;
      }

      // REGLAS DE AVANCE LINEAL
      let procesarRespPOS = editaRespPOS;
      if (tieneValor(inicioPOS) && estadoOnb !== "") {
        const esperandoPOS = (estadoOnb === "Sin integración confirmada" || estadoOnb === "En proceso de seteo");
        if (!esperandoPOS) {
          if (respPOS !== "Si") { respPOS = "Si"; procesarRespPOS = true; }
        } else if (esperandoPOS && tieneValor(pushPOS)) {
          if (respPOS !== "No") { respPOS = "No"; procesarRespPOS = true; }
        }
      }

      let procesarRespCAT = editaRespCAT;
      if (tieneValor(inicioCAT) && estadoOnb !== "") {
        const esperandoCAT = (estadoOnb === "En proceso de verificación de catálogo");
        const avanzadosCAT = ["Validación del Onboarding", "En proceso para pruebas", "Pedido de prueba realizado"];
        if (avanzadosCAT.indexOf(estadoOnb) !== -1) {
          if (respCAT !== "Si") { respCAT = "Si"; procesarRespCAT = true; }
        } else if (esperandoCAT && tieneValor(pushCAT)) {
          if (respCAT !== "No") { respCAT = "No"; procesarRespCAT = true; }
        }
      }

      // Procesar Respuesta POS API
      if (procesarRespPOS) {
        if (respPOS === "Si") {
          checkPOS = true;
          if (!esFecha(pushPOS)) pushPOS = "S/V";
          if (!esFecha(freeze[i][0])) freeze[i][0] = new Date();
        } else if (respPOS === "No") {
          checkPOS = false;
          if (!esFecha(pushPOS) && texto(pushPOS).toUpperCase() === "S/V") pushPOS = "";
          freeze[i][0] = "";
        } else if (respPOS === "S/V") {
          checkPOS = true;
          if (estaVacio(pushPOS)) pushPOS = "S/V";
          freeze[i][0] = "";
        }
      }

      // Procesar Respuesta Catálogo
      if (procesarRespCAT) {
        if (respCAT === "Si") {
          checkCAT = true;
          if (!esFecha(pushCAT)) pushCAT = "S/V";
          if (!esFecha(freeze[i][1])) freeze[i][1] = new Date();
        } else if (respCAT === "No") {
          checkCAT = false;
          if (!esFecha(pushCAT) && texto(pushCAT).toUpperCase() === "S/V") pushCAT = "";
          freeze[i][1] = "";
        } else if (respCAT === "S/V") {
          checkCAT = true;
          if (estaVacio(pushCAT)) pushCAT = "S/V";
          freeze[i][1] = "";
        }
      }

      d[5] = inicioPOS; d[6] = pushPOS; d[7] = normalizarRespuesta(respPOS); d[8] = checkPOS;
      d[9] = inicioCAT; d[10] = pushCAT; d[11] = normalizarRespuesta(respCAT); d[12] = checkCAT;
    }

    rangoBloque.setValues(datos);
    rangoFreeze.setValues(freeze);
  }

  // Sincronizar automáticamente la(s) fila(s) editadas a Firestore en tiempo real
  for (let r = primeraFila; r <= ultimaFila; r++) {
    try {
      sincronizarFilaAFirebase(sheet, r);
    } catch(errSync) {
      Logger.log("Error sync fila " + r + ": " + errSync);
    }
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

function parsearFilaCaso(row, filaNumero) {
  // Posiciones fijas según estructura normalizada Onboarding_New:
  const casoOp = texto(row[0]);      // A: N° Caso OP
  const vendorId = texto(row[1]);    // B: ID
  const tienda = texto(row[2]);      // C: Tienda
  const pais = texto(row[3]) || 'Argentina'; // D: País
  const kam = texto(row[4]);         // E: Kam
  const integracion = texto(row[5]); // F: Integración
  const sponsorship = texto(row[6]) || 'NO'; // G: Descuentos Sponsorship
  const oportunidad = texto(row[7]); // H: Oportunidad
  const asset = texto(row[8]) || 'Integración'; // I: Asset
  const propOp = texto(row[9]);      // J: Propietario Oportunidad
  const propHc = texto(row[10]);     // K: Propietario de Ticket HeroCare
  const casoSeguimiento = texto(row[11]); // L: N° Caso Seguimiento
  const tieneInicio = texto(row[12]) || 'Si'; // M: ¿Tiene caso de onboarding en inicio?
  const comentarios = texto(row[13]); // N: Comentarios del Onboarding
  let estado = texto(row[14]);       // O: Estado del caso
  let etapa = texto(row[15]);        // P: Etapa del onboarding
  const fechaCreacion = formatearFechaStr(row[16]); // Q: Fecha de creación OP
  const fechaInicioSeg = formatearFechaStr(row[17]); // R: Fecha de inicio de seguimiento OP
  const fechaCierre = formatearFechaStr(row[18]); // S: Fecha de cierre OP
  const fechaInicioPos = formatearFechaStr(row[19]); // T: Inicio POS
  const fechaPushPos = formatearFechaStr(row[20]);   // U: Push POS
  const respPos = texto(row[21]);    // V: Resp POS
  const checkPos = Boolean(row[22]); // W: Push KAM POS
  const fechaInicioCat = formatearFechaStr(row[23]); // X: Inicio Cat
  const fechaPushCat = formatearFechaStr(row[24]);   // Y: Push Cat
  const respCat = texto(row[25]);    // Z: Resp Cat
  const checkCat = Boolean(row[26]); // AA: Push KAM Cat
  const tiempoTranscurridoOp = texto(row[30]); // AE: Tiempo Transcurrido L-V OP
  const tiempoTranscurridoPos = texto(row[31]); // AF: Tiempo Transcurrido L-V POS
  const tiempoTranscurridoCat = texto(row[32]); // AG: Tiempo Transcurrido L-V Catálogo
  const mesCierre = texto(row[33]);            // AH: Mes de Cierre OP
  const rangoSla = texto(row[34]);             // AI: Rango SLA (Horas) OP
  const rangoSlaPos = texto(row[35]);          // AJ: Rango SLA (Horas) POS
  const rangoSlaCat = texto(row[36]);          // AK: Rango SLA (Horas) Catálogo
  const duplicadoTicket = texto(row[37]);      // AL: Variable Duplicado
  const reingreso = texto(row[38]);            // AM: Reingreso
  const freezePos = formatearFechaStr(row[39]); // AN: Freeze POS
  const freezeCat = formatearFechaStr(row[40]); // AO: Freeze Cat

  if (!casoOp && !vendorId && !tienda) return null;

  const docId = casoOp || vendorId || ('CASO_' + filaNumero);

  if (!estado || estado.includes('GMT') || estado.includes('00:00:00')) estado = 'En progreso';
  
  const etapaLower = etapa.toLowerCase();
  if (!etapa || etapaLower === 'si' || etapaLower === 'no' || etapa.includes('GMT') || etapa.includes('00:00:00')) {
    const com = comentarios.toLowerCase();
    const integ = integracion.toLowerCase();
    if (com.includes('configurcion api') || com.includes('configuracion api') || com.includes('datos faltantes') || com.includes('pos') || integ.includes('pend')) {
      etapa = 'Sin integración confirmada';
    } else if (com.includes('catálogo') || com.includes('catalogo') || com.includes('menu')) {
      etapa = 'En proceso de verificación de catálogo';
    } else if (com.includes('prueba')) {
      etapa = 'En proceso para pruebas';
    } else {
      etapa = 'Sin integración confirmada';
    }
  }

  const estadoLower = estado.toLowerCase();
  const esCerrado = estadoLower.indexOf('cerrad') !== -1 || estadoLower.indexOf('fallid') !== -1 || estadoLower.indexOf('cancel') !== -1;
  const esActivo = !esCerrado && (estadoLower.indexOf('progreso') !== -1 || estadoLower === 'abierto' || estadoLower === 'nuevo');

  return {
    docId: docId,
    casoOp: casoOp || docId,
    vendorId: vendorId,
    vendor_id: vendorId,
    tienda: tienda,
    pais: pais,
    kam: kam,
    integracion: integracion,
    sponsorship: sponsorship,
    descuentosBajoEstructuraSponsorship: sponsorship,
    oportunidad: oportunidad,
    asset: asset,
    propietarioOportunidad: propOp,
    propietarioTicket: propHc,
    agente: propHc || propOp || 'Sin asignación',
    casoSeguimiento: casoSeguimiento,
    tieneCasoInicio: tieneInicio,
    comentarios: comentarios,
    estado: estado,
    etapa: etapa,
    fechaCreacion: fechaCreacion || new Date().toISOString().split('T')[0],
    fechaInicioSeguimientoOP: fechaInicioSeg,
    sla_inicio: fechaInicioSeg || fechaCreacion || new Date().toISOString(),
    fechaCierre: fechaCierre,
    fechaInicioPos: fechaInicioPos,
    fechaPushPos: fechaPushPos,
    respuestaPos: respPos,
    pushKamPos: checkPos,
    fechaInicioCat: fechaInicioCat,
    fechaPushCat: fechaPushCat,
    respuestaCat: respCat,
    pushKamCat: checkCat,
    freezePos: freezePos,
    freezeCat: freezeCat,
    tiempoTranscurridoOp: tiempoTranscurridoOp,
    tiempoTranscurridoPos: tiempoTranscurridoPos,
    tiempoTranscurridoCat: tiempoTranscurridoCat,
    mesCierre: mesCierre,
    rangoSla: rangoSla,
    rangoSlaPos: rangoSlaPos,
    rangoSlaCat: rangoSlaCat,
    duplicadoTicket: duplicadoTicket,
    reingreso: reingreso,
    esActivo: esActivo,
    origen: 'Google Sheets (Tiempo Real)',
    actualizadoEn: new Date().toISOString()
  };
}

function sincronizarFilaAFirebase(sheet, rowNum) {
  const lastCol = Math.max(sheet.getLastColumn(), 42);
  const rowData = sheet.getRange(rowNum, 1, 1, lastCol).getValues()[0];
  const parsed = parsearFilaCaso(rowData, rowNum);
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
      sponsorship: { stringValue: parsed.sponsorship },
      descuentosBajoEstructuraSponsorship: { stringValue: parsed.sponsorship },
      oportunidad: { stringValue: parsed.oportunidad },
      asset: { stringValue: parsed.asset },
      propietarioOportunidad: { stringValue: parsed.propietarioOportunidad },
      propietarioTicket: { stringValue: parsed.propietarioTicket },
      agente: { stringValue: parsed.agente },
      casoSeguimiento: { stringValue: parsed.casoSeguimiento },
      tieneCasoInicio: { stringValue: parsed.tieneCasoInicio },
      comentarios: { stringValue: parsed.comentarios },
      estado: { stringValue: parsed.estado },
      etapa: { stringValue: parsed.etapa },
      fechaCreacion: { stringValue: parsed.fechaCreacion },
      fechaInicioSeguimientoOP: { stringValue: parsed.fechaInicioSeguimientoOP || '' },
      sla_inicio: { stringValue: parsed.sla_inicio },
      fechaCierre: { stringValue: parsed.fechaCierre || '' },
      fechaInicioPos: { stringValue: parsed.fechaInicioPos || '' },
      fechaPushPos: { stringValue: parsed.fechaPushPos || '' },
      respuestaPos: { stringValue: parsed.respuestaPos || '' },
      pushKamPos: { booleanValue: parsed.pushKamPos },
      fechaInicioCat: { stringValue: parsed.fechaInicioCat || '' },
      fechaPushCat: { stringValue: parsed.fechaPushCat || '' },
      respuestaCat: { stringValue: parsed.respuestaCat || '' },
      pushKamCat: { booleanValue: parsed.pushKamCat },
      freezePos: { stringValue: parsed.freezePos || '' },
      freezeCat: { stringValue: parsed.freezeCat || '' },
      tiempoTranscurridoOp: { stringValue: parsed.tiempoTranscurridoOp || '' },
      tiempoTranscurridoPos: { stringValue: parsed.tiempoTranscurridoPos || '' },
      tiempoTranscurridoCat: { stringValue: parsed.tiempoTranscurridoCat || '' },
      mesCierre: { stringValue: parsed.mesCierre || '' },
      rangoSla: { stringValue: parsed.rangoSla || '' },
      rangoSlaPos: { stringValue: parsed.rangoSlaPos || '' },
      rangoSlaCat: { stringValue: parsed.rangoSlaCat || '' },
      duplicadoTicket: { stringValue: parsed.duplicadoTicket || '' },
      reingreso: { stringValue: parsed.reingreso || '' },
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
  const sheet = ss.getSheetByName(NOMBRE_HOJA) || ss.getSheetByName("Onboarding") || ss.getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return;

  const dataStartRow = Math.max(3, lastRow - 150);
  const numRows = lastRow - dataStartRow + 1;
  const lastCol = Math.max(sheet.getLastColumn(), 42);
  const values = sheet.getRange(dataStartRow, 1, numRows, lastCol).getValues();

  const writes = [];
  for (let i = 0; i < values.length; i++) {
    const parsed = parsearFilaCaso(values[i], dataStartRow + i);
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
          sponsorship: { stringValue: parsed.sponsorship },
          descuentosBajoEstructuraSponsorship: { stringValue: parsed.sponsorship },
          oportunidad: { stringValue: parsed.oportunidad },
          asset: { stringValue: parsed.asset },
          propietarioOportunidad: { stringValue: parsed.propietarioOportunidad },
          propietarioTicket: { stringValue: parsed.propietarioTicket },
          agente: { stringValue: parsed.agente },
          casoSeguimiento: { stringValue: parsed.casoSeguimiento },
          tieneCasoInicio: { stringValue: parsed.tieneCasoInicio },
          comentarios: { stringValue: parsed.comentarios },
          estado: { stringValue: parsed.estado },
          etapa: { stringValue: parsed.etapa },
          fechaCreacion: { stringValue: parsed.fechaCreacion },
          fechaInicioSeguimientoOP: { stringValue: parsed.fechaInicioSeguimientoOP || '' },
          sla_inicio: { stringValue: parsed.sla_inicio },
          fechaCierre: { stringValue: parsed.fechaCierre || '' },
          fechaInicioPos: { stringValue: parsed.fechaInicioPos || '' },
          fechaPushPos: { stringValue: parsed.fechaPushPos || '' },
          respuestaPos: { stringValue: parsed.respuestaPos || '' },
          pushKamPos: { booleanValue: parsed.pushKamPos },
          fechaInicioCat: { stringValue: parsed.fechaInicioCat || '' },
          fechaPushCat: { stringValue: parsed.fechaPushCat || '' },
          respuestaCat: { stringValue: parsed.respuestaCat || '' },
          pushKamCat: { booleanValue: parsed.pushKamCat },
          freezePos: { stringValue: parsed.freezePos || '' },
          freezeCat: { stringValue: parsed.freezeCat || '' },
          tiempoTranscurridoOp: { stringValue: parsed.tiempoTranscurridoOp || '' },
          tiempoTranscurridoPos: { stringValue: parsed.tiempoTranscurridoPos || '' },
          tiempoTranscurridoCat: { stringValue: parsed.tiempoTranscurridoCat || '' },
          mesCierre: { stringValue: parsed.mesCierre || '' },
          rangoSla: { stringValue: parsed.rangoSla || '' },
          rangoSlaPos: { stringValue: parsed.rangoSlaPos || '' },
          rangoSlaCat: { stringValue: parsed.rangoSlaCat || '' },
          duplicadoTicket: { stringValue: parsed.duplicadoTicket || '' },
          reingreso: { stringValue: parsed.reingreso || '' },
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
  const sheet = ss.getSheetByName(NOMBRE_HOJA) || ss.getSheetByName("Onboarding") || ss.getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) {
    ss.toast("No hay filas de datos", "Aviso");
    return;
  }

  const dataStartRow = 3;
  const numRows = lastRow - dataStartRow + 1;
  const lastCol = Math.max(sheet.getLastColumn(), 42);
  const values = sheet.getRange(dataStartRow, 1, numRows, lastCol).getValues();

  let todosCasos = [];
  for (let i = 0; i < values.length; i++) {
    const parsed = parsearFilaCaso(values[i], dataStartRow + i);
    if (parsed) todosCasos.push(parsed);
  }

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
            sponsorship: { stringValue: c.sponsorship },
            descuentosBajoEstructuraSponsorship: { stringValue: c.sponsorship },
            oportunidad: { stringValue: c.oportunidad },
            asset: { stringValue: c.asset },
            propietarioOportunidad: { stringValue: c.propietarioOportunidad },
            propietarioTicket: { stringValue: c.propietarioTicket },
            agente: { stringValue: c.agente },
            casoSeguimiento: { stringValue: c.casoSeguimiento },
            tieneCasoInicio: { stringValue: c.tieneCasoInicio },
            comentarios: { stringValue: c.comentarios },
            estado: { stringValue: c.estado },
            etapa: { stringValue: c.etapa },
            fechaCreacion: { stringValue: c.fechaCreacion },
            fechaInicioSeguimientoOP: { stringValue: c.fechaInicioSeguimientoOP || '' },
            sla_inicio: { stringValue: c.sla_inicio },
            fechaCierre: { stringValue: c.fechaCierre || '' },
            fechaInicioPos: { stringValue: c.fechaInicioPos || '' },
            fechaPushPos: { stringValue: c.fechaPushPos || '' },
            respuestaPos: { stringValue: c.respuestaPos || '' },
            pushKamPos: { booleanValue: c.pushKamPos },
            fechaInicioCat: { stringValue: c.fechaInicioCat || '' },
            fechaPushCat: { stringValue: c.fechaPushCat || '' },
            respuestaCat: { stringValue: c.respuestaCat || '' },
            pushKamCat: { booleanValue: c.pushKamCat },
            freezePos: { stringValue: c.freezePos || '' },
            freezeCat: { stringValue: c.freezeCat || '' },
            tiempoTranscurridoOp: { stringValue: c.tiempoTranscurridoOp || '' },
            tiempoTranscurridoPos: { stringValue: c.tiempoTranscurridoPos || '' },
            tiempoTranscurridoCat: { stringValue: c.tiempoTranscurridoCat || '' },
            mesCierre: { stringValue: c.mesCierre || '' },
            rangoSla: { stringValue: c.rangoSla || '' },
            rangoSlaPos: { stringValue: c.rangoSlaPos || '' },
            rangoSlaCat: { stringValue: c.rangoSlaCat || '' },
            duplicadoTicket: { stringValue: c.duplicadoTicket || '' },
            reingreso: { stringValue: c.reingreso || '' },
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

// --- FUNCIONES AUXILIARES ---

function parsearFecha(val) {
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === "number") {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  if (typeof val === "string") {
    const s = val.trim();
    if (s === "" || s.toUpperCase() === "S/V") return null;
    let d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    const m = s.match(new RegExp('^(\\\\d{1,2})[/\\\\-](\\\\d{1,2})[/\\\\-](\\\\d{2,4})(?:[ T](\\\\d{1,2}):(\\\\d{2})(?::(\\\\d{2}))?)?$'));
    if (m) {
      const dd = parseInt(m[1], 10), mm = parseInt(m[2], 10) - 1;
      let yyyy = parseInt(m[3], 10);
      if (yyyy < 100) yyyy += 2000;
      const hh = m[4] ? parseInt(m[4], 10) : 0, mi = m[5] ? parseInt(m[5], 10) : 0, ss = m[6] ? parseInt(m[6], 10) : 0;
      const d2 = new Date(yyyy, mm, dd, hh, mi, ss);
      if (!isNaN(d2.getTime())) return d2;
    }
    return null;
  }
  return null;
}

function esFecha(valor) {
  return valor instanceof Date && !isNaN(valor.getTime());
}

function estaVacio(valor) {
  return valor === "" || valor === null || typeof valor === "undefined";
}

function tieneValor(valor) {
  return !estaVacio(valor) && texto(valor).toUpperCase() !== "S/V";
}

function texto(valor) {
  return valor === null || typeof valor === "undefined" ? "" : String(valor).trim();
}

function normalizarRespuesta(valor) {
  const v = texto(valor).toLowerCase();
  if (v === "si") return "Si";
  if (v === "no") return "No";
  if (v === "s/v") return "S/V";
  return valor;
}

function formatearFechaStr(val) {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, "GMT-3", "yyyy-MM-dd HH:mm");
  }
  const s = String(val).trim();
  if (s === 'S/V' || s === '-') return s;
  return s;
}
`;
}
