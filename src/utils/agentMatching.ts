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

// Diccionario de miembros del equipo con roles asignados
export const AGENTES_CONOCIDOS: MiembroEquipo[] = [
  {
    nombre: 'Jean Palomino',
    rol: 'Agente / Supervisor',
    slugs: ['palomino', 'jppd', 'jean palomino', 'jean.palomino'],
    correos: [
      'jean.palomino_dyn.ext@pedidosya.com',
      'jppd.e270498@gmail.com',
      'jean.palomino@pedidosya.com'
    ]
  },
  {
    nombre: 'Yadira Flores',
    rol: 'Agente / Supervisor',
    slugs: ['flores', 'yadirayajaida', 'yadira flores', 'yadira.flores'],
    correos: [
      'yadira.flores_dyn.ext@pedidosya.com',
      'yadirayajaida@gmail.com',
      'yadira.flores@pedidosya.com'
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
    nombre: 'Joel Tocas',
    rol: 'Agente',
    slugs: ['tocas', 'joel tocas', 'joel.tocas'],
    correos: [
      'joel.tocas_dyn.ext@pedidosya.com',
      'joel.tocas@pedidosya.com'
    ]
  },
  {
    nombre: 'Henry Serrato',
    rol: 'Supervisor',
    slugs: ['serrato', 'henry serrato', 'henry.serrato'],
    correos: [
      'henry.serrato_dyn.ext@pedidosya.com'
    ]
  },
  {
    nombre: 'Joseline Yactayo',
    rol: 'Supervisor',
    slugs: ['yactayo', 'joseline yactayo', 'joseline.yactayo'],
    correos: [
      'joseline.yactayo_dyn.ext@pedidosya.com'
    ]
  },
  {
    nombre: 'Guillermo Gonzales',
    rol: 'Agente',
    slugs: ['gonzales', 'guillermo gonzales', 'guillermo.gonzales'],
    correos: [
      'guillermo.gonzales_dyn.ext@pedidosya.com',
      'guillermo.gonzales@pedidosya.com'
    ]
  },
  {
    nombre: 'Jean Changanaqui',
    rol: 'Agente',
    slugs: ['changanaqui', 'jean changanaqui', 'jean.changanaqui'],
    correos: [
      'jean.changanaqui_dyn.ext@pedidosya.com',
      'jean.changanaqui@pedidosya.com'
    ]
  },
  {
    nombre: 'Agente Demo',
    rol: 'Agente',
    slugs: ['agente demo', 'demo', 'agente.demo'],
    correos: [
      'agente.demo@pedidosya.com',
      'demo@pedidosya.com'
    ]
  },
  {
    nombre: 'Supervisor Demo',
    rol: 'Supervisor',
    slugs: ['supervisor demo', 'supervisor.demo'],
    correos: [
      'supervisor.demo@pedidosya.com'
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

export function normalizarCorreo(correo: string): string {
  if (!correo) return '';
  return correo.toLowerCase().trim();
}

/**
 * Encuentra a qué miembro del equipo corresponde una consulta (nombre o correo)
 */
export function identificarMiembro(queryStr: string): MiembroEquipo | null {
  if (!queryStr) return null;
  const qNorm = normalizarTexto(queryStr);
  const qEmail = normalizarCorreo(queryStr);

  for (const m of AGENTES_CONOCIDOS) {
    if (m.correos.some(c => normalizarCorreo(c) === qEmail)) return m;
    if (normalizarTexto(m.nombre) === qNorm) return m;
    // Si la query coincide con un slug distintivo (ej. changanaqui, palomino)
    if (m.slugs.some(s => qNorm === normalizarTexto(s))) return m;
  }
  return null;
}

/**
 * Determina de manera precisa si un caso pertenece a un agente o supervisor seleccionado
 * Previene falsos positivos entre homónimos (ej: Jean Palomino vs Jean Changanaqui)
 */
export function isAgentMatch(
  caso: { agente?: string; propietarioTicket?: string; propietarioOportunidad?: string },
  userEmail: string,
  userDisplayName?: string
): boolean {
  if (!userEmail && !userDisplayName) return false;
  
  const emailNormalizado = normalizarCorreo(userEmail || '');
  const nombreNormalizado = normalizarTexto(userDisplayName || userEmail || '');

  // Campos del caso a cotejar
  const targets = [
    caso.propietarioTicket,
    caso.propietarioOportunidad,
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

  // 2. Si no es un miembro conocido en la lista fija, comparación directa estricta
  for (const tLower of targetsLower) {
    if (tLower === emailNormalizado) return true;
  }

  for (const tNorm of targetsNormalizados) {
    if (tNorm === nombreNormalizado) return true;
  }

  return false;
}
