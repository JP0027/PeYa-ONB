import fs from 'fs';
import path from 'path';

const USERS_FILE_PATH = process.env.VERCEL
  ? path.join('/tmp', 'data_usuarios.json')
  : path.resolve(process.cwd(), 'data_usuarios.json');

const USUARIOS_INICIALES = [
  // LÍDERES / SUPERVISORES / TEAM LEADERS
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
  {
    id: 'yadirayajaida@gmail.com',
    correo: 'yadirayajaida@gmail.com',
    nombre: 'Yadira Flores',
    rol: 'Supervisor / TL',
    pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  },
  // AGENTES DE ONBOARDING
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

function cargarUsuarios(): any[] {
  try {
    if (fs.existsSync(USERS_FILE_PATH)) {
      const raw = fs.readFileSync(USERS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const mapa = new Map<string, any>();
        USUARIOS_INICIALES.forEach(u => mapa.set(u.correo.toLowerCase().trim(), u));
        parsed.forEach(u => {
          if (u && u.correo) {
            mapa.set(u.correo.toLowerCase().trim(), u);
          }
        });
        return Array.from(mapa.values());
      }
    }
  } catch (e) {
    console.warn('[UsuariosAPI] Error leyendo data_usuarios.json:', e);
  }
  return USUARIOS_INICIALES;
}

function guardarUsuarios(usuarios: any[]) {
  try {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(usuarios, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[UsuariosAPI] Error guardando data_usuarios.json:', e);
  }
}

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let usuariosActuales = cargarUsuarios();

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      usuarios: usuariosActuales
    });
  }

  if (req.method === 'POST') {
    const rawBody = req.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody || {});
    const { correo, nombre, rol, pestanas } = body;
    const correoLimpio = String(correo || '').toLowerCase().trim();
    const nombreLimpio = String(nombre || '').trim();

    if (!correoLimpio || !correoLimpio.includes('@')) {
      return res.status(400).json({ success: false, error: 'Correo inválido' });
    }

    const rolValido = rol || 'Agente';
    const pestanasFinales = Array.isArray(pestanas) && pestanas.length > 0
      ? pestanas.filter((p: string) => rolValido !== 'Agente' || p !== 'usuarios')
      : ['admin', 'inicio', 'nuevo'];

    const nuevoUsuario = {
      id: correoLimpio,
      correo: correoLimpio,
      nombre: nombreLimpio || correoLimpio,
      rol: rolValido,
      pestanas: pestanasFinales,
      actualizadoEn: new Date().toISOString()
    };

    const mapa = new Map<string, any>();
    usuariosActuales.forEach(u => mapa.set(u.correo.toLowerCase().trim(), u));
    mapa.set(correoLimpio, nuevoUsuario);

    const listaFinal = Array.from(mapa.values());
    guardarUsuarios(listaFinal);

    return res.status(200).json({
      success: true,
      usuario: nuevoUsuario,
      usuarios: listaFinal
    });
  }

  if (req.method === 'DELETE') {
    let correoEliminar = String(req.query?.correo || req.body?.correo || '').toLowerCase().trim();
    if (!correoEliminar && req.url) {
      const parts = req.url.split('/');
      const last = parts[parts.length - 1];
      if (last && last.includes('@')) {
        correoEliminar = decodeURIComponent(last).toLowerCase().trim();
      }
    }

    if (!correoEliminar) {
      return res.status(400).json({ success: false, error: 'Se requiere el correo del usuario a eliminar' });
    }

    const filtrados = usuariosActuales.filter(u => (u.correo || '').toLowerCase().trim() !== correoEliminar);
    guardarUsuarios(filtrados);

    return res.status(200).json({
      success: true,
      message: `Usuario ${correoEliminar} eliminado correctamente`,
      usuarios: filtrados
    });
  }

  return res.status(200).json({
    success: true,
    usuarios: usuariosActuales
  });
}

