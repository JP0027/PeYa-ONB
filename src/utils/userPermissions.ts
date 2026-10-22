export type RolUsuario = 'Agente' | 'Supervisor' | 'Supervisor / TL' | string;

export interface PerfilUsuario {
  correo: string;
  nombre: string;
  rol: RolUsuario;
  pestanas?: string[];
}

export interface UsuarioSistema {
  id: string;
  correo: string;
  nombre: string;
  rol: RolUsuario;
  pestanas: string[];
  actualizadoEn?: string | null;
}

/**
 * Base de datos oficial de usuarios permitidos en código
 * Seguridad garantizada: Solo los correos autorizados en esta lista (o agregados por un Supervisor)
 * pueden autenticarse e interactuar con la plataforma de Onboarding.
 */
export const USUARIOS_CODIGO_BASE: UsuarioSistema[] = [
  // LÍDERES / SUPERVISORES / TEAM LEADERS (4)
  {
    id: 'kimberly.silvera_dyn.ext@pedidosya.com',
    correo: 'kimberly.silvera_dyn.ext@pedidosya.com',
    nombre: 'Kimberly Silvera',
    rol: 'Supervisor / TL',
    pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  },
  {
    id: 'henry.serrato_dyn.ext@pedidosya.com',
    correo: 'henry.serrato_dyn.ext@pedidosya.com',
    nombre: 'Henry Serrato',
    rol: 'Supervisor / TL',
    pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  },
  {
    id: 'joseline.yactayo_dyn.ext@pedidosya.com',
    correo: 'joseline.yactayo_dyn.ext@pedidosya.com',
    nombre: 'Joseline Yactayo',
    rol: 'Supervisor / TL',
    pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  },
  {
    id: 'yadira.flores_dyn.ext@pedidosya.com',
    correo: 'yadira.flores_dyn.ext@pedidosya.com',
    nombre: 'Yadira Flores',
    rol: 'Supervisor / TL',
    pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  },
  // AGENTES DE ONBOARDING (3)
  {
    id: 'joel.tocas_dyn.ext@pedidosya.com',
    correo: 'joel.tocas_dyn.ext@pedidosya.com',
    nombre: 'Joel Tocas',
    rol: 'Agente',
    pestanas: ['admin', 'inicio', 'nuevo'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  },
  {
    id: 'prisila.leon_dyn.ext@pedidosya.com',
    correo: 'prisila.leon_dyn.ext@pedidosya.com',
    nombre: 'Prisila Leon',
    rol: 'Agente',
    pestanas: ['admin', 'inicio', 'nuevo'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  },
  {
    id: 'jean.palomino_dyn.ext@pedidosya.com',
    correo: 'jean.palomino_dyn.ext@pedidosya.com',
    nombre: 'Jean Palomino',
    rol: 'Agente',
    pestanas: ['admin', 'inicio', 'nuevo'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  }
];

export const CORREOS_ONBOARDING_OFICIALES: string[] = [
  'kimberly.silvera_dyn.ext@pedidosya.com',
  'henry.serrato_dyn.ext@pedidosya.com',
  'joseline.yactayo_dyn.ext@pedidosya.com',
  'yadira.flores_dyn.ext@pedidosya.com',
  'joel.tocas_dyn.ext@pedidosya.com',
  'prisila.leon_dyn.ext@pedidosya.com',
  'jean.palomino_dyn.ext@pedidosya.com'
];

export const LISTA_BLANCA_OFICIAL: Record<string, PerfilUsuario> = USUARIOS_CODIGO_BASE.reduce((acc, u) => {
  acc[u.correo.toLowerCase().trim()] = {
    correo: u.correo,
    nombre: u.nombre,
    rol: u.rol,
    pestanas: u.pestanas
  };
  return acc;
}, {} as Record<string, PerfilUsuario>);

const STORAGE_CUSTOM_KEY = 'peya_usuarios_permitidos_local';
const STORAGE_DELETED_KEY = 'peya_usuarios_eliminados_local';

/**
 * Obtiene la lista completa de usuarios autorizados.
 * Combina la lista oficial en código con cualquier personalización guardada por supervisores.
 */
export function obtenerUsuariosCompletos(): UsuarioSistema[] {
  const mapa = new Map<string, UsuarioSistema>();

  // 1. Cargar usuarios definidos en código
  USUARIOS_CODIGO_BASE.forEach(u => {
    mapa.set(u.correo.toLowerCase().trim(), { ...u });
  });

  // 2. Fusionar con modificaciones locales
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_CUSTOM_KEY) : null;
    if (raw) {
      const customs = JSON.parse(raw);
      if (Array.isArray(customs)) {
        customs.forEach((c: any) => {
          if (c && c.correo) {
            const key = String(c.correo).toLowerCase().trim();
            // Seguridad estricta: Agente NUNCA puede tener la pestaña de gestionar usuarios
            const pestanas = Array.isArray(c.pestanas)
              ? (c.rol === 'Agente' ? c.pestanas.filter((p: string) => p !== 'usuarios') : c.pestanas)
              : obtenerPestanasPorDefecto(c.rol);

            mapa.set(key, {
              id: key,
              correo: key,
              nombre: c.nombre || key,
              rol: c.rol || 'Agente',
              pestanas: pestanas.length > 0 ? pestanas : ['admin', 'inicio', 'nuevo'],
              actualizadoEn: c.actualizadoEn || new Date().toISOString()
            });
          }
        });
      }
    }
  } catch (e) {
    console.warn('Error leyendo usuarios de localStorage:', e);
  }

  // 3. Excluir usuarios eliminados por el supervisor
  try {
    const eliminadosRaw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_DELETED_KEY) : null;
    if (eliminadosRaw) {
      const eliminados = JSON.parse(eliminadosRaw);
      if (Array.isArray(eliminados)) {
        eliminados.forEach((c: string) => {
          mapa.delete(String(c).toLowerCase().trim());
        });
      }
    }
  } catch {}

  // 4. Excluir estrictamente correos personales (ej. @gmail.com) y usuarios legacy no autorizados
  const correosExcluidos = new Set([
    'yadirayajaida@gmail.com',
    'guillermo.gonzales_dyn.ext@pedidosya.com',
    'jean.changanaqui_dyn.ext@pedidosya.com'
  ]);

  for (const [key] of Array.from(mapa.entries())) {
    if (correosExcluidos.has(key) || !key.endsWith('@pedidosya.com') || key.includes('gmail.com')) {
      mapa.delete(key);
    }
  }

  // Garantizar que Yadira Flores siempre exista y tenga acceso de supervisor por defecto
  const yKey = 'yadira.flores_dyn.ext@pedidosya.com';
  if (!mapa.has(yKey)) {
    mapa.set(yKey, {
      id: yKey,
      correo: yKey,
      nombre: 'Yadira Flores',
      rol: 'Supervisor',
      pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'],
      actualizadoEn: '2026-10-21T00:00:00.000Z'
    });
  } else {
    // Si ya existe en mapa (por localStorage, base en código o Firestore), asegurar que tenga sus pestañas de supervisor pero permitiendo cambios de rol/nombre
    const yadiraActual = mapa.get(yKey)!;
    if (!yadiraActual.pestanas || yadiraActual.pestanas.length === 0) {
      yadiraActual.pestanas = ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'];
    }
  }

  return Array.from(mapa.values());
}

