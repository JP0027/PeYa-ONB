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

export function esPushKamRealizado(valor: any): boolean {
  if (valor === true) return true;
  if (!valor) return false;
  const str = String(valor).trim().toUpperCase();
  return str === 'TRUE' || str === 'VERDADERO' || str === 'SI' || str === 'SÍ' || str === '1';
}

/**
 * Valida si un string de Caso OP corresponde a un número real generado en Salesforce
 */
export function esOpValido(opRaw?: string | null): boolean {
  if (!opRaw) return false;
  const str = String(opRaw).trim();
  return Boolean(
    str && 
    str !== '-' && 
    str !== 'S/OP' && 
    str.toLowerCase() !== 'sin caso op' && 
    str.toLowerCase() !== 'null' && 
    !str.startsWith('TEMP_') && 
    !str.startsWith('SIN_OP_') && 
    !str.includes('_r')
  );
}

/**
 * Devuelve el N° Caso OP si es válido, o "Sin caso OP" para visualización y descarga de reportes
 */
export function obtenerTextoCasoOp(caso: any): string {
  const opRaw = String(caso?.casoOp || '').trim();
  if (esOpValido(opRaw)) return opRaw;
  return 'Sin caso OP';
}

/**
 * Normaliza y formatea asegurando SIEMPRE Fecha y Hora en formato oficial: dd/mm/aaaa hh:mm
 */
