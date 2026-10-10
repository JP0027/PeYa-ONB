/**
 * Cálculo del Tiempo Transcurrido Lunes a Viernes (L-V) y Rangos SLA Oficiales
 * Replica fielmente la fórmula matricial oficial de Google Sheets:
 * =MAP(R3:R; S3:S; LAMBDA(inicio; fin; ...))
 */

export function esPushKamRealizado(valor: any): boolean {
  if (valor === true) return true;
  if (!valor) return false;
  const str = String(valor).trim().toUpperCase();
  return str === 'TRUE' || str === 'VERDADERO' || str === 'SI' || str === 'SÍ' || str === '1';
}

/**
 * Parsea fechas en distintos formatos comunes (ISO, DD/MM/YYYY HH:mm, YYYY-MM-DD HH:mm, timestamp)
 */
export function parsearFecha(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === 'number') {
    // Si viene como serial de Excel / Sheets
    if (val > 20000 && val < 60000) {
      return new Date(Math.round((val - 25569) * 86400 * 1000));
    }
    return new Date(val);
  }
  const s = String(val).trim();
  if (!s || s === 'S/V' || s === '-' || s.toUpperCase() === 'NULL') return null;

  // Si ya es ISO válido
  const dIso = new Date(s);
  if (!isNaN(dIso.getTime()) && s.includes('T')) return dIso;

  // Formato DD/MM/YYYY o DD-MM-YYYY con hora opcional
  const m1 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m1) {
    const dia = parseInt(m1[1], 10);
    const mes = parseInt(m1[2], 10) - 1;
    let anio = parseInt(m1[3], 10);
    if (anio < 100) anio += 2000;
    const hh = m1[4] ? parseInt(m1[4], 10) : 0;
    const mi = m1[5] ? parseInt(m1[5], 10) : 0;
    const ss = m1[6] ? parseInt(m1[6], 10) : 0;
    const d = new Date(anio, mes, dia, hh, mi, ss);
    if (!isNaN(d.getTime())) return d;
  }

  // Formato YYYY-MM-DD con hora opcional
  const m2 = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m2) {
    const anio = parseInt(m2[1], 10);
    const mes = parseInt(m2[2], 10) - 1;
    const dia = parseInt(m2[3], 10);
    const hh = m2[4] ? parseInt(m2[4], 10) : 0;
    const mi = m2[5] ? parseInt(m2[5], 10) : 0;
    const ss = m2[6] ? parseInt(m2[6], 10) : 0;
    const d = new Date(anio, mes, dia, hh, mi, ss);
    if (!isNaN(d.getTime())) return d;
  }

  return isNaN(dIso.getTime()) ? null : dIso;
}

/**
 * Extrae horas numéricas de textos como "1 día, 6h 30m", "24h", "2 días", o decimales de días de Sheets
 */
export function extraerHorasDeTexto(val: any): number | null {
  if (val === null || typeof val === 'undefined') return null;
  if (typeof val === 'number') {
    if (isNaN(val)) return null;
    // Si viene como fracción de días (0 < val <= 500)
    if (val > 0 && val < 500) {
      return Math.round(val * 24);
    }
    return Math.round(val);
  }
  const s = String(val).trim();
  if (!s || s === '-' || s.toUpperCase() === 'S/V' || s.toUpperCase() === 'NULL') return null;

  // Si contiene "d" o "día" y "h"
  const matchDias = s.match(/(\d+)\s*(?:días|dias|d\b)/i);
  const matchHoras = s.match(/(\d+)\s*(?:horas|hora|h\b)/i);
  if (matchDias || matchHoras) {
    const d = matchDias ? parseInt(matchDias[1], 10) : 0;
    const h = matchHoras ? parseInt(matchHoras[1], 10) : 0;
    return d * 24 + h;
  }

  // Si viene como número en texto (ej. "32.5" o "1,5")
  const num = parseFloat(s.replace(',', '.'));
  if (!isNaN(num)) {
    if (num > 0 && num < 100) return Math.round(num * 24);
    return Math.round(num);
  }

  return null;
}

/**
 * Cuenta días laborales (Lunes a Viernes) entre dos fechas inclusive
 */
