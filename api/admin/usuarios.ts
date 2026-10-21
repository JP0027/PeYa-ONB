const USUARIOS_INICIALES = [
  {
    id: 'jean.palomino_dyn.ext@pedidosya.com',
    correo: 'jean.palomino_dyn.ext@pedidosya.com',
    nombre: 'Jean Palomino',
    rol: 'Supervisor',
    pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  },
  {
    id: 'yadira.flores_dyn.ext@pedidosya.com',
    correo: 'yadira.flores_dyn.ext@pedidosya.com',
    nombre: 'Yadira Flores',
    rol: 'Supervisor',
    pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  },
  {
    id: 'yadirayajaida@gmail.com',
    correo: 'yadirayajaida@gmail.com',
    nombre: 'Yadira Flores',
    rol: 'Supervisor',
    pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  },
  {
    id: 'henry.serrato_dyn.ext@pedidosya.com',
    correo: 'henry.serrato_dyn.ext@pedidosya.com',
    nombre: 'Henry Serrato',
    rol: 'Supervisor',
    pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  },
  {
    id: 'joseline.yactayo_dyn.ext@pedidosya.com',
    correo: 'joseline.yactayo_dyn.ext@pedidosya.com',
    nombre: 'Joseline Yactayo',
    rol: 'Supervisor',
    pestanas: ['tl', 'admin', 'inicio', 'nuevo', 'usuarios'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  },
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
    id: 'guillermo.gonzales_dyn.ext@pedidosya.com',
    correo: 'guillermo.gonzales_dyn.ext@pedidosya.com',
    nombre: 'Guillermo Gonzales',
    rol: 'Agente',
    pestanas: ['admin', 'inicio', 'nuevo'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  },
  {
    id: 'jean.changanaqui_dyn.ext@pedidosya.com',
    correo: 'jean.changanaqui_dyn.ext@pedidosya.com',
    nombre: 'Jean Changanaqui',
    rol: 'Agente',
    pestanas: ['admin', 'inicio', 'nuevo'],
    actualizadoEn: '2026-10-21T00:00:00.000Z'
  }
];

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      usuarios: USUARIOS_INICIALES
    });
  }

  if (req.method === 'POST') {
    const { correo, nombre, rol, pestanas } = req.body || {};
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

    return res.status(200).json({
      success: true,
      usuario: nuevoUsuario,
      usuarios: [nuevoUsuario, ...USUARIOS_INICIALES.filter(u => u.correo !== correoLimpio)]
    });
  }

  return res.status(200).json({
    success: true,
    usuarios: USUARIOS_INICIALES
  });
}
