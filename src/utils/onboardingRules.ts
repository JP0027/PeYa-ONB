/**
 * Reglas de Negocio Onboarding HeroCare (PedidosYa)
 * Implementación estricta de las 4 casuísticas del flujo de Onboarding
 */

import { 
  calcularFechaInicioSeguimientoOP, 
  esEstadoActivoOficial, 
  obtenerSponsorship,
  normalizarRespuesta
} from '../data/catalogoOnboarding';
import { analizarTiemposCaso } from './tiempoLaboral';

export { normalizarRespuesta };

// Normalización de fechas asegurando SIEMPRE fecha y hora (DD/MM/YYYY HH:mm:ss)
export function normalizarFecha(fechaStr: any): string {
  if (!fechaStr) return '';
  const str = String(fechaStr).trim();
  if (!str || str === 'S/V' || str === '-' || str.toUpperCase() === 'NULL') return str;

  // 1. Formato DD/MM/YYYY o DD-MM-YYYY con hora opcional (DD/MM/YYYY HH:mm:ss o DD/MM/YYYY HH:mm)
  const matchDDMM = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (matchDDMM) {
    const dia = parseInt(matchDDMM[1], 10);
    const mes = parseInt(matchDDMM[2], 10);
    let anio = parseInt(matchDDMM[3], 10);
    if (anio < 100) anio += 2000;
    const hora = matchDDMM[4] !== undefined ? String(matchDDMM[4]).padStart(2, '0') : null;
    const min = matchDDMM[5] !== undefined ? String(matchDDMM[5]).padStart(2, '0') : null;
    const seg = matchDDMM[6] !== undefined ? String(matchDDMM[6]).padStart(2, '0') : '00';
    if (hora !== null && min !== null) {
      return `${dia}/${mes}/${anio} ${hora}:${min}:${seg}`;
    }
    return `${dia}/${mes}/${anio}`;
  }

  // 2. Formato YYYY-MM-DD o YYYY/MM/DD con hora opcional
  const matchISO = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (matchISO) {
    const anio = parseInt(matchISO[1], 10);
    const mes = parseInt(matchISO[2], 10);
    const dia = parseInt(matchISO[3], 10);
    const hora = matchISO[4] !== undefined ? String(matchISO[4]).padStart(2, '0') : null;
    const min = matchISO[5] !== undefined ? String(matchISO[5]).padStart(2, '0') : null;
    const seg = matchISO[6] !== undefined ? String(matchISO[6]).padStart(2, '0') : '00';
    if (hora !== null && min !== null) {
      return `${dia}/${mes}/${anio} ${hora}:${min}:${seg}`;
    }
    return `${dia}/${mes}/${anio}`;
  }

  // 3. Fallback a objeto Date
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const dia = d.getDate();
    const mes = d.getMonth() + 1;
    const anio = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const seg = String(d.getSeconds()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${min}:${seg}`;
  }

  return str;
}

/**
 * Normaliza y limpia la etapa de Onboarding.
 * Evita valores corruptos como "Si", "No", fechas GMT, o defaults erróneos.
 * Si la etapa es desconocida o viene corrupta, detecta inteligentemente por comentarios o integración.
 */
export function limpiarTextoEtapa(etapa: any, comentarios: string = '', integracion: string = ''): string {
  const etStr = String(etapa || '').trim();
  const etLower = etStr.toLowerCase();

  // Si ya es un nombre de etapa válido oficial de la tabla
  if (
    etStr &&
    etLower !== 'si' &&
    etLower !== 'no' &&
    !etStr.includes('GMT') &&
    !etStr.includes('00:00:00') &&
    !/^\d{4}-\d{2}-\d{2}/.test(etStr)
  ) {
    return etStr;
  }

  // Deducir inteligentemente
  const com = String(comentarios || '').toLowerCase();
  const integ = String(integracion || '').toLowerCase();

  if (com.includes('baja') || etLower.includes('baja')) {
    if (etLower.includes('pedido') || com.includes('pedido')) return 'Pedido de prueba realizado (baja de integración)';
    return 'En proceso para pruebas (baja de integración)';
  }

  if (com.includes('sin go') || etLower.includes('sin go') || com.includes('oportunidad admin')) {
    return 'Solicitud de creación de oportunidad Admin (sin go)';
  }

  if (com.includes('sin configuraciones') || etLower.includes('sin configuraciones') || com.includes('sin config') || etLower.includes('sin config')) {
    return 'Sin configuraciones a nivel integración';
  }

  if (
    com.includes('configurcion api') ||
    com.includes('configuracion api') ||
    com.includes('datos faltantes') ||
    com.includes('pos') ||
    integ.includes('pend')
  ) {
    return 'Sin integración confirmada';
  }

  if (com.includes('catálogo') || com.includes('catalogo') || com.includes('menu') || com.includes('menú')) {
    return 'En proceso de verificación de catálogo';
  }

  if (com.includes('prueba') || com.includes('test')) {
    return 'En proceso para pruebas';
  }

  return 'Sin integración confirmada';
}

/**
 * Normaliza el estado del caso (evita que fechas se muestren como estado)
 */
export function limpiarTextoEstado(estado: any, _etapa?: any): string {
  const estStr = String(estado || '').trim();
  if (
    !estStr ||
    estStr.includes('GMT') ||
    estStr.includes('hora estándar') ||
    estStr.includes('00:00:00') ||
    /^\d{4}-\d{2}-\d{2}/.test(estStr)
  ) {
    return 'En progreso';
  }
  return estStr;
}

/**
 * 1. Casuísticas de Cierre de Oportunidad (OP)
 * - Si el Estado del caso es "En progreso" o "En progreso (Sin oportunidad)": 
 *   Sigue transcurriendo el tiempo de SLA y Fecha de Cierre permanece vacía o "-".
 * - Si el Estado cambia a cualquiera de los estados de Cerrado (Cerrado por ONB..., Cerrado por KAM..., Cerrado por API Vendor):
 *   Imprime la Fecha de cierre de OP y detiene el SLA.
 */
export function aplicarReglaCierre(nuevoEstado: any, fechaCierreActual: any): string {
  const est = String(nuevoEstado || '').trim().toLowerCase();
  const esAbierto = est === 'en progreso' || est === 'en progreso (sin oportunidad)' || est === 'nuevo' || est === '';

  if (esAbierto) {
    return '';
  } else {
    // Si es un estado cerrado, imprime fecha de cierre de OP para detener SLA
    return fechaCierreActual && fechaCierreActual !== '-' ? fechaCierreActual : new Date().toISOString().split('T')[0];
  }
}

export const ETAPAS_AVANZADAS_SIN_SEGUIMIENTO: string[] = [
  'validación del onboarding',
  'validacion del onboarding',
  'en proceso para pruebas',
  'pedido de prueba realizado',
  'en proceso para pruebas (baja de integración)',
  'en proceso para pruebas (baja de integracion)',
  'pedido de prueba realizado (baja de integración)',
  'pedido de prueba realizado (baja de integracion)',
  'solicitud de creación de oportunidad admin (sin go)',
  'solicitud de creacion de oportunidad admin (sin go)',
  'sin configuraciones a nivel integración',
  'sin configuraciones a nivel integracion'
];

/**
 * 2. Casuísticas de Relleno "S/V" por Salto de Etapa (Abandono/Omisión/Bajas)
 * Solo aplica si la etapa avanza o si la etapa no contempla seguimientos (se llena con "S/V").
 */
export function aplicarReglaSaltoEtapa(nuevaEtapa: any, casoActual: any): any {
  const cambios: any = {};
  const etapaStr = String(nuevaEtapa || '').trim().toLowerCase();

  const esEtapaAvanzada = ETAPAS_AVANZADAS_SIN_SEGUIMIENTO.some(e => etapaStr.includes(e));
  const esVerificacionCatalogo = etapaStr.includes('verificación de catálogo') || etapaStr.includes('verificacion de catalogo');

  // Si avanza a Validación del Onboarding, En proceso para pruebas, Bajas de integración, etc.:
  if (esEtapaAvanzada) {
    // Para POS API: Si no hay Fecha de Inicio o está en S/V, rellena Inicio, Push y Respuesta con "S/V", y marca el Check de KAM
    const sinInicioPos = !casoActual.fechaInicioPos || casoActual.fechaInicioPos.trim() === '' || casoActual.fechaInicioPos === 'S/V';
    if (sinInicioPos) {
      cambios.fechaInicioPos = 'S/V';
      cambios.fechaPushPos = 'S/V';
      cambios.respuestaPos = 'S/V';
      cambios.pushKamPos = true;
      cambios.freezePos = ''; // S/V no congela SLA
    }

    // Para Catálogo: Si no hay Fecha de Inicio o está en S/V, rellena Inicio, Push y Respuesta con "S/V", y marca el Check de KAM
    const sinInicioCat = !casoActual.fechaInicioCat || casoActual.fechaInicioCat.trim() === '';
    if (sinInicioCat) {
      cambios.fechaInicioCat = 'S/V';
      cambios.fechaPushCat = 'S/V';
      cambios.respuestaCat = 'S/V';
      cambios.pushKamCat = true;
      cambios.freezeCat = '';
    }
  } else if (esVerificacionCatalogo) {
    // Si la Etapa avanza a "En proceso de verificación de catálogo":
    // Para POS API: Si no hay Fecha de Inicio, rellena Inicio, Push y Respuesta con "S/V", y marca el Check de KAM.
    // (El catálogo aún no se toca porque recién entra a esa etapa).
    const sinInicioPos = !casoActual.fechaInicioPos || casoActual.fechaInicioPos.trim() === '';
    if (sinInicioPos) {
      cambios.fechaInicioPos = 'S/V';
      cambios.fechaPushPos = 'S/V';
      cambios.respuestaPos = 'S/V';
      cambios.pushKamPos = true;
      cambios.freezePos = '';
    }
  }

  return cambios;
}

/**
 * 3. Casuísticas de Avance Lineal (Autollenado de Respuestas)
 * Si el equipo sí inició el seguimiento (hay Fecha de Inicio real != vacío y != "S/V")
 */
export function aplicarReglaAvanceLineal(nuevaEtapa: any, casoActual: any, nuevaFechaPushPos?: any, nuevaFechaPushCat?: any): any {
  const cambios: any = {};
  const etapaStr = String(nuevaEtapa || '').trim().toLowerCase();

  // --- POS API ---
  const tieneInicioRealPos = casoActual.fechaInicioPos && casoActual.fechaInicioPos.trim() !== '' && casoActual.fechaInicioPos !== 'S/V';
  if (tieneInicioRealPos) {
    const etapasEsperaPos = ['sin integración confirmada', 'sin integracion confirmada', 'en proceso de seteo'];
    const esEsperaPos = etapasEsperaPos.some(e => etapaStr.includes(e));

    if (!esEsperaPos && etapaStr !== '') {
      // Si la etapa avanza a cualquier fase que NO sea "Sin integración confirmada" o "En proceso de seteo":
      // El sistema deduce que ya consiguieron el dato y cambia la Respuesta automáticamente a "Si"
      cambios.respuestaPos = 'Si';
    } else if (esEsperaPos) {
      // Si se mantiene en espera y se coloca una Fecha de Push: deduce que se pidió dato pero no lo dan -> "No"
      const pushPos = nuevaFechaPushPos !== undefined ? nuevaFechaPushPos : casoActual.fechaPushPos;
      if (pushPos && pushPos.trim() !== '' && pushPos !== 'S/V') {
        cambios.respuestaPos = 'No';
      }
    }
  }

  // --- Catálogo ---
  const tieneInicioRealCat = casoActual.fechaInicioCat && casoActual.fechaInicioCat.trim() !== '' && casoActual.fechaInicioCat !== 'S/V';
  if (tieneInicioRealCat) {
    const esFinalCat = ETAPAS_AVANZADAS_SIN_SEGUIMIENTO.some(e => etapaStr.includes(e));

    if (esFinalCat) {
      // Si la etapa avanza a fases finales: cambia automáticamente a "Si"
      cambios.respuestaCat = 'Si';
    } else if (etapaStr.includes('verificación de catálogo') || etapaStr.includes('verificacion de catalogo')) {
      // Si se mantiene en espera y se coloca una Fecha de Push: cambia Respuesta a "No"
      const pushCat = nuevaFechaPushCat !== undefined ? nuevaFechaPushCat : casoActual.fechaPushCat;
      if (pushCat && pushCat.trim() !== '' && pushCat !== 'S/V') {
        cambios.respuestaCat = 'No';
      }
    }
  }

  return cambios;
}

/**
 * 4. Casuísticas Directas sobre la Columna "Respuesta en el roadmap"
 * Se detonan cuando la respuesta cambia a "Si", "No" o "S/V" (manual o autollenada)
 */
export function aplicarReglaRespuestaDirecta(tipo: string, respuesta: any, casoActual: any): any {
  const cambios: any = {};
  const suffix = tipo === 'pos' ? 'Pos' : 'Cat';
  const pushKamKey = `pushKam${suffix}`;
  const fechaPushKey = `fechaPush${suffix}`;
  const freezeKey = `freeze${suffix}`;
  const fechaFreezeKey = `fechaFreeze${suffix}`;

  const resp = normalizarRespuesta(respuesta);

  if (resp === 'Si') {
    // Se marca automáticamente la casilla Push KAM (TRUE)
    cambios[pushKamKey] = true;
    // Si no había Fecha de Push, se le coloca "S/V"
    const fechaActualPush = casoActual[fechaPushKey];
    if (!fechaActualPush || fechaActualPush.trim() === '') {
      cambios[fechaPushKey] = 'S/V';
    }
    // Se estampa la fecha exacta en la columna oculta de Freeze (Ancla) -> formato fecha estándar para Sheets
    const d = new Date();
    const fechaFormateada = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    const freezeVal = casoActual[freezeKey] || casoActual[fechaFreezeKey] || fechaFormateada;
    cambios[freezeKey] = freezeVal;
    cambios[fechaFreezeKey] = freezeVal;
  } else if (resp === 'No') {
    // Se desmarca automáticamente la casilla Push KAM (FALSE)
    cambios[pushKamKey] = false;
    // Si la Fecha de Push decía "S/V", se borra para obligar al KAM a colocar una fecha real
    const fechaActualPush = casoActual[fechaPushKey];
    if (fechaActualPush === 'S/V') {
      cambios[fechaPushKey] = '';
    }
    // Se borra la fecha oculta de Freeze, lo cual reanuda el cronómetro SLA
    cambios[freezeKey] = '';
    cambios[fechaFreezeKey] = '';
  } else if (resp === 'S/V') {
    // Se marca la casilla Push KAM (TRUE)
    cambios[pushKamKey] = true;
    // Si no había Fecha de Push, se rellena con "S/V"
    const fechaActualPush = casoActual[fechaPushKey];
    if (!fechaActualPush || fechaActualPush.trim() === '') {
      cambios[fechaPushKey] = 'S/V';
    }
    // Se borra la fecha oculta de Freeze -> SLA no se congela (no aplica)
    cambios[freezeKey] = '';
    cambios[fechaFreezeKey] = '';
  }

  return cambios;
}

/**
 * Función integradora que evalúa todas las reglas al actualizar o registrar un caso
 */
export function procesarActualizacionCaso(casoAnterior: any, nuevosValores: any): any {
  let resultado = { ...casoAnterior, ...nuevosValores };

  // Normalizar fechas de entrada
  if (resultado.fechaInicioPos) resultado.fechaInicioPos = normalizarFecha(resultado.fechaInicioPos);
  if (resultado.fechaPushPos) resultado.fechaPushPos = normalizarFecha(resultado.fechaPushPos);
  if (resultado.fechaInicioCat) resultado.fechaInicioCat = normalizarFecha(resultado.fechaInicioCat);
  if (resultado.fechaPushCat) resultado.fechaPushCat = normalizarFecha(resultado.fechaPushCat);
  if (resultado.fechaCreacion) resultado.fechaCreacion = normalizarFecha(resultado.fechaCreacion);

  // 1. Regla de Cierre de OP
  resultado.fechaCierre = aplicarReglaCierre(resultado.estado, resultado.fechaCierre);

  // 2. Regla de Salto de Etapa y Etapas sin seguimiento (S/V automático)
  const etapaActualLower = String(resultado.etapa || '').toLowerCase();
  const esEtapaSinSeg = ETAPAS_AVANZADAS_SIN_SEGUIMIENTO.some(e => etapaActualLower.includes(e));
  if (esEtapaSinSeg || (nuevosValores.etapa && nuevosValores.etapa !== casoAnterior.etapa)) {
    const cambiosSalto = aplicarReglaSaltoEtapa(resultado.etapa, resultado);
    resultado = { ...resultado, ...cambiosSalto };
  }

  // 3. Regla de Avance Lineal
  const cambiosAvance = aplicarReglaAvanceLineal(
    resultado.etapa, 
    resultado, 
    nuevosValores.fechaPushPos, 
    nuevosValores.fechaPushCat
  );
  resultado = { ...resultado, ...cambiosAvance };

  // 4. Reglas Directas sobre Respuestas (POS y Catálogo)
  if (resultado.respuestaPos) {
    resultado.respuestaPos = normalizarRespuesta(resultado.respuestaPos);
    const cambiosRespPos = aplicarReglaRespuestaDirecta('pos', resultado.respuestaPos, resultado);
    resultado = { ...resultado, ...cambiosRespPos };
  }
  if (resultado.respuestaCat) {
    resultado.respuestaCat = normalizarRespuesta(resultado.respuestaCat);
    const cambiosRespCat = aplicarReglaRespuestaDirecta('cat', resultado.respuestaCat, resultado);
    resultado = { ...resultado, ...cambiosRespCat };
  }

  // Asignar automáticamente sponsorship según la integración
  if (resultado.integracion) {
    const spon = obtenerSponsorship(resultado.integracion);
    resultado.sponsorship = spon;
    resultado.descuentosBajoEstructuraSponsorship = spon;
  }

  // Asignar Fecha de inicio de seguimiento de OP según la regla de Etapa
  const fInicioSeg = calcularFechaInicioSeguimientoOP(resultado);
  if (fInicioSeg) {
    resultado.fechaInicioSeguimientoOP = fInicioSeg;
    resultado.sla_inicio = fInicioSeg;
  }

  // Cálculo de indicador activo según Estado Oficial
  resultado.esActivo = esEstadoActivoOficial(resultado.estado);

  return resultado;
}

/**
 * Detección de alertas de Push y SLA para la pestaña "Mis Casos"
 * Incorpora los tiempos laborales reales L-V (Columnas AE, AF, AG, AI, AJ, AK)
 * y refleja con exactitud las horas acumuladas incluso cuando se realizó Push o Freeze.
 */
export function analizarAlertasCaso(caso: any): any {
  if (!caso) {
    return {
      requierePushPos: false,
      motivoPushPos: '',
      requierePushCat: false,
      motivoPushCat: '',
      estaCongelado: false,
      congeladoTrack: '',
      horasTranscurridas: 0,
      tiempoTexto: '-',
      rangoSla: '',
      colorClass: 'bg-gray-800 text-gray-400 border-gray-700',
      esVencido: false,
      esCritico: false,
      esProximoVencer: false,
      esAtencion: false,
      esEnTiempo: false,
      tienePushPos: false,
      fechaPushPos: '',
      tienePushCat: false,
      fechaPushCat: ''
    };
  }

  const ahora = Date.now();
  const etapa = String(caso.etapa || '').toLowerCase();
  const esActivo = typeof caso.esActivo === 'boolean' ? caso.esActivo : esEstadoActivoOficial(caso.estado);

  // 1. Análisis integral de tiempos mediante el motor oficial L-V
  const tiempos = analizarTiemposCaso(caso);
  const horasTranscurridas = tiempos.totalHorasOp;
  const tiempoTexto = tiempos.tiempoTextoOp;
  const rangoSla = tiempos.rangoSlaOp;
  const colorClass = tiempos.colorClassOp;
  const estaCongelado = tiempos.estaCongelado;
  const congeladoTrack = tiempos.congeladoTrack;

  // 2. Alerta Push POS API:
  const esPushValido = (f: any) => Boolean(f && String(f).trim() !== '' && String(f).trim() !== '-' && String(f).trim().toUpperCase() !== 'NULL');
  const esSV = (f: any) => String(f).trim().toUpperCase() === 'S/V';

  const tienePushPos = esPushValido(caso.fechaPushPos);
  const respPosNorm = normalizarRespuesta(caso.respuestaPos);
  const esSvPos = esSV(caso.fechaPushPos) || esSV(caso.fechaInicioPos) || respPosNorm === 'S/V';
  const respPosOk = respPosNorm === 'Si' || esSvPos;
  const tieneTrackPos = Boolean(
    (caso.fechaInicioPos && !esSV(caso.fechaInicioPos) && caso.fechaInicioPos !== '-') ||
    (caso.rangoSlaPos && caso.rangoSlaPos !== '-' && !esSV(caso.rangoSlaPos)) ||
    etapa.includes('sin integración confirmada') || etapa.includes('sin integracion confirmada') || etapa.includes('en proceso de seteo')
  );

  let requierePushPos = false;
  let motivoPushPos = '';

  if (esActivo && tieneTrackPos && !respPosOk && !esSvPos) {
    if (!tienePushPos) {
      requierePushPos = true;
      motivoPushPos = 'Falta realizar Push POS API';
    } else {
      motivoPushPos = `Push POS registrado: ${caso.fechaPushPos}`;
    }
  }

  // 3. Alerta Push Catálogo:
  const tienePushCat = esPushValido(caso.fechaPushCat);
  const respCatNorm = normalizarRespuesta(caso.respuestaCat);
  const esSvCat = esSV(caso.fechaPushCat) || esSV(caso.fechaInicioCat) || respCatNorm === 'S/V';
  const respCatOk = respCatNorm === 'Si' || esSvCat;
  const tieneTrackCat = Boolean(
    (caso.fechaInicioCat && !esSV(caso.fechaInicioCat) && caso.fechaInicioCat !== '-') ||
    (caso.rangoSlaCat && caso.rangoSlaCat !== '-' && !esSV(caso.rangoSlaCat)) ||
    etapa.includes('verificación de catálogo') || etapa.includes('verificacion de catalogo') || etapa.includes('carga de catálogo')
  );

  let requierePushCat = false;
  let motivoPushCat = '';

  if (esActivo && tieneTrackCat && !respCatOk && !esSvCat) {
    if (!tienePushCat) {
      requierePushCat = true;
      motivoPushCat = 'Falta realizar Push Catálogo';
    } else {
      motivoPushCat = `Push Catálogo registrado: ${caso.fechaPushCat}`;
    }
  }

  // 4. Push KAM (Supervisor: 24h a 72h / >=24h):
  const esKamPosHecho = caso.pushKamPos === true || String(caso.pushKamPos).trim().toUpperCase() === 'TRUE' || esSvPos;
  const esKamCatHecho = caso.pushKamCat === true || String(caso.pushKamCat).trim().toUpperCase() === 'TRUE' || esSvCat;
  const esMasDe24 = horasTranscurridas >= 24 || 
    String(rangoSla).includes('24') || 
    String(rangoSla).includes('72') || 
    String(rangoSla).includes('96') || 
    String(rangoSla).includes('≥') || 
    String(rangoSla).includes('>');

  const requierePushKamPos = esActivo && tieneTrackPos && !esKamPosHecho && esMasDe24;
  const requierePushKamCat = esActivo && tieneTrackCat && !esKamCatHecho && esMasDe24;

  // 5. Semáforos SLA: Se calculan sobre las horas acumuladas reales y rango oficial
  const rangoStr = String(rangoSla || '').trim();
  const esRangoCritico = rangoStr.includes('≥96') || rangoStr.includes('>=96') || (rangoStr.includes('96') && !rangoStr.includes('<96'));
  const esRangoKam = !esRangoCritico && (rangoStr.includes('>72') || (rangoStr.includes('72') && !rangoStr.includes('<72')));

  const esCritico = esActivo && (horasTranscurridas >= 96 || esRangoCritico);
  const esProximoVencer = esActivo && !esCritico && (horasTranscurridas >= 72 || esRangoKam);
  const esAtencion = esActivo && !esCritico && !esProximoVencer && horasTranscurridas >= 24;
  const esEnTiempo = esActivo && !esCritico && !esProximoVencer && !esAtencion;

  return {
    requierePushPos,
    motivoPushPos,
    tienePushPos,
    fechaPushPos: caso.fechaPushPos || '',
    tiempoTranscurridoPos: tiempos.tiempoTextoPos,
    rangoSlaPos: tiempos.rangoSlaPos,

    requierePushCat,
    motivoPushCat,
    tienePushCat,
    fechaPushCat: caso.fechaPushCat || '',
    tiempoTranscurridoCat: tiempos.tiempoTextoCat,
    rangoSlaCat: tiempos.rangoSlaCat,

    requierePushKamPos,
    requierePushKamCat,
    esKamPosHecho,
    esKamCatHecho,

    estaCongelado,
    congeladoTrack,
    horasTranscurridas,
    tiempoTexto,
    rangoSla,
    colorClass,
    esVencido: esCritico,
    esCritico,
    esProximoVencer,
    esAtencion,
    esEnTiempo
  };
}
