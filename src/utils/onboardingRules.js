/**
 * Reglas de Negocio Onboarding HeroCare (PedidosYa)
 * Implementación estricta de las 4 casuísticas del flujo de Onboarding
 */

// Normalización de fechas de texto a formato ISO estándar (YYYY-MM-DD o ISO String)
export function normalizarFecha(fechaStr) {
  if (!fechaStr) return '';
  const str = String(fechaStr).trim();
  if (!str || str === 'S/V') return str;

  // Si ya es formato ISO o fecha válida
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str;
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (match) {
    const dia = match[1].padStart(2, '0');
    const mes = match[2].padStart(2, '0');
    const anio = match[3];
    return `${anio}-${mes}-${dia}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return str;
}

/**
 * 1. Casuísticas de Cierre de Oportunidad (OP)
 * - Si el Estado del caso (SF) es "En progreso", "Nuevo" o está vacío: Borra cualquier fecha en Fecha de cierre.
 * - Si el Estado cambia a cualquier otro valor (Fallido, Cerrado por KAM, Cerrado por oportunidad satisfactoria, etc.):
 *   Estampa instantáneamente la fecha y hora actual en la Fecha de cierre.
 */
export function aplicarReglaCierre(nuevoEstado, fechaCierreActual) {
  const est = String(nuevoEstado || '').trim().toLowerCase();
  const esAbierto = est === 'en progreso' || est === 'nuevo' || est === '' || est === 'ticket hc';

  if (esAbierto) {
    return '';
  } else {
    // Si ya tiene fecha de cierre previa se mantiene, sino se estampa fecha actual
    return fechaCierreActual || new Date().toISOString();
  }
}

/**
 * 2. Casuísticas de Relleno "S/V" por Salto de Etapa (Abandono/Omisión)
 * Solo aplica si la etapa avanza y los seguimientos nunca iniciaron (Fecha de Inicio vacía).
 */
export function aplicarReglaSaltoEtapa(nuevaEtapa, casoActual) {
  const cambios = {};
  const etapaStr = String(nuevaEtapa || '').trim().toLowerCase();

  const etapasAvanzadas = [
    'validación del onboarding',
    'validacion del onboarding',
    'en proceso para pruebas',
    'pedido de prueba realizado'
  ];

  const esEtapaAvanzada = etapasAvanzadas.some(e => etapaStr.includes(e));
  const esVerificacionCatalogo = etapaStr.includes('verificación de catálogo') || etapaStr.includes('verificacion de catalogo');

  // Si avanza a Validación del Onboarding, En proceso para pruebas o Pedido de prueba realizado:
  if (esEtapaAvanzada) {
    // Para POS API: Si no hay Fecha de Inicio, rellena Inicio, Push y Respuesta con "S/V", y marca el Check de KAM
    const sinInicioPos = !casoActual.fechaInicioPos || casoActual.fechaInicioPos.trim() === '';
    if (sinInicioPos) {
      cambios.fechaInicioPos = 'S/V';
      cambios.fechaPushPos = 'S/V';
      cambios.respuestaPos = 'S/V';
      cambios.pushKamPos = true;
      cambios.freezePos = ''; // S/V no congela SLA
    }

    // Para Catálogo: Si no hay Fecha de Inicio, rellena Inicio, Push y Respuesta con "S/V", y marca el Check de KAM
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
export function aplicarReglaAvanceLineal(nuevaEtapa, casoActual, nuevaFechaPushPos, nuevaFechaPushCat) {
  const cambios = {};
  const etapaStr = String(nuevaEtapa || '').trim().toLowerCase();

  // --- POS API ---
  const tieneInicioRealPos = casoActual.fechaInicioPos && casoActual.fechaInicioPos.trim() !== '' && casoActual.fechaInicioPos !== 'S/V';
  if (tieneInicioRealPos) {
    const etapasEsperaPos = ['sin integración confirmada', 'sin integracion confirmada', 'en proceso de seteo'];
    const esEsperaPos = etapasEsperaPos.some(e => etapaStr.includes(e));

    if (!esEsperaPos && etapaStr !== '') {
      // Si la etapa avanza a cualquier fase que NO sea "Sin integración confirmada" o "En proceso de seteo":
      // El sistema deduce que ya consiguieron el dato y cambia la Respuesta automáticamente a "Sí"
      cambios.respuestaPos = 'Sí';
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
    const etapasFinalesCat = [
      'validación del onboarding',
      'validacion del onboarding',
      'en proceso para pruebas',
      'pedido de prueba realizado'
    ];
    const esFinalCat = etapasFinalesCat.some(e => etapaStr.includes(e));

    if (esFinalCat) {
      // Si la etapa avanza a fases finales: cambia automáticamente a "Sí"
      cambios.respuestaCat = 'Sí';
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
 * Se detonan cuando la respuesta cambia a "Sí", "No" o "S/V" (manual o autollenada)
 */
export function aplicarReglaRespuestaDirecta(tipo, respuesta, casoActual) {
  const cambios = {};
  const suffix = tipo === 'pos' ? 'Pos' : 'Cat';
  const pushKamKey = `pushKam${suffix}`;
  const fechaPushKey = `fechaPush${suffix}`;
  const freezeKey = `freeze${suffix}`;

  const resp = String(respuesta || '').trim();

  if (resp === 'Sí') {
    // Se marca automáticamente la casilla Push KAM (TRUE)
    cambios[pushKamKey] = true;
    // Si no había Fecha de Push, se le coloca "S/V"
    const fechaActualPush = casoActual[fechaPushKey];
    if (!fechaActualPush || fechaActualPush.trim() === '') {
      cambios[fechaPushKey] = 'S/V';
    }
    // Se estampa la fecha exacta en la columna oculta de Freeze (Ancla) -> pausa cronómetro SLA
    cambios[freezeKey] = casoActual[freezeKey] || new Date().toISOString();
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
  }

  return cambios;
}

/**
 * Función integradora que evalúa todas las reglas al actualizar o registrar un caso
 */
export function procesarActualizacionCaso(casoAnterior, nuevosValores) {
  let resultado = { ...casoAnterior, ...nuevosValores };

  // Normalizar fechas de entrada
  if (resultado.fechaInicioPos) resultado.fechaInicioPos = normalizarFecha(resultado.fechaInicioPos);
  if (resultado.fechaPushPos) resultado.fechaPushPos = normalizarFecha(resultado.fechaPushPos);
  if (resultado.fechaInicioCat) resultado.fechaInicioCat = normalizarFecha(resultado.fechaInicioCat);
  if (resultado.fechaPushCat) resultado.fechaPushCat = normalizarFecha(resultado.fechaPushCat);
  if (resultado.fechaCreacion) resultado.fechaCreacion = normalizarFecha(resultado.fechaCreacion);

  // 1. Regla de Cierre de OP
  resultado.fechaCierre = aplicarReglaCierre(resultado.estado, resultado.fechaCierre);

  // 2. Regla de Salto de Etapa
  if (nuevosValores.etapa && nuevosValores.etapa !== casoAnterior.etapa) {
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
    const cambiosRespPos = aplicarReglaRespuestaDirecta('pos', resultado.respuestaPos, resultado);
    resultado = { ...resultado, ...cambiosRespPos };
  }
  if (resultado.respuestaCat) {
    const cambiosRespCat = aplicarReglaRespuestaDirecta('cat', resultado.respuestaCat, resultado);
    resultado = { ...resultado, ...cambiosRespCat };
  }

  // Cálculo de indicador activo
  const estLower = String(resultado.estado || '').toLowerCase();
  const esCerrado = estLower.includes('cerrado') || estLower.includes('fallido');
  resultado.esActivo = !esCerrado;

  return resultado;
}

/**
 * Detección de alertas de Push y SLA para la pestaña "Mis Casos"
 */
export function analizarAlertasCaso(caso) {
  const ahora = Date.now();
  const etapa = String(caso.etapa || '').toLowerCase();
  
  // 1. Alerta Push POS API:
  // Si está en espera ("Sin integración confirmada" o "En proceso de seteo") y la respuesta no es "Sí" ni "S/V"
  let requierePushPos = false;
  let motivoPushPos = '';
  if (caso.esActivo) {
    const enEsperaPos = etapa.includes('sin integración confirmada') || etapa.includes('sin integracion confirmada') || etapa.includes('en proceso de seteo');
    const respPosOk = caso.respuestaPos === 'Sí' || caso.respuestaPos === 'S/V';
    if (enEsperaPos && !respPosOk) {
      requierePushPos = true;
      if (!caso.fechaPushPos || caso.fechaPushPos === '') {
        motivoPushPos = 'Sin push inicial realizado';
      } else {
        const fechaUltimoPush = new Date(caso.fechaPushPos).getTime();
        const diasPasados = !isNaN(fechaUltimoPush) ? Math.floor((ahora - fechaUltimoPush) / (1000 * 60 * 60 * 24)) : 0;
        motivoPushPos = diasPasados > 0 ? `Hace ${diasPasados}d sin respuesta` : 'Push pendiente';
      }
    }
  }

  // 2. Alerta Push Catálogo:
  // Si está en "En proceso de verificación de catálogo" y la respuesta no es "Sí" ni "S/V"
  let requierePushCat = false;
  let motivoPushCat = '';
  if (caso.esActivo) {
    const enEsperaCat = etapa.includes('verificación de catálogo') || etapa.includes('verificacion de catalogo');
    const respCatOk = caso.respuestaCat === 'Sí' || caso.respuestaCat === 'S/V';
    if (enEsperaCat && !respCatOk) {
      requierePushCat = true;
      if (!caso.fechaPushCat || caso.fechaPushCat === '') {
        motivoPushCat = 'Requiere enviar catálogo a validación';
      } else {
        const fechaUltimoPushCat = new Date(caso.fechaPushCat).getTime();
        const diasPasadosCat = !isNaN(fechaUltimoPushCat) ? Math.floor((ahora - fechaUltimoPushCat) / (1000 * 60 * 60 * 24)) : 0;
        motivoPushCat = diasPasadosCat > 0 ? `Catálogo enviado hace ${diasPasadosCat}d` : 'Validación en curso';
      }
    }
  }

  // 3. Vencimiento de SLA:
  // Si hay Freeze en POS o Catálogo, el SLA está congelado
  const estaCongelado = Boolean(caso.freezePos || caso.freezeCat);
  const fechaReferencia = caso.freezePos || caso.freezeCat || caso.sla_inicio || caso.fechaCreacion || new Date().toISOString();
  
  let horasTranscurridas = 0;
  const tRef = new Date(fechaReferencia).getTime();
  if (!isNaN(tRef)) {
    const tiempoFin = estaCongelado ? new Date(caso.freezePos || caso.freezeCat).getTime() : ahora;
    horasTranscurridas = Math.max(0, Math.floor((tiempoFin - tRef) / (1000 * 60 * 60)));
  }

  const SLA_LIMITE_HORAS = 48; // 48 horas hábiles estándar de SLA
  const horasRestantes = Math.max(0, SLA_LIMITE_HORAS - horasTranscurridas);
  const esVencido = !estaCongelado && horasTranscurridas >= SLA_LIMITE_HORAS;
  const esProximoVencer = !estaCongelado && !esVencido && horasTranscurridas >= 24;

  return {
    requierePushPos,
    motivoPushPos,
    requierePushCat,
    motivoPushCat,
    estaCongelado,
    horasTranscurridas,
    horasRestantes,
    esVencido,
    esProximoVencer
  };
}