export function formatearFechaHora(fecha?: Date | string | number | null): string {
  if (!fecha) {
    const d = new Date();
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${min}`;
  }

  if (typeof fecha === 'string') {
    const str = fecha.trim();
    if (!str || str === 'S/V' || str === '-' || str.toUpperCase() === 'NULL') return str;

    // 1. DD/MM/YYYY o DD-MM-YYYY con hora
    const matchDDMMTime = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (matchDDMMTime) {
      const dia = String(parseInt(matchDDMMTime[1], 10)).padStart(2, '0');
      const mes = String(parseInt(matchDDMMTime[2], 10)).padStart(2, '0');
      let anio = parseInt(matchDDMMTime[3], 10);
      if (anio < 100) anio += 2000;
      const hora = String(matchDDMMTime[4]).padStart(2, '0');
      const min = String(matchDDMMTime[5]).padStart(2, '0');
      return `${dia}/${mes}/${anio} ${hora}:${min}`;
    }

    // 2. YYYY-MM-DD o YYYY/MM/DD con hora
    const matchISOTime = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (matchISOTime) {
      const anio = parseInt(matchISOTime[1], 10);
      const mes = String(parseInt(matchISOTime[2], 10)).padStart(2, '0');
      const dia = String(parseInt(matchISOTime[3], 10)).padStart(2, '0');
      const hora = String(matchISOTime[4]).padStart(2, '0');
      const min = String(matchISOTime[5]).padStart(2, '0');
      return `${dia}/${mes}/${anio} ${hora}:${min}`;
    }

    // 3. DD/MM/YYYY o DD-MM-YYYY sin hora -> estampa hora actual para completar formato dd/mm/aaaa hh:mm
    const matchDDMM = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (matchDDMM) {
      const dia = String(parseInt(matchDDMM[1], 10)).padStart(2, '0');
      const mes = String(parseInt(matchDDMM[2], 10)).padStart(2, '0');
      let anio = parseInt(matchDDMM[3], 10);
      if (anio < 100) anio += 2000;
      const now = new Date();
      const hora = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${anio} ${hora}:${min}`;
    }

    // 4. YYYY-MM-DD o YYYY/MM/DD sin hora -> estampa hora actual para completar formato dd/mm/aaaa hh:mm
    const matchISO = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (matchISO) {
      const anio = parseInt(matchISO[1], 10);
      const mes = String(parseInt(matchISO[2], 10)).padStart(2, '0');
      const dia = String(parseInt(matchISO[3], 10)).padStart(2, '0');
      const now = new Date();
      const hora = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${anio} ${hora}:${min}`;
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      const hora = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${anio} ${hora}:${min}`;
    }

    return str;
  }

  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (isNaN(d.getTime())) return '';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${anio} ${hora}:${min}`;
}

export function normalizarFecha(fechaStr: any): string {
  return formatearFechaHora(fechaStr);
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
    // Si es un estado cerrado, imprime fecha y hora de cierre de OP para detener SLA
    return fechaCierreActual && fechaCierreActual !== '-' ? formatearFechaHora(fechaCierreActual) : formatearFechaHora(new Date());
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
 * Detecta si una etapa no contempla seguimientos lineales (fases avanzadas, directas o agregadas)
 */
export function esEtapaSinSeguimiento(etapa: any): boolean {
  const e = String(etapa || '').trim().toLowerCase();
  if (!e) return false;
  const esEsperaPos = e.includes('sin integración confirmada') || e.includes('sin integracion confirmada') || e.includes('en proceso de seteo');
  const esVerifCat = e.includes('verificación de catálogo') || e.includes('verificacion de catalogo') || e.includes('carga de catálogo') || e.includes('carga de catalogo');
  return !esEsperaPos && !esVerifCat;
}

/**
 * 2. Casuísticas de Relleno "S/V" por Salto de Etapa (Abandono/Omisión/Bajas/Nuevas etapas)
 * Respeta el historial: solo aplica si la etapa avanza y los seguimientos nunca iniciaron (Fecha de Inicio vacía o S/V).
 */
export function aplicarReglaSaltoEtapa(nuevaEtapa: any, casoActual: any): any {
  const cambios: any = {};
  const etapaStr = String(nuevaEtapa || '').trim().toLowerCase();

  const esEtapaAvanzada = esEtapaSinSeguimiento(etapaStr) || ETAPAS_AVANZADAS_SIN_SEGUIMIENTO.some(e => etapaStr.includes(e));
  const esVerificacionCatalogo = etapaStr.includes('verificación de catálogo') || etapaStr.includes('verificacion de catalogo') || etapaStr.includes('carga de catálogo') || etapaStr.includes('carga de catalogo');

  // Si avanza a Validación del Onboarding, En proceso para pruebas, Bajas de integración, etc. (o cualquier nueva etapa sin seguimiento):
  if (esEtapaAvanzada) {
    // Para POS API: Si no hay Fecha de Inicio o está en S/V, rellena Inicio, Push y Respuesta con "S/V", y marca el Check de KAM
    const sinInicioPos = !casoActual.fechaInicioPos || casoActual.fechaInicioPos.trim() === '' || casoActual.fechaInicioPos === 'S/V' || casoActual.fechaInicioPos === '-';
    if (sinInicioPos) {
      cambios.fechaInicioPos = 'S/V';
      cambios.fechaPushPos = 'S/V';
      cambios.respuestaPos = 'S/V';
      cambios.pushKamPos = true;
      cambios.freezePos = ''; // S/V no congela SLA
      cambios.fechaFreezePos = '';
    }

    // Para Catálogo: Si no hay Fecha de Inicio o está en S/V, rellena Inicio, Push y Respuesta con "S/V", y marca el Check de KAM
    const sinInicioCat = !casoActual.fechaInicioCat || casoActual.fechaInicioCat.trim() === '' || casoActual.fechaInicioCat === 'S/V' || casoActual.fechaInicioCat === '-';
    if (sinInicioCat) {
      cambios.fechaInicioCat = 'S/V';
      cambios.fechaPushCat = 'S/V';
      cambios.respuestaCat = 'S/V';
      cambios.pushKamCat = true;
      cambios.freezeCat = '';
      cambios.fechaFreezeCat = '';
    }
  } else if (esVerificacionCatalogo) {
    // Si la Etapa avanza a "En proceso de verificación de catálogo":
    // Para POS API: Si no hay Fecha de Inicio, rellena Inicio, Push y Respuesta con "S/V", y marca el Check de KAM
    // (El catálogo aún no se toca porque recién entra a esa etapa).
    const sinInicioPos = !casoActual.fechaInicioPos || casoActual.fechaInicioPos.trim() === '' || casoActual.fechaInicioPos === 'S/V' || casoActual.fechaInicioPos === '-';
    if (sinInicioPos) {
      cambios.fechaInicioPos = 'S/V';
      cambios.fechaPushPos = 'S/V';
      cambios.respuestaPos = 'S/V';
      cambios.pushKamPos = true;
      cambios.freezePos = '';
      cambios.fechaFreezePos = '';
    }
  }

  return cambios;
}

/**
 * 3. Casuísticas de Avance Lineal (Autollenado de Respuestas)
 * Si el equipo sí inició el seguimiento (hay Fecha de Inicio real != vacío y != "S/V" y != "-")
 */
export function aplicarReglaAvanceLineal(nuevaEtapa: any, casoActual: any, nuevaFechaPushPos?: any, nuevaFechaPushCat?: any): any {
  const cambios: any = {};
  const etapaStr = String(nuevaEtapa || '').trim().toLowerCase();

  // --- POS API ---
  const tieneInicioRealPos = casoActual.fechaInicioPos && casoActual.fechaInicioPos.trim() !== '' && casoActual.fechaInicioPos !== 'S/V' && casoActual.fechaInicioPos !== '-';
  if (tieneInicioRealPos) {
    const etapasEsperaPos = ['sin integración confirmada', 'sin integracion confirmada', 'en proceso de seteo'];
    const esEsperaPos = etapasEsperaPos.some(e => etapaStr.includes(e));

    if (!esEsperaPos && etapaStr !== '') {
      // Si la etapa avanza a cualquier fase que NO sea "Sin integración confirmada" o "En proceso de seteo":
      // El sistema deduce que ya consiguieron el dato y cambia la Respuesta automáticamente a "Si"
      cambios.respuestaPos = 'Si';
    } else if (esEsperaPos) {
      // Si se mantiene en espera y se coloca una Fecha de Push: deduce que se pidió dato pero no lo dan -> "No"
      // Si NO hay fecha de push registrada, NO se deduce "No" (permanece vacía)
      const pushPos = nuevaFechaPushPos !== undefined ? nuevaFechaPushPos : casoActual.fechaPushPos;
      if (pushPos && pushPos.trim() !== '' && pushPos !== 'S/V' && pushPos !== '-') {
        cambios.respuestaPos = 'No';
      }
    }
  }

  // --- Catálogo ---
  const tieneInicioRealCat = casoActual.fechaInicioCat && casoActual.fechaInicioCat.trim() !== '' && casoActual.fechaInicioCat !== 'S/V' && casoActual.fechaInicioCat !== '-';
  if (tieneInicioRealCat) {
    const esFinalCat = esEtapaSinSeguimiento(etapaStr) || ETAPAS_AVANZADAS_SIN_SEGUIMIENTO.some(e => etapaStr.includes(e));

    if (esFinalCat) {
      // Si la etapa avanza a fases finales: cambia automáticamente a "Si"
      cambios.respuestaCat = 'Si';
    } else if (etapaStr.includes('verificación de catálogo') || etapaStr.includes('verificacion de catalogo') || etapaStr.includes('carga de catálogo') || etapaStr.includes('carga de catalogo')) {
      // Si se mantiene en espera y se coloca una Fecha de Push: cambia Respuesta a "No"
      // Si NO hay fecha de push registrada, NO se deduce "No" (permanece vacía)
      const pushCat = nuevaFechaPushCat !== undefined ? nuevaFechaPushCat : casoActual.fechaPushCat;
      if (pushCat && pushCat.trim() !== '' && pushCat !== 'S/V' && pushCat !== '-') {
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
    const freezeVal = casoActual[freezeKey] || casoActual[fechaFreezeKey] || formatearFechaHora(new Date());
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
 * Aplica la lógica estricta de fechas según Etapa de Onboarding:
 * - Sin integración confirmada: OP = POS API
 * - En proceso de seteo: OP = POS API
 * - en proceso de verificación de catálogo: OP = Catálogo solo si NO existe POS API; si existe POS API, OP se mantiene en POS API y la fecha de catálogo se imprime solo en Catálogo
 * - Validación del Onboarding: OP única, sin fecha de seguimiento ni POS API ni de catálogo (S/V)
 * - En proceso para pruebas: OP única, sin fecha de seguimiento ni POS API ni de catálogo (S/V)
 * - Pedido de prueba realizado: OP única, sin fecha de seguimiento ni POS API ni de catálogo (S/V)
 */
export function aplicarFechasPorEtapaOnboarding(caso: any): any {
  const c = { ...caso };
  const etapa = String(c.etapa || '').trim().toLowerCase();
  const fCreacion = c.fechaCreacion || formatearFechaHora(new Date());

  if (etapa.includes('sin integración confirmada') || etapa.includes('sin integracion confirmada') || etapa.includes('en proceso de seteo')) {
    if (!c.fechaInicioPos || c.fechaInicioPos === 'S/V' || c.fechaInicioPos === '-') {
      c.fechaInicioPos = c.sla_inicio || fCreacion;
    }
    c.fechaInicioSeguimientoOP = c.fechaInicioPos;
    c.sla_inicio = c.fechaInicioPos;
  } else if (etapa.includes('verificación de catálogo') || etapa.includes('verificacion de catalogo') || etapa.includes('carga de catálogo') || etapa.includes('carga de catalogo')) {
    const tienePos = c.fechaInicioPos && c.fechaInicioPos !== 'S/V' && c.fechaInicioPos !== '-';
    if (!c.fechaInicioCat || c.fechaInicioCat === 'S/V' || c.fechaInicioCat === '-') {
      c.fechaInicioCat = c.sla_inicio || fCreacion;
    }
    if (tienePos) {
      c.fechaInicioSeguimientoOP = c.fechaInicioPos;
      c.sla_inicio = c.fechaInicioPos;
    } else {
      c.fechaInicioSeguimientoOP = c.fechaInicioCat;
      c.sla_inicio = c.fechaInicioCat;
      if (!c.fechaInicioPos || c.fechaInicioPos === '-' || c.fechaInicioPos === 'S/V') {
        c.fechaInicioPos = 'S/V';
        c.fechaPushPos = 'S/V';
        c.respuestaPos = 'S/V';
        c.pushKamPos = true;
      }
    }
  } else if (
    esEtapaSinSeguimiento(etapa) ||
    etapa.includes('validación') || etapa.includes('validacion') ||
    etapa.includes('en proceso para pruebas') ||
    etapa.includes('pedido de prueba realizado')
  ) {
    c.fechaInicioSeguimientoOP = c.fechaInicioSeguimientoOP || c.sla_inicio || fCreacion;
    c.sla_inicio = c.fechaInicioSeguimientoOP;
    // Respetar historial: solo si no había iniciado seguimiento
    if (!c.fechaInicioPos || c.fechaInicioPos === '-' || c.fechaInicioPos === 'S/V') {
      c.fechaInicioPos = 'S/V';
      c.fechaPushPos = 'S/V';
      c.respuestaPos = 'S/V';
      c.pushKamPos = true;
    }
    if (!c.fechaInicioCat || c.fechaInicioCat === '-' || c.fechaInicioCat === 'S/V') {
      c.fechaInicioCat = 'S/V';
      c.fechaPushCat = 'S/V';
      c.respuestaCat = 'S/V';
      c.pushKamCat = true;
    }
  }

  return c;
}

/**
 * Función integradora que evalúa todas las reglas al actualizar o registrar un caso
 */
export function procesarActualizacionCaso(casoAnterior: any, nuevosValores: any): any {
  let resultado = { ...casoAnterior, ...nuevosValores };

  // Normalizar fechas de entrada garantizando fecha y hora en formato oficial: dd/mm/aaaa hh:mm
  if (resultado.fechaInicioPos && resultado.fechaInicioPos !== 'S/V') resultado.fechaInicioPos = normalizarFecha(resultado.fechaInicioPos);
  if (resultado.fechaPushPos && resultado.fechaPushPos !== 'S/V') resultado.fechaPushPos = normalizarFecha(resultado.fechaPushPos);
  if (resultado.fechaInicioCat && resultado.fechaInicioCat !== 'S/V') resultado.fechaInicioCat = normalizarFecha(resultado.fechaInicioCat);
  if (resultado.fechaPushCat && resultado.fechaPushCat !== 'S/V') resultado.fechaPushCat = normalizarFecha(resultado.fechaPushCat);
  if (resultado.fechaCreacion) resultado.fechaCreacion = normalizarFecha(resultado.fechaCreacion);
  if (resultado.sla_inicio) resultado.sla_inicio = normalizarFecha(resultado.sla_inicio);
  if (resultado.fechaInicioSeguimientoOP) resultado.fechaInicioSeguimientoOP = normalizarFecha(resultado.fechaInicioSeguimientoOP);

  // 1. Regla de Cierre de OP
  resultado.fechaCierre = aplicarReglaCierre(resultado.estado, resultado.fechaCierre);

  // 2. Regla de Salto de Etapa y Etapas sin seguimiento (S/V automático)
  const etapaActualLower = String(resultado.etapa || '').toLowerCase();
  const esEtapaSinSeg = esEtapaSinSeguimiento(etapaActualLower) || ETAPAS_AVANZADAS_SIN_SEGUIMIENTO.some(e => etapaActualLower.includes(e));
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

  // 4. Reglas Directas sobre Respuestas (POS y Catálogo) solo si la respuesta cambió o fue generada por avance lineal
  const respPosCambio = nuevosValores.respuestaPos !== undefined && normalizarRespuesta(nuevosValores.respuestaPos) !== normalizarRespuesta(casoAnterior?.respuestaPos);
  const respPosGenerada = cambiosAvance.respuestaPos && normalizarRespuesta(cambiosAvance.respuestaPos) !== normalizarRespuesta(casoAnterior?.respuestaPos);
  if ((respPosCambio || respPosGenerada) && resultado.respuestaPos) {
    resultado.respuestaPos = normalizarRespuesta(resultado.respuestaPos);
    const cambiosRespPos = aplicarReglaRespuestaDirecta('pos', resultado.respuestaPos, resultado);
    resultado = { ...resultado, ...cambiosRespPos };
  } else if (resultado.respuestaPos) {
    resultado.respuestaPos = normalizarRespuesta(resultado.respuestaPos);
  }

  const respCatCambio = nuevosValores.respuestaCat !== undefined && normalizarRespuesta(nuevosValores.respuestaCat) !== normalizarRespuesta(casoAnterior?.respuestaCat);
  const respCatGenerada = cambiosAvance.respuestaCat && normalizarRespuesta(cambiosAvance.respuestaCat) !== normalizarRespuesta(casoAnterior?.respuestaCat);
  if ((respCatCambio || respCatGenerada) && resultado.respuestaCat) {
    resultado.respuestaCat = normalizarRespuesta(resultado.respuestaCat);
    const cambiosRespCat = aplicarReglaRespuestaDirecta('cat', resultado.respuestaCat, resultado);
    resultado = { ...resultado, ...cambiosRespCat };
  } else if (resultado.respuestaCat) {
    resultado.respuestaCat = normalizarRespuesta(resultado.respuestaCat);
  }

  // Preservar SIEMPRE la selección explícita del usuario en Push KAM
  if (nuevosValores.pushKamPos !== undefined) {
    resultado.pushKamPos = esPushKamRealizado(nuevosValores.pushKamPos);
  }
  if (nuevosValores.pushKamCat !== undefined) {
    resultado.pushKamCat = esPushKamRealizado(nuevosValores.pushKamCat);
  }

  // Asignar automáticamente sponsorship según la integración
  if (resultado.integracion) {
    const spon = obtenerSponsorship(resultado.integracion);
    resultado.sponsorship = spon;
    resultado.descuentosBajoEstructuraSponsorship = spon;
  }

  // Reglas estrictas de fechas por etapa de Onboarding
  resultado = aplicarFechasPorEtapaOnboarding(resultado);

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

  // 4. Push KAM (Supervisor: >=24h):
  // Regla oficial: Requiere Push KAM si tiene fecha de inicio, fecha de push, en respuesta dice "NO" y no tiene Push KAM realizado
  const tieneInicioRealPos = Boolean(caso.fechaInicioPos && !esSV(caso.fechaInicioPos) && caso.fechaInicioPos !== '-');
  const respEsNoPos = respPosNorm === 'No';
  const esKamPosHecho = esPushKamRealizado(caso.pushKamPos);

  const tieneInicioRealCat = Boolean(caso.fechaInicioCat && !esSV(caso.fechaInicioCat) && caso.fechaInicioCat !== '-');
  const respEsNoCat = respCatNorm === 'No';
  const esKamCatHecho = esPushKamRealizado(caso.pushKamCat);

  const esMasDe24 = horasTranscurridas >= 24 || 
    String(rangoSla).includes('24') || 
    String(rangoSla).includes('72') || 
    String(rangoSla).includes('96') || 
    String(rangoSla).includes('≥') || 
    String(rangoSla).includes('>');

  const requierePushKamPos = esActivo && tieneInicioRealPos && tienePushPos && respEsNoPos && !esKamPosHecho && esMasDe24;
  const requierePushKamCat = esActivo && tieneInicioRealCat && tienePushCat && respEsNoCat && !esKamCatHecho && esMasDe24;

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