function contarDiasLaborales(d1: Date, d2: Date): number {
  let count = 0;
  const cur = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const end = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());

  while (cur <= end) {
    const day = cur.getDay(); // 0 = Domingo, 6 = Sábado
    if (day !== 0 && day !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Calcula el tiempo laboral L-V entre fecha de inicio y fecha fin
 * Replica la lógica exacta de:
 * LET(raw_f; SI(ESNUMERO(fin); fin; AHORA()); ... DIAS.LAB(inicio_ajustado; f) ...)
 */
export function calcularTiempoLaboralLV(fechaInicioRaw: any, fechaFinRaw: any = null): any {
  const inicio = parsearFecha(fechaInicioRaw);
  if (!inicio) {
    return {
      texto: '-',
      totalMinutos: 0,
      totalHoras: 0,
      dias: 0,
      horas: 0,
      minutos: 0,
      rango: '',
      colorClass: 'bg-[#2C2C32] text-[#B3B3B3] border-[#3A3A3E]'
    };
  }

  let fin = parsearFecha(fechaFinRaw);
  if (!fin) {
    fin = new Date();
  }

  // Ajuste de inicio: si cae en sábado o domingo, se corre al lunes 00:00:00
  let inicioAjustado = new Date(inicio);
  const diaI = inicioAjustado.getDay(); // 0 Dom, 6 Sab
  if (diaI === 6) {
    inicioAjustado.setDate(inicioAjustado.getDate() + 2);
    inicioAjustado.setHours(0, 0, 0, 0);
  } else if (diaI === 0) {
    inicioAjustado.setDate(inicioAjustado.getDate() + 1);
    inicioAjustado.setHours(0, 0, 0, 0);
  }

  // Ajuste de fin: si cae en fin de semana, se retrocede al viernes 23:59:59
  let finAjustado = new Date(fin);
  const diaF = finAjustado.getDay();
  if (diaF === 6) {
    finAjustado.setDate(finAjustado.getDate() - 1);
    finAjustado.setHours(23, 59, 59, 999);
  } else if (diaF === 0) {
    finAjustado.setDate(finAjustado.getDate() - 2);
    finAjustado.setHours(23, 59, 59, 999);
  }

  if (finAjustado < inicioAjustado) {
    return {
      texto: '0 días, 0h 0m',
      totalMinutos: 0,
      totalHoras: 0,
      dias: 0,
      horas: 0,
      minutos: 0,
      rango: '0h a <4h',
      colorClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
    };
  }

  const diasLaborales = contarDiasLaborales(inicioAjustado, finAjustado);

  // Fracción de día de inicio y fin (en base decimal de 24 horas = 1.0)
  const fracInicio = (inicioAjustado.getHours() * 3600 + inicioAjustado.getMinutes() * 60 + inicioAjustado.getSeconds()) / 86400;
  const fracFin = (finAjustado.getHours() * 3600 + finAjustado.getMinutes() * 60 + finAjustado.getSeconds()) / 86400;

  let totalDecimal = 0;
  if (diasLaborales <= 1) {
    const diffMs = finAjustado.getTime() - inicioAjustado.getTime();
    totalDecimal = Math.max(0, diffMs / (86400 * 1000));
  } else {
    totalDecimal = (diasLaborales - 2) + (1 - fracInicio) + fracFin;
  }

  const totalMin = Math.round(totalDecimal * 1440);
  const dRes = Math.floor(totalMin / 1440);
  const hRes = Math.floor((totalMin % 1440) / 60);
  const mRes = totalMin % 60;
  const totalHoras = dRes * 24 + hRes;

  const texto = dRes > 0 
    ? `${dRes} ${dRes === 1 ? 'día' : 'días'}, ${hRes}h ${mRes}m`
    : `${hRes}h ${mRes}m`;
  const rango = obtenerRangoSLA(totalHoras);
  const colorClass = obtenerColorRangoSLA(totalHoras, true);

  return {
    texto,
    totalMinutos: totalMin,
    totalHoras,
    dias: dRes,
    horas: hRes,
    minutos: mRes,
    rango,
    colorClass
  };
}

/**
 * Rango SLA oficial (Columna AI en la hoja):
 * SI(total_h < 4; "0h a <4h"; SI(total_h <= 6; "≥4h a ≤6h"; SI(total_h < 24; ">6h a <24h"; SI(total_h < 96; "≥24h a <96h"; "≥96h"))))
 */
export function obtenerRangoSLA(totalHoras: number | null | undefined): string {
  if (typeof totalHoras !== 'number' || isNaN(totalHoras) || totalHoras < 0) return '';
  if (totalHoras < 4) return '0h a <4h';
  if (totalHoras <= 6) return '≥4h a ≤6h';
  if (totalHoras < 24) return '>6h a <24h';
  if (totalHoras < 96) return '≥24h a <96h';
  return '≥96h';
}

/**
 * Evalúa si el SLA de un seguimiento (Catálogo AK, POS AJ) o de la OP (AI) alcanzó o superó las 4 horas (≥ 4h).
 * Respeta estrictamente los rangos de Google Sheets:
 * - Si el rango oficial indica "0h a <4h": false.
 * - Si el rango oficial indica "≥4h a ≤6h", ">6h", "≥24h", "≥96h": true.
 * - Si no hay rango oficial o dice '-', evalúa que las horas sean >= 4.
 */
export function esSlaMayorOIgualA4(horas: number | null | undefined, rangoOficial?: string): boolean {
  const r = String(rangoOficial || '').toLowerCase().trim();
  if (r && r !== '-' && r !== 's/v') {
    if (r.includes('<4') || r.includes('0h a <4h') || r.includes('0h a')) return false;
    if (
      r.includes('≥4') || r.includes('>=4') || r.includes('4h a') ||
      r.includes('≤6') || r.includes('<=6') ||
      r.includes('>6') || r.includes('6h a') ||
      r.includes('≥24') || r.includes('>=24') || r.includes('24h') ||
      r.includes('≥96') || r.includes('>=96') || r.includes('96h')
    ) {
      return true;
    }
  }
  return typeof horas === 'number' && !isNaN(horas) && horas >= 4;
}

/**
 * Estilos y colores de formato condicional oficiales (Intervalo AE3:AE1000 de la hoja):
 * - Regla Roja (≥ 4 días / ≥ 96h)
 * - Regla Naranja (≥ 1 día / ≥ 24h a < 96h)
 * - Regla Amarilla (≥ 4 horas / ≥ 4h a < 24h)
 * - Verde (< 4 horas / 0h a < 4h)
 */
export function obtenerColorRangoSLA(totalHoras: number | null | undefined, esActivo: boolean = true, rangoOficial?: string): string {
  if (typeof totalHoras !== 'number' || isNaN(totalHoras)) {
    return 'bg-[#2C2C32] text-[#B3B3B3] border-[#3A3A3E]';
  }
  if (!esActivo) {
    return 'bg-[#2C2C32]/80 text-[#D1D5DB] border-[#3A3A3E]';
  }

  const r = String(rangoOficial || '').toLowerCase().trim();

  // 1. Regla Roja oficial: Crítico (≥ 96h)
  if (r.includes('96') || totalHoras >= 96) {
    return 'bg-rose-950/80 text-rose-300 border-rose-800 font-bold animate-pulse';
  }

  // 2. Regla Naranja oficial: Atención / KAM (≥ 24h a < 96h)
  if ((r.includes('24h') && !r.includes('<24')) || (r.includes('72h') && !r.includes('<72')) || totalHoras >= 24) {
    return 'bg-amber-950/80 text-amber-300 border-amber-800 font-bold';
  }

  // 3. Regla Amarilla oficial: Alerta Push / SLA (≥ 4h a < 24h: "≥4h a ≤6h", ">6h a <24h")
  if (esSlaMayorOIgualA4(totalHoras, r)) {
    return 'bg-yellow-950/80 text-yellow-300 border-yellow-800 font-semibold';
  }

  // 4. Regla Verde oficial: En tiempo (< 4h: "0h a <4h")
  return 'bg-emerald-950/80 text-emerald-300 border-emerald-800 font-medium';
}

/**
 * Analiza todos los tiempos y rangos SLA para un caso dado (OP general, POS API y Catálogo)
 * Prioriza valores reales sincronizados desde Firebase / Google Sheets (Columnas AE, AF, AG, AI, AJ, AK)
 */
export function analizarTiemposCaso(caso: any): any {
  if (!caso) return null;

  const esActivo = typeof caso.esActivo === 'boolean' 
    ? caso.esActivo 
    : (!String(caso.estado || '').toLowerCase().includes('cerrad') && !String(caso.estado || '').toLowerCase().includes('fallid'));

  // Regla común: si hay fecha de inicio válida se calcula EN VIVO (L-V, misma fórmula de la hoja).
  // Solo se usa el texto de Sheets si no se puede calcular (o si está congelado sin fecha de freeze).
  const resolverHoras = (calc: any, texto: any, usarTexto: boolean) => {
    const hTexto = extraerHorasDeTexto(texto);
    if (calc && !usarTexto) return { horas: calc.totalHoras, texto: calc.texto };
    if (hTexto !== null) return { horas: hTexto, texto: String(texto) };
    if (calc) return { horas: calc.totalHoras, texto: calc.texto };
    return { horas: 0, texto: '-' };
  };

  // 1. SLA General de la OP
  const fInicioOp = caso.fechaInicioSeguimientoOP || caso.sla_inicio || caso.fechaCreacion;
  const fCierreOp = !esActivo && caso.fechaCierre ? caso.fechaCierre : null;
  const tiempoOpCalculado = calcularTiempoLaboralLV(fInicioOp, fCierreOp);
  const opRes = resolverHoras(
    parsearFecha(fInicioOp) ? tiempoOpCalculado : null,
    caso.tiempoTranscurridoOp && caso.tiempoTranscurridoOp !== '-' ? caso.tiempoTranscurridoOp : caso.tiempoTranscurridoLV,
    false
  );
  const totalHorasOp = opRes.horas;
  const tiempoTextoOp = opRes.texto;
  const rangoSlaOp = caso.rangoSlaOp && String(caso.rangoSlaOp).trim() !== '' 
    ? String(caso.rangoSlaOp).trim() 
    : (caso.rangoSla && String(caso.rangoSla).trim() !== '' ? String(caso.rangoSla).trim() : obtenerRangoSLA(totalHorasOp));
  const colorClassOp = obtenerColorRangoSLA(totalHorasOp, esActivo, rangoSlaOp);

  // 2. SLA Seguimiento POS API (Columna AJ en Sheets)
  const fInicioPos = caso.fechaInicioPos && caso.fechaInicioPos !== 'S/V' && caso.fechaInicioPos !== '-' ? caso.fechaInicioPos : null;
  const respPosLimpia = String(caso.respuestaPos || '').trim().toLowerCase();
  const freezeValPos = caso.fechaFreezePos || caso.freezePos || null;
  const estaCongeladoPos = respPosLimpia === 'si' || respPosLimpia === 'sí' || Boolean(freezeValPos);
  const finPos = estaCongeladoPos && freezeValPos 
    ? freezeValPos 
    : (!esActivo && caso.fechaCierre ? caso.fechaCierre : null);
  const tiempoPosCalculado = fInicioPos && parsearFecha(fInicioPos) ? calcularTiempoLaboralLV(fInicioPos, finPos) : null;
  const posRes = resolverHoras(tiempoPosCalculado, caso.tiempoTranscurridoPos, estaCongeladoPos && !freezeValPos);
  const totalHorasPos = posRes.horas;
  const tiempoTextoPos = fInicioPos ? posRes.texto : (caso.fechaInicioPos === 'S/V' ? 'S/V' : '-');
  const rangoSlaPos = fInicioPos 
    ? (caso.rangoSlaPos && String(caso.rangoSlaPos).trim() !== '' ? String(caso.rangoSlaPos).trim() : obtenerRangoSLA(totalHorasPos)) 
    : '';

  // 3. SLA Seguimiento Catálogo (Columna AK en Sheets)
  const fInicioCat = caso.fechaInicioCat && caso.fechaInicioCat !== 'S/V' && caso.fechaInicioCat !== '-' ? caso.fechaInicioCat : null;
  const respCatLimpia = String(caso.respuestaCat || '').trim().toLowerCase();
  const freezeValCat = caso.fechaFreezeCat || caso.freezeCat || null;
  const estaCongeladoCat = respCatLimpia === 'si' || respCatLimpia === 'sí' || Boolean(freezeValCat);
  const finCat = estaCongeladoCat && freezeValCat 
    ? freezeValCat 
    : (!esActivo && caso.fechaCierre ? caso.fechaCierre : null);
  const tiempoCatCalculado = fInicioCat && parsearFecha(fInicioCat) ? calcularTiempoLaboralLV(fInicioCat, finCat) : null;
  const catRes = resolverHoras(tiempoCatCalculado, caso.tiempoTranscurridoCat, estaCongeladoCat && !freezeValCat);
  const totalHorasCat = catRes.horas;
  const tiempoTextoCat = fInicioCat ? catRes.texto : (caso.fechaInicioCat === 'S/V' ? 'S/V' : '-');
  const rangoSlaCat = fInicioCat 
    ? (caso.rangoSlaCat && String(caso.rangoSlaCat).trim() !== '' ? String(caso.rangoSlaCat).trim() : obtenerRangoSLA(totalHorasCat)) 
    : '';

  // 4. Determinar cuál seguimiento está ACTIVO:
  //    - Catálogo (AK): Si la etapa es de Catálogo o tiene inicio real de Catálogo y NO está congelado
  //    - POS API (AJ): Si la etapa es de POS o tiene inicio real de POS y NO está congelado (y no está en Catálogo)
  //    - Si no tiene seguimiento activo (o ambos concluyeron/congelados): corresponde al SLA de la OP (AI)
  const etapaLower = String(caso.etapa || '').toLowerCase().trim();
  const esEtapaCat = etapaLower.includes('catálogo') || etapaLower.includes('catalogo');
  const esEtapaPos = etapaLower.includes('sin integración') || etapaLower.includes('sin integracion') || etapaLower.includes('seteo');

  const tieneInicioRealCat = Boolean(fInicioCat && fInicioCat !== 'S/V' && fInicioCat !== '-');
  const tieneInicioRealPos = Boolean(fInicioPos && fInicioPos !== 'S/V' && fInicioPos !== '-');

  let trackSeguimiento: 'cat' | 'pos' | 'op' = 'op';
  if ((esEtapaCat || tieneInicioRealCat) && !estaCongeladoCat) {
    trackSeguimiento = 'cat';
  } else if ((esEtapaPos || tieneInicioRealPos) && !estaCongeladoPos && !esEtapaCat) {
    trackSeguimiento = 'pos';
  } else {
    trackSeguimiento = 'op';
  }

  const horasSeguimiento = trackSeguimiento === 'cat' ? totalHorasCat : trackSeguimiento === 'pos' ? totalHorasPos : totalHorasOp;
  const textoSeguimiento = trackSeguimiento === 'cat' ? tiempoTextoCat : trackSeguimiento === 'pos' ? tiempoTextoPos : tiempoTextoOp;
  const congeladoSeguimiento = trackSeguimiento === 'cat' ? estaCongeladoCat : trackSeguimiento === 'pos' ? estaCongeladoPos : (!esActivo && Boolean(fCierreOp));
  const rangoSeguimiento = trackSeguimiento === 'cat' ? rangoSlaCat : (trackSeguimiento === 'pos' ? rangoSlaPos : rangoSlaOp);

  const estaCongeladoCualquiera = estaCongeladoPos || estaCongeladoCat;
  const congeladoTrack = estaCongeladoPos && estaCongeladoCat 
    ? 'POS y Catálogo' 
    : estaCongeladoPos 
      ? 'POS API' 
      : estaCongeladoCat 
        ? 'Catálogo' 
        : '';

  return {
    esActivo,
    fInicioOp,
    fCierreOp,
    tiempoOp: tiempoOpCalculado,
    rangoSlaOp,
    tiempoTextoOp,
    totalHorasOp,
    colorClassOp,

    // POS API
    fInicioPos,
    fechaPushPos: caso.fechaPushPos,
    respuestaPos: caso.respuestaPos || '',
    pushKamPos: esPushKamRealizado(caso.pushKamPos),
    freezePos: caso.freezePos,
    estaCongeladoPos,
    tiempoPos: tiempoPosCalculado,
    totalHorasPos,
    rangoSlaPos,
    tiempoTextoPos,

    // Catálogo
    fInicioCat,
    fechaPushCat: caso.fechaPushCat,
    respuestaCat: caso.respuestaCat || '',
    pushKamCat: esPushKamRealizado(caso.pushKamCat),
    freezeCat: caso.freezeCat,
    estaCongeladoCat,
    tiempoCat: tiempoCatCalculado,
    totalHorasCat,
    rangoSlaCat,
    tiempoTextoCat,

    estaCongeladoCualquiera,
    estaCongelado: estaCongeladoCualquiera,
    congeladoTrack,

    // SLA del seguimiento correspondiente (el que se muestra en la app)
    trackSeguimiento,
    horasSeguimiento,
    textoSeguimiento,
    rangoSeguimiento,
    colorSeguimiento: obtenerColorRangoSLA(horasSeguimiento, esActivo, rangoSeguimiento),
    congeladoSeguimiento
  };
}