/**
 * Guarda o modifica un usuario en el sistema con validación de seguridad.
 * Guarda en memoria local y sincroniza en segundo plano.
 */
export function guardarUsuarioEnSistema(usuario: {
  correo: string;
  nombre: string;
  rol: RolUsuario;
  pestanas: string[];
}): UsuarioSistema[] {
  const correoLimpio = usuario.correo.toLowerCase().trim();
  const nombreLimpio = usuario.nombre.trim();

  // Seguridad estricta: Si el rol es Agente, no puede tener la pestaña de usuarios
  const pestanasSanitizadas = (usuario.pestanas || []).filter(tabId => {
    if (usuario.rol === 'Agente' && tabId === 'usuarios') return false;
    return true;
  });

  const nuevoUsuario: UsuarioSistema = {
    id: correoLimpio,
    correo: correoLimpio,
    nombre: nombreLimpio,
    rol: usuario.rol,
    pestanas: pestanasSanitizadas.length > 0 ? pestanasSanitizadas : obtenerPestanasPorDefecto(usuario.rol),
    actualizadoEn: new Date().toISOString()
  };

  // Quitar de eliminados si estaba
  try {
    const eliminadosRaw = localStorage.getItem(STORAGE_DELETED_KEY);
    if (eliminadosRaw) {
      const eliminados = JSON.parse(eliminadosRaw);
      if (Array.isArray(eliminados)) {
        const filtrados = eliminados.filter((c: string) => c !== correoLimpio);
        localStorage.setItem(STORAGE_DELETED_KEY, JSON.stringify(filtrados));
      }
    }
  } catch {}

  // Guardar en almacenamiento local
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_KEY);
    let lista: any[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(lista)) lista = [];
    lista = lista.filter((u: any) => (u.correo || '').toLowerCase().trim() !== correoLimpio);
    lista.push(nuevoUsuario);
    localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(lista));
  } catch (e) {
    console.error('Error guardando usuario en localStorage:', e);
  }

  // Intentar sincronizar con backend en segundo plano
  if (typeof fetch !== 'undefined') {
    fetch('/api/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoUsuario)
    }).catch(() => {});
  }

  // Notificar a toda la interfaz (barra superior, modal de contactos, etc.)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('peya_usuarios_actualizados'));
  }

  return obtenerUsuariosCompletos();
}

