import fs from 'fs';
import path from 'path';

const ROLES_FILE_PATH = process.env.VERCEL
  ? path.join('/tmp', 'data_roles.json')
  : path.resolve(process.cwd(), 'data_roles.json');

const DEFAULT_ROLES = {
  roles: ['Agente', 'Supervisor / TL'],
  pestanasPorRol: {
    'Agente': ['admin', 'inicio', 'nuevo'],
    'Supervisor / TL': ['tl', 'admin', 'inicio', 'nuevo', 'usuarios']
  }
};

function leerRoles(): any {
  try {
    if (fs.existsSync(ROLES_FILE_PATH)) {
      const raw = fs.readFileSync(ROLES_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.roles)) return parsed;
    }
  } catch (e) {
    console.warn('[RolesAPI] Error leyendo roles:', e);
  }
  return DEFAULT_ROLES;
}

function guardarRoles(data: any) {
  try {
    fs.writeFileSync(ROLES_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[RolesAPI] Error guardando roles:', e);
  }
}

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, ...leerRoles() });
  }

  if (req.method === 'POST') {
    const { roles, pestanasPorRol } = req.body || {};
    const data = {
      roles: Array.isArray(roles) ? roles : DEFAULT_ROLES.roles,
      pestanasPorRol: pestanasPorRol && typeof pestanasPorRol === 'object' ? pestanasPorRol : DEFAULT_ROLES.pestanasPorRol
    };
    guardarRoles(data);
    return res.status(200).json({ success: true, ...data });
  }

  return res.status(200).json({ success: true, ...leerRoles() });
}
