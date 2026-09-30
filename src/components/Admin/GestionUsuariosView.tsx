import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { LISTA_BLANCA_OFICIAL, LISTA_PESTANAS_SISTEMA, obtenerPestanasPorDefecto, RolUsuario } from '../../utils/userPermissions';

function obtenerNombreSugerido(correo: string): string {
  if (!correo) return '';
  const c = correo.toLowerCase().trim();
  if (LISTA_BLANCA_OFICIAL[c]?.nombre) {
    return LISTA_BLANCA_OFICIAL[c].nombre;
  }
  const parte = c.split('@')[0];
  const sinDyn = parte.replace(/_dyn\.ext$/, '').replace(/\.cxt$/, '');
  return sinDyn.split(/[._-]/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

export interface UsuarioFirestore {
  id: string;
  correo: string;
  nombre: string;
  rol: RolUsuario;
  pestanas: string[];
  actualizadoEn?: string | null;
}

export interface GestionUsuariosViewProps {
  nombreUsuarioAutenticado?: string;
  mostrarNotificacion?: (texto: string, tipo?: string) => void;
}

export default function GestionUsuariosView({ nombreUsuarioAutenticado, mostrarNotificacion }: GestionUsuariosViewProps) {
  const [usuarios, setUsuarios] = useState<UsuarioFirestore[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroRol, setFiltroRol] = useState<string>('todos');

  // Modal para agregar / editar usuario
  const [modalAbierto, setModoModalAbierto] = useState<boolean>(false);
  const [esEdicion, setEsEdicion] = useState<boolean>(false);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioFirestore | null>(null);
  const [formulario, setFormulario] = useState<{
    correo: string;
    nombre: string;
    rol: RolUsuario;
    pestanas: string[];
  }>({
    correo: '',
    nombre: '',
    rol: 'Agente',
    pestanas: obtenerPestanasPorDefecto('Agente')
  });
  const [guardando, setGuardando] = useState<boolean>(false);

  // Escuchar usuarios en Firestore en tiempo real con desduplicación inteligente
  useEffect(() => {
    const usuariosRef = collection(db, 'usuarios_permitidos');
    const unsubscribe = onSnapshot(usuariosRef, (snapshot) => {
      const mapaPorCorreo = new Map<string, UsuarioFirestore>();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const correo = (data.correo || docSnap.id).toLowerCase().trim();
        const nombre = data.nombre || obtenerNombreSugerido(correo);
        const rol: RolUsuario = data.rol || 'Agente';
        const pestanas = Array.isArray(data.pestanas) && data.pestanas.length > 0
          ? data.pestanas
          : obtenerPestanasPorDefecto(rol);

        // Si hay duplicados para el mismo correo, preferir el documento cuyo id sea exactamente el correo
        if (!mapaPorCorreo.has(correo) || docSnap.id === correo) {
          mapaPorCorreo.set(correo, {
            id: docSnap.id,
            correo,
            nombre,
            rol,
            pestanas,
            actualizadoEn: data.actualizadoEn || null
          });
        }
      });

      const lista = Array.from(mapaPorCorreo.values());

      // Si la colección está vacía en Firestore, pre-poblar automáticamente desde la lista blanca oficial
      if (lista.length === 0 && !snapshot.metadata.hasPendingWrites) {
        inicializarUsuariosDesdeListaOficial();
      } else {
        setUsuarios(lista);
        setCargando(false);
      }
    }, (err) => {
      console.error('Error cargando usuarios de Firestore:', err);
      // Fallback a la lista blanca oficial en memoria
      const listaOficial: UsuarioFirestore[] = Object.values(LISTA_BLANCA_OFICIAL).map(u => ({
        id: u.correo,
        correo: u.correo,
        nombre: u.nombre,
        rol: u.rol,
        pestanas: obtenerPestanasPorDefecto(u.rol),
        actualizadoEn: null
      }));
      setUsuarios(listaOficial);
      setCargando(false);
    });

    return () => unsubscribe();
  }, []);

  const inicializarUsuariosDesdeListaOficial = async () => {
    try {
      const oficiales = Object.values(LISTA_BLANCA_OFICIAL);
      for (const u of oficiales) {
        const docId = u.correo.toLowerCase().trim();
        await setDoc(doc(db, 'usuarios_permitidos', docId), {
          correo: docId,
          nombre: u.nombre,
          rol: u.rol,
          pestanas: obtenerPestanasPorDefecto(u.rol),
          actualizadoEn: new Date().toISOString()
        }, { merge: true });
      }
    } catch (e) {
      console.warn('Error sembrando usuarios oficiales en Firestore:', e);
    }
  };

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      const matchBusqueda = 
        u.nombre.toLowerCase().includes(busqueda.toLowerCase().trim()) ||
        u.correo.toLowerCase().includes(busqueda.toLowerCase().trim());
      if (!matchBusqueda) return false;

      if (filtroRol !== 'todos') {
        if (filtroRol === 'Supervisor' && !u.rol.includes('Supervisor')) return false;
        if (filtroRol === 'Agente' && u.rol !== 'Agente') return false;
        if (filtroRol === 'Agente / Supervisor' && u.rol !== 'Agente / Supervisor') return false;
      }
      return true;
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [usuarios, busqueda, filtroRol]);

  const abrirModalCrear = () => {
    setEsEdicion(false);
    setUsuarioEditando(null);
    setFormulario({ 
      correo: '', 
      nombre: '', 
      rol: 'Agente',
      pestanas: obtenerPestanasPorDefecto('Agente')
    });
    setModoModalAbierto(true);
  };

  const abrirModalEditar = (usuario: UsuarioFirestore) => {
    setEsEdicion(true);
    setUsuarioEditando(usuario);
    setFormulario({
      correo: usuario.correo,
      nombre: usuario.nombre || obtenerNombreSugerido(usuario.correo),
      rol: usuario.rol,
      pestanas: usuario.pestanas && usuario.pestanas.length > 0
        ? [...usuario.pestanas]
        : obtenerPestanasPorDefecto(usuario.rol)
    });
    setModoModalAbierto(true);
  };

  const guardarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    const correoLimpio = formulario.correo.toLowerCase().trim();
    const nombreLimpio = formulario.nombre.trim();

    if (!correoLimpio || !correoLimpio.includes('@')) {
      mostrarNotificacion && mostrarNotificacion('Ingresa un correo electrónico válido.', 'error');
      return;
    }
    if (!nombreLimpio) {
      mostrarNotificacion && mostrarNotificacion('Ingresa el nombre completo del usuario.', 'error');
      return;
    }
    if (!formulario.pestanas || formulario.pestanas.length === 0) {
      mostrarNotificacion && mostrarNotificacion('Debes seleccionar al menos una pestaña permitida para el usuario.', 'error');
      return;
    }

    setGuardando(true);
    try {
      const docId = correoLimpio;

      // Si es Agente, asegurar estrictamente que nunca tenga asignada la pestaña de Gestionar usuarios
      const pestanasFinales = (formulario.pestanas || []).filter(tabId => {
        if (formulario.rol === 'Agente' && tabId === 'usuarios') return false;
        return true;
      });

      // Si estábamos editando y el ID original en Firestore era diferente al docId (ej. ID aleatorio anterior), eliminar el doc antiguo para no duplicar
      if (esEdicion && usuarioEditando && usuarioEditando.id && usuarioEditando.id !== docId) {
        await deleteDoc(doc(db, 'usuarios_permitidos', usuarioEditando.id.trim())).catch(() => {});
      }

      await setDoc(doc(db, 'usuarios_permitidos', docId), {
        correo: correoLimpio,
        nombre: nombreLimpio,
        rol: formulario.rol,
        pestanas: pestanasFinales,
        actualizadoEn: new Date().toISOString()
      }, { merge: true });

      setModoModalAbierto(false);
      setUsuarioEditando(null);
      mostrarNotificacion && mostrarNotificacion(
        esEdicion 
          ? `✅ Usuario "${nombreLimpio}" actualizado con éxito.` 
          : `✅ Usuario "${nombreLimpio}" agregado al sistema con éxito.`,
        'success'
      );
    } catch (err: any) {
      console.error('Error guardando usuario en Firestore:', err);
      mostrarNotificacion && mostrarNotificacion(`Error al guardar usuario: ${err.message}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarUsuario = async (usuario: UsuarioFirestore) => {
    const nombreMostrar = usuario.nombre || obtenerNombreSugerido(usuario.correo) || usuario.correo;
    const confirmar = window.confirm(`¿Confirmas eliminar el acceso de "${nombreMostrar}" (${usuario.correo}) a Onboarding?`);
    if (!confirmar) return;

    try {
      // 1. Eliminar por su ID exacto de documento (sensible a mayúsculas/minúsculas en Firestore)
      if (usuario.id) {
        await deleteDoc(doc(db, 'usuarios_permitidos', usuario.id.trim()));
      }
      
      // 2. Si el ID era diferente al correo, eliminar también por el correo para asegurar que no quede huérfano
      const correoDocId = (usuario.correo || '').toLowerCase().trim();
      if (correoDocId && correoDocId !== usuario.id) {
        await deleteDoc(doc(db, 'usuarios_permitidos', correoDocId)).catch(() => {});
      }

      mostrarNotificacion && mostrarNotificacion(`Usuario "${nombreMostrar}" eliminado de los permisos.`, 'success');
    } catch (err: any) {
      console.error('Error eliminando usuario:', err);
      mostrarNotificacion && mostrarNotificacion(`Error al eliminar usuario: ${err.message}`, 'error');
    }
  };

  const conteoSupervisores = usuarios.filter(u => u.rol.includes('Supervisor')).length;
  const conteoAgentes = usuarios.filter(u => u.rol === 'Agente').length;

  return (
    <div className="space-y-6 w-full">
      {/* Encabezado */}
      <div className="bg-[#151824] border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-pink-950/60 border border-pink-800/60 text-pink-400 text-xs font-bold mb-2">
              👑 Gestionar usuarios a Onboarding
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Gestión de Usuarios y Permisos</h1>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl">
              Agrega, modifica roles y elimina accesos de usuarios a la plataforma de Onboarding. Los cambios se almacenan en Firebase y controlan en tiempo real los permisos y pestañas permitidas.
            </p>
          </div>

          <button
            onClick={abrirModalCrear}
            className="bg-pink-600 hover:bg-pink-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-pink-950/50 transition self-start md:self-auto cursor-pointer"
          >
            <span>➕</span>
            <span>Nuevo Usuario</span>
          </button>
        </div>

        {/* Resumen de Métricas de Roles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-4 border-t border-gray-800/80">
          <div className="bg-[#0f111a] border border-gray-800 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-gray-400">Total Usuarios</span>
            <span className="text-lg font-black text-white">{usuarios.length}</span>
          </div>
          <div className="bg-[#0f111a] border border-purple-900/40 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-purple-300">Supervisores</span>
            <span className="text-lg font-black text-purple-400">{conteoSupervisores}</span>
          </div>
          <div className="bg-[#0f111a] border border-cyan-900/40 rounded-xl p-3 flex items-center justify-between col-span-2 sm:col-span-1">
            <span className="text-xs text-cyan-300">Agentes Puros</span>
            <span className="text-lg font-black text-cyan-400">{conteoAgentes}</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-[#151824] border border-gray-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-lg">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={busqueda}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full bg-[#0f111a] border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-pink-500 font-mono"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-2.5 top-2 text-gray-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-gray-400 whitespace-nowrap">Filtrar Rol:</span>
          <select
            value={filtroRol}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFiltroRol(e.target.value)}
            className="bg-[#0f111a] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:border-pink-500 flex-1 sm:flex-none"
          >
            <option value="todos">Todos los roles ({usuarios.length})</option>
            <option value="Supervisor">Supervisores ({conteoSupervisores})</option>
            <option value="Agente">Agentes ({conteoAgentes})</option>
            <option value="Agente / Supervisor">Agente / Supervisor</option>
          </select>
        </div>
      </div>

      {/* Lista / Tabla de Usuarios */}
      <div className="bg-[#151824] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        {cargando ? (
          <div className="p-8 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
            <span className="animate-spin text-pink-500">⏳</span>
            <span>Cargando usuarios desde Firebase...</span>
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            No se encontraron usuarios coincidentes con la búsqueda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0f111a] border-b border-gray-800 text-gray-400 font-bold uppercase tracking-wider">
                  <th className="p-3.5">Usuario / Correo</th>
                  <th className="p-3.5">Rol Oficial</th>
                  <th className="p-3.5">Pestañas Visibles</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {usuariosFiltrados.map((u) => {
                  return (
                    <tr key={u.id} className="hover:bg-gray-800/30 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-white text-sm">{u.nombre}</div>
                        <div className="font-mono text-gray-400 text-[11px] mt-0.5">{u.correo}</div>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-block px-2.5 py-1 rounded-lg font-bold border text-[11px] ${
                          u.rol === 'Supervisor'
                            ? 'bg-purple-950/80 border-purple-700 text-purple-300'
                            : u.rol === 'Agente / Supervisor'
                            ? 'bg-pink-950/80 border-pink-700 text-pink-300'
                            : 'bg-cyan-950/80 border-cyan-700 text-cyan-300'
                        }`}>
                          {u.rol}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1.5 max-w-sm">
                          {u.pestanas && u.pestanas.length > 0 ? (
                            u.pestanas.map((pId) => {
                              const tabInfo = LISTA_PESTANAS_SISTEMA.find(t => t.id === pId);
                              return (
                                <span 
                                  key={pId} 
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                    pId === 'usuarios'
                                      ? 'bg-rose-950/70 border-rose-700/60 text-rose-300'
                                      : pId === 'tl'
                                      ? 'bg-purple-950/70 border-purple-700/60 text-purple-300'
                                      : pId === 'admin'
                                      ? 'bg-blue-950/70 border-blue-700/60 text-blue-300'
                                      : pId === 'inicio'
                                      ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                                      : 'bg-cyan-950/70 border-cyan-700/60 text-cyan-300'
                                  }`}
                                  title={tabInfo?.desc || ''}
                                >
                                  <span>{tabInfo?.icono || '📌'}</span>
                                  <span>{tabInfo?.label || pId}</span>
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-gray-500 italic text-[11px]">Sin pestañas</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => abrirModalEditar(u)}
                            className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 hover:border-gray-600 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer"
                            title="Editar usuario"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => eliminarUsuario(u)}
                            className="bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer"
                            title="Eliminar usuario"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para Agregar / Editar Usuario */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#161925] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6 relative max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{esEdicion ? '✏️' : '➕'}</span>
                <span>{esEdicion ? 'Modificar Usuario' : 'Añadir Nuevo Usuario'}</span>
              </h3>
              <button
                onClick={() => setModoModalAbierto(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={guardarUsuario} className="space-y-4 text-xs">
              <div>
                <label className="text-gray-300 block mb-1 font-semibold">Correo Electrónico *</label>
                <input
                  type="email"
                  value={formulario.correo}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, correo: e.target.value })}
                  disabled={esEdicion}
                  placeholder="ejemplo@pedidosya.com"
                  className={`w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white font-mono focus:border-pink-500 ${esEdicion ? 'opacity-60 cursor-not-allowed' : ''}`}
                  required
                />
                {esEdicion && (
                  <p className="text-[10px] text-gray-500 mt-1">El correo actúa como identificador único en Firebase.</p>
                )}
              </div>

              <div>
                <label className="text-gray-300 block mb-1 font-semibold">Nombre Completo *</label>
                <input
                  type="text"
                  value={formulario.nombre}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormulario({ ...formulario, nombre: e.target.value })}
                  placeholder="Ej: Jean Palomino"
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-gray-300 block mb-1 font-semibold">Rol Asignado *</label>
                <select
                  value={formulario.rol}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const nuevoRol = e.target.value as RolUsuario;
                    let tabsDef = obtenerPestanasPorDefecto(nuevoRol);
                    if (nuevoRol === 'Agente') {
                      tabsDef = tabsDef.filter(t => t !== 'usuarios');
                    }
                    setFormulario({ 
                      ...formulario, 
                      rol: nuevoRol,
                      pestanas: tabsDef
                    });
                  }}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 font-semibold cursor-pointer"
                >
                  <option value="Agente">Agente (Recomendado: Datos, Mis Casos, Búsqueda)</option>
                  <option value="Supervisor">Supervisor (Recomendado: Global, Datos, Búsqueda, Gestionar Usuarios)</option>
                  <option value="Agente / Supervisor">Agente / Supervisor (Todas las pestañas)</option>
                </select>
              </div>

              {/* Lista de Checkboxes de Pestañas Permitidas */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-gray-300 font-semibold block text-xs">
                    Pestañas Visibles y Permitidas *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      let tabsDef = obtenerPestanasPorDefecto(formulario.rol);
                      if (formulario.rol === 'Agente') {
                        tabsDef = tabsDef.filter(t => t !== 'usuarios');
                      }
                      setFormulario(prev => ({ ...prev, pestanas: tabsDef }));
                    }}
                    className="text-[11px] text-pink-400 hover:text-pink-300 hover:underline cursor-pointer"
                    title="Restablecer a las pestañas recomendadas según el rol seleccionado"
                  >
                    Restablecer por rol
                  </button>
                </div>

                <div className="space-y-1.5 bg-[#0f111a] border border-gray-800 rounded-xl p-2.5">
                  {LISTA_PESTANAS_SISTEMA.filter(tab => {
                    // A los de agentes NUNCA les debe aparecer la opción de Gestionar usuario
                    if (formulario.rol === 'Agente' && tab.id === 'usuarios') return false;
                    return true;
                  }).map(tab => {
                    const estaMarcada = formulario.pestanas?.includes(tab.id);
                    return (
                      <label 
                        key={tab.id}
                        className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition border ${
                          estaMarcada 
                            ? 'bg-gray-800/80 border-pink-500/50 text-white' 
                            : 'border-gray-900/60 text-gray-400 hover:bg-gray-800/40 hover:text-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={estaMarcada}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const checked = e.target.checked;
                            setFormulario(prev => {
                              const actual = prev.pestanas || [];
                              const nuevaLista = checked
                                ? [...actual, tab.id]
                                : actual.filter(id => id !== tab.id);
                              return { ...prev, pestanas: nuevaLista };
                            });
                          }}
                          className="mt-0.5 accent-pink-500 w-4 h-4 rounded cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <span>{tab.icono}</span>
                            <span className={estaMarcada ? 'text-white' : 'text-gray-400'}>{tab.label}</span>
                            {tab.id === 'usuarios' && (
                              <span className="text-[10px] bg-rose-950 text-rose-400 border border-rose-800 px-1.5 py-0.2 rounded font-mono ml-auto">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{tab.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {(!formulario.pestanas || formulario.pestanas.length === 0) && (
                  <p className="text-rose-400 text-[11px] mt-1.5 font-medium">
                    ⚠️ Debes seleccionar al menos una pestaña permitida para este usuario.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setModoModalAbierto(false)}
                  className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {guardando && <span className="animate-spin">⏳</span>}
                  <span>{esEdicion ? 'Actualizar Usuario' : 'Crear Usuario'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