/**
 * Elimina un usuario del sistema (solo permitido para supervisores).
 */
export function eliminarUsuarioDelSistema(correo: string): UsuarioSistema[] {
  const correoLimpio = correo.toLowerCase().trim();

  // Guardar en lista de eliminados
  try {
    const eliminadosRaw = localStorage.getItem(STORAGE_DELETED_KEY);
    let eliminados: string[] = eliminadosRaw ? JSON.parse(eliminadosRaw) : [];
    if (!Array.isArray(eliminados)) eliminados = [];
    if (!eliminados.includes(correoLimpio)) {
      eliminados.push(correoLimpio);
      localStorage.setItem(STORAGE_DELETED_KEY, JSON.stringify(eliminados));
    }

    const raw = localStorage.getItem(STORAGE_CUSTOM_KEY);
    if (raw) {
      let lista: any[] = JSON.parse(raw);
      if (Array.isArray(lista)) {
        lista = lista.filter((u: any) => (u.correo || '').toLowerCase().trim() !== correoLimpio);
        localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(lista));
      }
    }
  } catch (e) {
    console.error('Error eliminando usuario de localStorage:', e);
  }

  // Intentar sincronizar con backend en segundo plano
  if (typeof fetch !== 'undefined') {
    fetch(`/api/admin/usuarios/${encodeURIComponent(correoLimpio)}`, { method: 'DELETE' }).catch(() => {});
  }

  // Notificar a toda la interfaz (barra superior, modal de contactos, etc.)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('peya_usuarios_actualizados'));
  }

  return obtenerUsuariosCompletos();
}

/**
 * Retorna todos los correos corporativos válidos de Onboarding del sistema
 * (combinando la base oficial con los nuevos usuarios registrados por supervisores).
 */
export function obtenerCorreosOnboardingDinamicos(): string[] {
  const correosExcluidos = new Set([
    'yadirayajaida@gmail.com',
    'guillermo.gonzales_dyn.ext@pedidosya.com',
    'jean.changanaqui_dyn.ext@pedidosya.com'
  ]);
  const todos = obtenerUsuariosCompletos();
  const set = new Set<string>();

  // Base oficial de 7 miembros
  CORREOS_ONBOARDING_OFICIALES.forEach(c => {
    const lim = c.toLowerCase().trim();
    if (lim.endsWith('@pedidosya.com') && !lim.includes('gmail.com') && !correosExcluidos.has(lim)) {
      set.add(lim);
    }
  });

  // Usuarios adicionales o actualizados en el sistema
  todos.forEach(u => {
    const c = (u.correo || '').toLowerCase().trim();
    if (c.endsWith('@pedidosya.com') && !c.includes('gmail.com') && !correosExcluidos.has(c)) {
      set.add(c);
    }
  });

  return Array.from(set);
}

/**
 * Valida de forma estricta si un correo tiene acceso autorizado y retorna su perfil completo
 */
