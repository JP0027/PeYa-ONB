/**
 * Utilidades para normalización y coincidencia flexible de agentes
 * Permite vincular cuentas de Google Auth, correos corporativos y nombres en Sheets.
 */

export interface MiembroEquipo {
  nombre: string;
  rol: 'Supervisor' | 'Agente' | 'Agente / Supervisor';
  slugs: string[];
  correos: string[];
}

// Diccionario de miembros oficiales del equipo con roles asignados (4 TLs / Supervisores, 3 Agentes)
export const AGENTES_CONOCIDOS: MiembroEquipo[] = [
  // SUPERVISORES / TEAM LEADERS (4)
  {
    nombre: 'Kimberly Silvera',
    rol: 'Supervisor',
    slugs: ['kimberly', 'silvera', 'kimberly silvera', 'kimberly.silvera'],
    correos: [
      'kimberly.silvera_dyn.ext@pedidosya.com',
      'kimberly.silvera@pedidosya.com'
    ]
  },
  {
    nombre: 'Henry Serrato',
    rol: 'Supervisor',
    slugs: ['serrato', 'henry serrato', 'henry.serrato'],
    correos: [
      'henry.serrato_dyn.ext@pedidosya.com',
      'henry.serrato@pedidosya.com'
    ]
  },
  {
    nombre: 'Joseline Yactayo',
    rol: 'Supervisor',
    slugs: ['yactayo', 'joseline yactayo', 'joseline.yactayo'],
    correos: [
      'joseline.yactayo_dyn.ext@pedidosya.com',
      'joseline.yactayo@pedidosya.com'
    ]
  },
  {
    nombre: 'Yadira Flores',
    rol: 'Supervisor',
    slugs: ['flores', 'yadira flores', 'yadira.flores'],
    correos: [
      'yadira.flores_dyn.ext@pedidosya.com',
      'yadira.flores@pedidosya.com'
    ]
  },
  // AGENTES (3)
  {
    nombre: 'Joel Tocas',
    rol: 'Agente',
    slugs: ['tocas', 'joel tocas', 'joel.tocas'],
    correos: [
      'joel.tocas_dyn.ext@pedidosya.com',
      'joel.tocas@pedidosya.com'
    ]
  },
  {
    nombre: 'Prisila Leon',
    rol: 'Agente',
    slugs: ['leon', 'prisila leon', 'prisila.leon'],
    correos: [
      'prisila.leon_dyn.ext@pedidosya.com',
      'prisila.leon@pedidosya.com'
    ]
  },
  {
    nombre: 'Jean Palomino',
    rol: 'Agente',
    slugs: ['palomino', 'jppd', 'jean palomino', 'jean.palomino'],
    correos: [
      'jean.palomino_dyn.ext@pedidosya.com',
      'jean.palomino@pedidosya.com'
    ]
  }
];

export const SUPERVISORES = AGENTES_CONOCIDOS.filter(m => m.rol.includes('Supervisor'));
export const AGENTES_OPERATIVOS = AGENTES_CONOCIDOS.filter(m => m.rol.includes('Agente'));

export function normalizarTexto(texto: string): string {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes y diacríticos
    .replace(/[^a-z0-9]/g, ' ') // Quitar caracteres especiales
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizarCorreo(correo?: string): string {
  if (!correo) return '';
  return correo.toLowerCase().trim();
}

/**
 * Encuentra a qué miembro del equipo corresponde una consulta (nombre o correo)
 */
export function identificarMiembro(queryStr?: string): MiembroEquipo | null {
  if (!queryStr) return null;
  const qNorm = normalizarTexto(queryStr);
  const qEmail = normalizarCorreo(queryStr);
  const qPrefix = qEmail.includes('@') ? normalizarTexto(qEmail.split('@')[0]) : '';

  for (const m of AGENTES_CONOCIDOS) {
    if (m.correos.some(c => normalizarCorreo(c) === qEmail)) return m;
    if (normalizarTexto(m.nombre) === qNorm) return m;
    // Si la query coincide con un slug distintivo (ej. changanaqui, palomino, yadirayajaida)
    if (m.slugs.some(s => qNorm === normalizarTexto(s))) return m;
    // Si el prefijo del correo coincide con algún slug
    if (qPrefix && m.slugs.some(s => qPrefix === normalizarTexto(s) || qPrefix.includes(normalizarTexto(s)))) return m;
  }
  return null;
}

/**
 * Determina de manera precisa si un caso pertenece a un agente o supervisor seleccionado
 * Previene falsos positivos entre homónimos (ej: Jean Palomino vs Jean Changanaqui)
 */
export function isAgentMatch(
  caso: { agente?: string; propietarioTicket?: string; propietarioOportunidad?: string },
  userEmail?: string,
  userDisplayName?: string
): boolean {
  if (!userEmail && !userDisplayName) return false;
  
  const emailNormalizado = normalizarCorreo(userEmail || '');
  const nombreNormalizado = normalizarTexto(userDisplayName || userEmail || '');

  // Campos del caso a cotejar
  const targets = [
    caso.propietarioTicket,
    caso.agente
  ].filter(Boolean) as string[];

  if (targets.length === 0) return false;

  const targetsNormalizados = targets.map(t => normalizarTexto(t));
  const targetsLower = targets.map(t => t.toLowerCase().trim());

  // 1. Identificar si el usuario/filtro corresponde a un miembro conocido
  const miembroBuscado = identificarMiembro(userDisplayName || userEmail) || identificarMiembro(userEmail);

  if (miembroBuscado) {
    const nombreMiembroNorm = normalizarTexto(miembroBuscado.nombre);

    // Cotejar contra targets del caso
    for (let i = 0; i < targets.length; i++) {
      const tNorm = targetsNormalizados[i];
      const tLower = targetsLower[i];

      // Coincidencia exacta con nombre completo
      if (tNorm === nombreMiembroNorm) return true;

      // Coincidencia con correos del miembro
      if (miembroBuscado.correos.some(c => tLower.includes(c.toLowerCase()))) return true;

      // Coincidencia por apellidos / slugs únicos (evita comparar solo "jean")
      for (const slug of miembroBuscado.slugs) {
        const slugNorm = normalizarTexto(slug);
        if (slugNorm.length >= 5 && tNorm.includes(slugNorm)) {
          return true;
        }
      }
    }
    return false;
  }

  // 2. Si no es un miembro conocido en la lista fija, comparación directa y por coincidencia de subcadena
  for (const tLower of targetsLower) {
    if (tLower === emailNormalizado) return true;
    if (emailNormalizado.length >= 4 && tLower.includes(emailNormalizado)) return true;
  }

  for (const tNorm of targetsNormalizados) {
    if (tNorm === nombreNormalizado) return true;
    if (nombreNormalizado.length >= 3 && tNorm.length >= 3) {
      if (tNorm.includes(nombreNormalizado) || nombreNormalizado.includes(tNorm)) return true;
    }
  }

  return false;
}

/**
 * Valida de manera estricta si un caso pertenece al usuario actual
 * como Propietario de Ticket HeroCare (Columna K: Propietario de Ticket HeroCare)
 */
export function isHeroCareOwnerMatch(
  caso: { propietarioTicket?: string; [key: string]: any },
  userEmail?: string,
  userDisplayName?: string
): boolean {
  if (!caso || !caso.propietarioTicket) return false;
  const prop = String(caso.propietarioTicket).trim();
  if (!prop || prop === '-' || prop === 'Sin asignación' || prop === 'Sin asignar') return false;
  return isAgentMatch({ propietarioTicket: prop, agente: prop }, userEmail, userDisplayName);
}

