export type RolUsuario = 'Agente' | 'Supervisor' | 'Supervisor / TL' | string;

export interface PerfilUsuario {
  correo: string;
  nombre: string;
  rol: RolUsuario;
}

export const LISTA_BLANCA_OFICIAL: Record<string, PerfilUsuario> = {
  'jean.palomino_dyn.ext@pedidosya.com': {
    correo: 'jean.palomino_dyn.ext@pedidosya.com',
    nombre: 'Jean Palomino',
    rol: 'Supervisor'
  },
  'joel.tocas_dyn.ext@pedidosya.com': {
    correo: 'joel.tocas_dyn.ext@pedidosya.com',
    nombre: 'Joel Tocas',
    rol: 'Agente'
  },
  'prisila.leon_dyn.ext@pedidosya.com': {
    correo: 'prisila.leon_dyn.ext@pedidosya.com',
    nombre: 'Prisila Leon',
    rol: 'Agente'
  },
  'yadira.flores_dyn.ext@pedidosya.com': {
    correo: 'yadira.flores_dyn.ext@pedidosya.com',
    nombre: 'Yadira Flores',
    rol: 'Supervisor'
  },
  'henry.serrato_dyn.ext@pedidosya.com': {
    correo: 'henry.serrato_dyn.ext@pedidosya.com',
    nombre: 'Henry Serrato',
    rol: 'Supervisor'
  },
  'joseline.yactayo_dyn.ext@pedidosya.com': {
    correo: 'joseline.yactayo_dyn.ext@pedidosya.com',
    nombre: 'Joseline Yactayo',
    rol: 'Supervisor'
  }
};

/**
 * Valida si un correo pertenece a la lista blanca oficial
 */
export function obtenerPerfilPorCorreo(correo?: string | null): PerfilUsuario | null {
  if (!correo) return null;
  const c = correo.trim().toLowerCase();
  return LISTA_BLANCA_OFICIAL[c] || null;
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
export function esSupervisor(rol?: string | null): boolean {
  if (!rol) return false;
  const r = rol.toLowerCase();
  return r.includes('supervisor') || r.includes('admin');
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
 * Admite configuración personalizada por rol cargada desde Firestore.
 */
export function obtenerPestanasPorDefecto(
  rol?: string | null,
  pestanasPorRol?: Record<string, string[]> | null
): string[] {
  if (rol && pestanasPorRol && Array.isArray(pestanasPorRol[rol]) && pestanasPorRol[rol].length > 0) {
    return pestanasPorRol[rol];
  }
  const r = (rol || '').toLowerCase();
  if (r.includes('supervisor')) {
    return ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'];
  }
  // Rol Agente o general: Por defecto datos, mis casos, búsqueda
  return ['admin', 'inicio', 'nuevo'];
}