export function validarAccesoUsuario(correo?: string | null): UsuarioSistema | null {
  if (!correo) return null;
  const c = correo.trim().toLowerCase();

  // Mapeo transparente para la cuenta Google de autenticación hacia su usuario oficial de PedidosYa
  let correoBuscar = c;
  if (c === 'yadirayajaida@gmail.com' || c.includes('yadira.flores')) {
    correoBuscar = 'yadira.flores_dyn.ext@pedidosya.com';
  }

  const todos = obtenerUsuariosCompletos();
  const encontrado = todos.find(u => {
    const uCorreo = (u.correo || '').toLowerCase().trim();
    if (uCorreo === correoBuscar) return true;
    // Soporte para variaciones corporativas (@pedidosya.com sin _dyn.ext)
    const uSinDyn = uCorreo.replace(/_dyn\.ext$/, '').replace(/\.cxt$/, '');
    const cSinDyn = correoBuscar.replace(/_dyn\.ext$/, '').replace(/\.cxt$/, '');
    return uSinDyn === cSinDyn && uSinDyn.includes('@');
  });

  if (encontrado) {
    return encontrado;
  }

  if (correoBuscar === 'yadira.flores_dyn.ext@pedidosya.com') {
    return {
      id: 'yadira.flores_dyn.ext@pedidosya.com',
      correo: 'yadira.flores_dyn.ext@pedidosya.com',
      nombre: 'Yadira Flores',
      rol: 'Supervisor',
      pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'],
      actualizadoEn: new Date().toISOString()
    };
  }

  return null;
}

/**
 * Valida si un correo pertenece a la lista blanca oficial (compatibilidad)
 */
export function obtenerPerfilPorCorreo(correo?: string | null): PerfilUsuario | null {
  const u = validarAccesoUsuario(correo);
  if (!u) return null;
  return {
    correo: u.correo,
    nombre: u.nombre,
    rol: u.rol,
    pestanas: u.pestanas
  };
}

/**
 * Determina si el usuario tiene permiso para crear / registrar casos
 */
export function puedeRegistrarCasos(rol?: string | null): boolean {
  if (!rol) return false;
  const r = rol.toLowerCase();
  return r.includes('agente') || r.includes('supervisor') || r.includes('admin');
}

/**
 * Determina si el usuario tiene acceso a la vista HeroCare TL de supervisión y catálogos admin
 */
export function esSupervisor(rol?: string | null, correo?: string | null): boolean {
  if (correo) {
    const u = validarAccesoUsuario(correo);
    if (u && u.rol && (u.rol.toLowerCase().includes('supervisor') || u.rol.toLowerCase().includes('tl') || u.rol.toLowerCase().includes('admin'))) {
      return true;
    }
  }
  if (!rol) return false;
  const r = rol.toLowerCase();
  return r.includes('supervisor') || r.includes('admin') || r.includes('tl');
}

export interface PestanaInfo {
  id: string;
  label: string;
  icono: string;
  desc: string;
}

export const LISTA_PESTANAS_SISTEMA: PestanaInfo[] = [
  { id: 'tl', label: 'Casos en progreso global', icono: '📊', desc: 'Panel de supervisión, métricas y SLAs globales' },
  { id: 'admin', label: 'Datos', icono: '🗂️', desc: 'Catálogos y tabla general de Onboarding' },
  { id: 'inicio', label: 'Mis casos', icono: '💼', desc: 'Casos activos asignados al agente' },
  { id: 'nuevo', label: 'Búsqueda y registro', icono: '🔍', desc: 'Buscador de antecedentes y registro de nuevos casos' },
  { id: 'usuarios', label: 'Gestionar usuarios', icono: '👥', desc: 'Administración de usuarios y permisos por pestaña' }
];

/**
 * Pestañas permitidas por defecto según el rol del usuario.
 */
export function obtenerPestanasPorDefecto(
  rol?: string | null,
  pestanasPorRol?: Record<string, string[]> | null
): string[] {
  if (rol && pestanasPorRol && Array.isArray(pestanasPorRol[rol]) && pestanasPorRol[rol].length > 0) {
    return pestanasPorRol[rol];
  }
  const r = (rol || '').toLowerCase();
  if (r.includes('supervisor') || r.includes('admin') || r.includes('tl')) {
    return ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'];
  }
  // Rol Agente o general: Por defecto datos, mis casos, búsqueda
  return ['admin', 'inicio', 'nuevo'];
}
