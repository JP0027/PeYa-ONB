export type RolUsuario = 'Agente' | 'Supervisor' | 'Agente / Supervisor';

export interface PerfilUsuario {
  correo: string;
  nombre: string;
  rol: RolUsuario;
}

export const LISTA_BLANCA_OFICIAL: Record<string, PerfilUsuario> = {
  'jean.palomino_dyn.ext@pedidosya.com': {
    correo: 'jean.palomino_dyn.ext@pedidosya.com',
    nombre: 'Jean Palomino',
    rol: 'Agente / Supervisor'
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
    rol: 'Agente / Supervisor'
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
  },
  // Correo de desarrollo y testing del usuario autenticado
  'jppd.e270498@gmail.com': {
    correo: 'jppd.e270498@gmail.com',
    nombre: 'Jean Palomino',
    rol: 'Agente / Supervisor'
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
 * Determina si el usuario tiene permiso para crear / registrar casos (Agente o Agente / Supervisor)
 */
export function puedeRegistrarCasos(rol?: string | null): boolean {
  if (!rol) return false;
  const r = rol.toLowerCase();
  return r.includes('agente');
}

/**
 * Determina si el usuario tiene acceso a la vista HeroCare TL de supervisión
 */
export function esSupervisor(rol?: string | null): boolean {
  if (!rol) return false;
  const r = rol.toLowerCase();
  return r.includes('supervisor');
}
