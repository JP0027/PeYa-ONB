import React, { useState, useMemo } from 'react';
import TablaOnboardingCasos from './TablaOnboardingCasos';
import {
  parsearCSVCatalogo,
  exportarCatalogoCSV,
  guardarCatalogosEnFirestore,
  guardarSeccionEnGoogleSheets,
  consultarCatalogosGoogleSheets,
  restaurarCatalogosPorDefecto,
  CATALOGOS_POR_DEFECTO
} from '../../services/catalogoService';

const CATEGORIAS = [
  { id: 'onboarding', label: 'Onboarding', desc: 'Listado completo de casos totales de la hoja Onboarding_New con opción de ampliar/editar y eliminar' },
  { id: 'integraciones', label: '🔌 Integraciones & Sponsorship', desc: 'Integraciones POS/API, sponsorship y contactos (Hoja: Integraciones_Sponsorship Cols A, B & C)' },
  { id: 'paises', label: '🌎 Países', desc: 'Países disponibles para asignación de casos (Hoja: Integraciones_Sponsorship Col E)' },
  { id: 'oportunidades', label: '💼 Oportunidades', desc: 'Tipos de oportunidad (Business Types) (Hoja: Integraciones_Sponsorship Col G)' },
  { id: 'assets', label: '💻 Assets', desc: 'Tipos de activo operativo (Hoja: Integraciones_Sponsorship Col I)' },
  { id: 'agentes', label: '👥 Agentes', desc: 'Agentes de HeroCare / Onboarding (Hoja: Integraciones_Sponsorship Col K)' },
  { id: 'estados', label: '📌 Estados del Caso', desc: 'Estados de seguimiento y cierre del caso (Hoja: Integraciones_Sponsorship Col M)' },
  { id: 'etapas', label: '🚀 Etapas del Onboarding', desc: 'Etapas del flujo operativo de onboarding (Hoja: Integraciones_Sponsorship Col O)' }
];

export interface AdminCatalogoViewProps {
  catalogos: Record<string, any[]>;
  onActualizarCatalogos?: (catalogos: any) => void;
  mostrarNotificacion?: (texto: string, tipo?: string) => void;
  casos?: any[];
  onSeleccionarCaso?: (caso: any) => void;
  onActualizarCaso?: (caso: any) => Promise<void> | void;
  onEliminarCaso?: (caso: any) => Promise<void> | void;
  sincronizando?: boolean;
  onForzarSyncCasos?: () => Promise<void> | void;
  setCargandoOperacion?: (texto: string | null) => void;
}

export default function AdminCatalogoView({
  catalogos,
  onActualizarCatalogos,
  mostrarNotificacion,
  casos = [],
  onSeleccionarCaso,
  onActualizarCaso,
  onEliminarCaso,
  sincronizando = false,
  onForzarSyncCasos,
  setCargandoOperacion
}: AdminCatalogoViewProps) {
  const [categoriaActiva, setCategoriaActiva] = useState<string>('onboarding');
  const [busqueda, setBusqueda] = useState<string>('');
  
  // Estado para nuevo elemento
  const [nuevoValor, setNuevoValor] = useState<string>('');
  const [nuevoSponsorship, setNuevoSponsorship] = useState<string>('NO');

  // Estado para edición en línea
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null);
  const [valorEditado, setValorEditado] = useState<string>('');
  const [sponEditado, setSponEditado] = useState<string>('NO');

  // Estado para importación CSV
  const [textoCSV, setTextoCSV] = useState<string>('');
  const [modoCsvAbierto, setModoCsvAbierto] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [recargandoSheets, setRecargandoSheets] = useState<boolean>(false);

  const listaActual = useMemo(() => {
    if (categoriaActiva === 'onboarding') return casos;
    return catalogos[categoriaActiva] || [];
  }, [catalogos, categoriaActiva, casos]);

  // Filtrar elementos según búsqueda
  const listaFiltrada = useMemo(() => {
    if (!busqueda.trim()) return listaActual;
    const term = busqueda.toLowerCase().trim();
    if (categoriaActiva === 'integraciones') {
      return listaActual.filter(item => 
        (typeof item === 'object' ? item.nombre : item).toLowerCase().includes(term)
      );
    }
    return listaActual.filter(item => String(item).toLowerCase().includes(term));
  }, [listaActual, busqueda, categoriaActiva]);

  // Recargar casos y catálogos en vivo desde Google Sheets
  const recargarDesdeSheets = async () => {
    setRecargandoSheets(true);
    if (setCargandoOperacion) {
      setCargandoOperacion('Sincronizando catálogos y casos con Google Sheets...');
    }
    try {
      if (onForzarSyncCasos) {
        await onForzarSyncCasos();
      } else {
        const data = await consultarCatalogosGoogleSheets();
        if (data && onActualizarCatalogos) {
          onActualizarCatalogos(data);
        }
      }
      mostrarNotificacion && mostrarNotificacion('Actualizado', 'success');
    } catch (err) {
      console.error('Error recargando desde Google Sheets:', err);
      mostrarNotificacion && mostrarNotificacion('Error recargando desde Google Sheets.', 'error');
    } finally {
      setRecargandoSheets(false);
      if (setCargandoOperacion) {
        setCargandoOperacion(null);
      }
    }
  };

  // Guardar cambio en catálogo (impacta en Firestore en tiempo real y en Google Sheets si está disponible)
  const persistirCambios = async (nuevaLista: any[], mensajeAccion?: string) => {
    setGuardando(true);
    const msg = mensajeAccion || `Guardando cambios en ${categoriaMeta?.label || 'catálogo'} y sincronizando...`;
    if (setCargandoOperacion) {
      setCargandoOperacion(msg);
    }
    try {
      const nuevosCatalogos = {
        ...catalogos,
        [categoriaActiva]: nuevaLista
      };

      // 1. Guardar en Google Sheets (hoja Integraciones_Sponsorship - fuente principal)
      try {
        const resSheets = await guardarSeccionEnGoogleSheets(categoriaActiva, nuevaLista);
        if (resSheets?.catalogos && onActualizarCatalogos) {
          onActualizarCatalogos(resSheets.catalogos);
        }
      } catch (sheetsErr) {
        console.warn('Notice guardando en Google Sheets:', sheetsErr);
      }

      // 2. Actualizar estado en UI inmediatamente
      if (onActualizarCatalogos) {
        onActualizarCatalogos(nuevosCatalogos);
      }

      // 3. Respaldar en Firestore en segundo plano (sin bloquear)
      guardarCatalogosEnFirestore(nuevosCatalogos as any).catch(() => {});

      mostrarNotificacion && mostrarNotificacion('Actualizado', 'success');
    } catch (err: any) {
      console.error('Error guardando catálogo:', err);
      mostrarNotificacion && mostrarNotificacion(`❌ Error al guardar: ${err.message}`, 'error');
    } finally {
      setGuardando(false);
      if (setCargandoOperacion) {
        setCargandoOperacion(null);
      }
    }
  };

  // Agregar nuevo elemento
  const manejarAgregar = async () => {
    const valLimpio = nuevoValor.trim();
    if (!valLimpio) {
      mostrarNotificacion && mostrarNotificacion('Ingresa un nombre o valor válido.', 'error');
      return;
    }

    const labelCat = categoriaMeta?.label || 'catálogo';

    if (categoriaActiva === 'integraciones') {
      const existe = listaActual.some(item => 
        (typeof item === 'object' ? item.nombre : item).toLowerCase() === valLimpio.toLowerCase()
      );
      if (existe) {
        mostrarNotificacion && mostrarNotificacion('Esa integración ya existe en la lista.', 'error');
        return;
      }
      const nuevoItem = { nombre: valLimpio, sponsorship: nuevoSponsorship };
      const nuevaLista = [...listaActual, nuevoItem].sort((a, b) => a.nombre.localeCompare(b.nombre));
      await persistirCambios(nuevaLista, `Agregando "${valLimpio}" a ${labelCat}...`);
    } else {
      const existe = listaActual.some(item => String(item).toLowerCase() === valLimpio.toLowerCase());
      if (existe) {
        mostrarNotificacion && mostrarNotificacion('Ese valor ya existe en la lista.', 'error');
        return;
      }
      const nuevaLista = [...listaActual, valLimpio];
      await persistirCambios(nuevaLista, `Agregando "${valLimpio}" a ${labelCat}...`);
    }

    setNuevoValor('');
    setNuevoSponsorship('NO');
  };

  // Iniciar edición
  const iniciarEdicion = (idx: number, item: any) => {
    setEditandoIdx(idx);
    if (categoriaActiva === 'integraciones') {
      setValorEditado(typeof item === 'object' ? item.nombre : item);
      setSponEditado(typeof item === 'object' ? item.sponsorship : 'NO');
    } else {
      setValorEditado(String(item));
    }
  };

  // Guardar edición
  const guardarEdicion = async (idxOriginal: number) => {
    const valLimpio = valorEditado.trim();
    if (!valLimpio) return;

    const labelCat = categoriaMeta?.label || 'catálogo';
    let nuevaLista = [...listaActual];
    if (categoriaActiva === 'integraciones') {
      nuevaLista[idxOriginal] = { nombre: valLimpio, sponsorship: sponEditado };
      nuevaLista.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else {
      nuevaLista[idxOriginal] = valLimpio;
    }

    await persistirCambios(nuevaLista, `Actualizando elemento en ${labelCat}...`);
    setEditandoIdx(null);
  };

  // Eliminar elemento
  const manejarEliminar = async (idxOriginal: number) => {
    if (!window.confirm('¿Seguro que deseas eliminar este elemento del catálogo?')) return;
    const itemAEliminar = listaActual[idxOriginal];
    const nombreItem = typeof itemAEliminar === 'object' ? itemAEliminar.nombre : String(itemAEliminar);
    const labelCat = categoriaMeta?.label || 'catálogo';
    const nuevaLista = listaActual.filter((_, idx) => idx !== idxOriginal);
    await persistirCambios(nuevaLista, `Eliminando "${nombreItem}" de ${labelCat}...`);
  };

  // Importar CSV
  const manejarImportarCSV = async (reemplazar = false) => {
    try {
      const itemsParseados = parsearCSVCatalogo(textoCSV, categoriaActiva);
      let nuevaLista: any[];
      if (reemplazar) {
        nuevaLista = itemsParseados;
      } else {
        // Añadir sin duplicar
        if (categoriaActiva === 'integraciones') {
          const mapaExistentes = new Map<string, any>();
          listaActual.forEach(item => {
            const nom = typeof item === 'object' ? item.nombre : item;
            mapaExistentes.set(nom.toLowerCase(), item);
          });
          itemsParseados.forEach((item: any) => {
            mapaExistentes.set(item.nombre.toLowerCase(), item);
          });
          nuevaLista = Array.from(mapaExistentes.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
        } else {
          const setExistentes = new Set(listaActual.map(v => String(v).toLowerCase()));
          nuevaLista = [...listaActual];
          itemsParseados.forEach((v: any) => {
            if (!setExistentes.has(String(v).toLowerCase())) {
              setExistentes.add(String(v).toLowerCase());
              nuevaLista.push(v);
            }
          });
        }
      }

      const labelCat = categoriaMeta?.label || 'catálogo';
      await persistirCambios(nuevaLista, `Importando ${itemsParseados.length} elementos en ${labelCat}...`);
      setTextoCSV('');
      setModoCsvAbierto(false);
      mostrarNotificacion && mostrarNotificacion(`Se importaron ${itemsParseados.length} elementos correctamente.`, 'success');
    } catch (err: any) {
      mostrarNotificacion && mostrarNotificacion(err.message, 'error');
    }
  };

  // Cargar archivo CSV desde disco
  const manejarArchivoCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      setTextoCSV(typeof event.target?.result === 'string' ? event.target.result : '');
      setModoCsvAbierto(true);
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Exportar CSV
  const manejarDescargarCSV = () => {
    const csvContent = exportarCatalogoCSV(categoriaActiva, listaActual);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `catalogo_${categoriaActiva}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Restaurar de fábrica
  const manejarRestaurar = async () => {
    if (!window.confirm('⚠️ ¿Estás seguro de que deseas restaurar TODOS los catálogos a sus valores oficiales iniciales?')) return;
    setGuardando(true);
    if (setCargandoOperacion) {
      setCargandoOperacion('Restaurando catálogos a valores oficiales iniciales...');
    }
    try {
      await restaurarCatalogosPorDefecto();
      const defecto = {
        paises: [...CATALOGOS_POR_DEFECTO.paises],
        oportunidades: [...CATALOGOS_POR_DEFECTO.oportunidades],
        assets: [...CATALOGOS_POR_DEFECTO.assets],
        agentes: [...(CATALOGOS_POR_DEFECTO.agentes || [])],
        estados: [...CATALOGOS_POR_DEFECTO.estados],
        etapas: [...CATALOGOS_POR_DEFECTO.etapas],
        integraciones: [...CATALOGOS_POR_DEFECTO.integraciones]
      };
      if (onActualizarCatalogos) onActualizarCatalogos(defecto);
      mostrarNotificacion && mostrarNotificacion('Catálogos restaurados a valores oficiales.', 'success');
    } catch (err) {
      mostrarNotificacion && mostrarNotificacion('Error restaurando catálogos.', 'error');
    } finally {
      setGuardando(false);
      if (setCargandoOperacion) {
        setCargandoOperacion(null);
      }
    }
  };

  const categoriaMeta = CATEGORIAS.find(c => c.id === categoriaActiva);

  return (
    <div className="space-y-6 w-full">
      {/* Encabezado */}
      <div className="bg-[#151824] border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-pink-950/60 border border-pink-800/60 text-pink-400 text-xs font-bold mb-2">
              📊 Datos: Catálogos de Onboarding
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Datos y Seleccionables</h1>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl">
              Información oficial de casos de <strong className="text-pink-400 font-mono">Onboarding_New</strong> y valores seleccionables sincronizados con Google Sheets.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={recargarDesdeSheets}
              disabled={recargandoSheets || sincronizando || guardando}
              className="bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 text-xs font-semibold px-3 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              title="Recargar los datos directamente desde la hoja de Google Sheets"
            >
              <span className={recargandoSheets || sincronizando ? 'animate-spin' : ''}>🔄</span>
              <span>{recargandoSheets || sincronizando ? 'Actualizando datos...' : 'Sincronizar desde Sheets'}</span>
            </button>
            <button
              onClick={manejarRestaurar}
              disabled={guardando}
              className="bg-gray-800/80 hover:bg-gray-700 text-gray-400 border border-gray-700 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
              title="Restaurar todos los catálogos a valores de fábrica"
            >
              Restaurar Valores Iniciales
            </button>
          </div>
        </div>

        {/* Selector de Categorías (Pills) */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-gray-800/80">
          {CATEGORIAS.map(cat => {
            const esActiva = categoriaActiva === cat.id;
            const count = cat.id === 'onboarding' ? casos.length : (catalogos[cat.id] || []).length;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setCategoriaActiva(cat.id);
                  setBusqueda('');
                  setEditandoIdx(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  esActiva
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/40 border border-pink-500'
                    : 'bg-[#0f111a] text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${esActiva ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido según categoría seleccionada */}
      {categoriaActiva === 'onboarding' ? (
        <TablaOnboardingCasos
          casos={casos}
          onEditarCaso={onSeleccionarCaso}
          onEliminarCaso={onEliminarCaso}
          mostrarNotificacion={mostrarNotificacion}
          cargando={recargandoSheets || sincronizando}
        />
      ) : (
        /* Contenedor Principal Catálogos */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Panel Izquierdo: Lista y Gestión (2 columnas) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Barra de Búsqueda y Agregar */}
          <div className="bg-[#151824] border border-gray-800 rounded-2xl p-4 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{categoriaMeta?.label}</span>
                  <span className="text-xs text-gray-500 font-normal">({listaFiltrada.length} de {listaActual.length})</span>
                </h2>
                <p className="text-[11px] text-gray-400">{categoriaMeta?.desc}</p>
              </div>

              {/* Input de filtro dentro de la categoría */}
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
                  placeholder={`Buscar en ${categoriaMeta?.label}...`}
                  className="w-full bg-[#0f111a] border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            {/* Formulario de Adición Rápida */}
            <div className="pt-3 border-t border-gray-800/80 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={nuevoValor}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevoValor(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && manejarAgregar()}
                placeholder={`Nuevo valor para ${categoriaMeta?.label}...`}
                className="flex-1 bg-[#0f111a] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />

              {categoriaActiva === 'integraciones' && (
                <select
                  value={nuevoSponsorship}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNuevoSponsorship(e.target.value)}
                  className="bg-[#0f111a] border border-gray-700 rounded-xl px-3 py-2 text-xs text-cyan-400 font-bold focus:outline-none"
                  title="¿Tiene estructura de Sponsorship?"
                >
                  <option value="NO">Sponsorship: NO</option>
                  <option value="SI">Sponsorship: SI</option>
                </select>
              )}

              <button
                onClick={manejarAgregar}
                disabled={guardando || !nuevoValor.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-md shadow-cyan-900/30"
              >
                <span>➕ Agregar</span>
              </button>
            </div>
          </div>

          {/* Tabla / Lista de Elementos */}
          <div className="bg-[#151824] border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#0f111a] text-gray-400 sticky top-0 uppercase tracking-wider border-b border-gray-800">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">Nombre / Valor</th>
                    {categoriaActiva === 'integraciones' && (
                      <th className="p-3 w-32 text-center">Sponsorship</th>
                    )}
                    <th className="p-3 w-28 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {listaFiltrada.map((item, idx) => {
                    const idxOriginal = listaActual.indexOf(item);
                    const esIntegracion = categoriaActiva === 'integraciones';
                    const nombre = esIntegracion ? item.nombre : String(item);
                    const spon = esIntegracion ? item.sponsorship : null;
                    const estaEditando = editandoIdx === idxOriginal;

                    return (
                      <tr key={idxOriginal} className="hover:bg-[#1a1d27]/70 transition">
                        <td className="p-3 text-center text-gray-500 font-mono text-[10px]">
                          {idxOriginal + 1}
                        </td>

                        <td className="p-3">
                          {estaEditando ? (
                            <input
                              type="text"
                              value={valorEditado}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValorEditado(e.target.value)}
                              className="w-full bg-[#0f111a] border border-pink-500 rounded px-2 py-1 text-xs text-white"
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium text-gray-200">{nombre}</span>
                          )}
                        </td>

                        {esIntegracion && (
                          <td className="p-3 text-center">
                            {estaEditando ? (
                              <select
                                value={sponEditado}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSponEditado(e.target.value)}
                                className="bg-[#0f111a] border border-pink-500 rounded px-2 py-1 text-xs text-cyan-400 font-bold"
                              >
                                <option value="NO">NO</option>
                                <option value="SI">SI</option>
                              </select>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  spon === 'SI'
                                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                                    : 'bg-gray-800/60 text-gray-400 border border-gray-700/50'
                                }`}
                              >
                                {spon === 'SI' ? '✓ SI' : '✗ NO'}
                              </span>
                            )}
                          </td>
                        )}

                        <td className="p-3 text-right whitespace-nowrap">
                          {estaEditando ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => guardarEdicion(idxOriginal)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded text-[10px] font-bold"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={() => setEditandoIdx(null)}
                                className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded text-[10px]"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => iniciarEdicion(idxOriginal, item)}
                                className="text-gray-400 hover:text-cyan-400 p-1 rounded hover:bg-gray-800 transition cursor-pointer"
                                title="Editar"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => manejarEliminar(idxOriginal)}
                                className="text-gray-400 hover:text-rose-400 p-1 rounded hover:bg-gray-800 transition cursor-pointer"
                                title="Eliminar"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {listaFiltrada.length === 0 && (
                    <tr>
                      <td colSpan={categoriaActiva === 'integraciones' ? 4 : 3} className="p-8 text-center text-gray-500">
                        {busqueda ? 'No se encontraron coincidencias para la búsqueda.' : 'No hay elementos en esta categoría.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Panel Derecho: Importación Masiva CSV e Instrucciones (1 columna) */}
        <div className="space-y-4">
          
          {/* Tarjeta de Importación CSV */}
          <div className="bg-[#151824] border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📁 Importar / Exportar CSV</span>
              </h3>
              <button
                onClick={manejarDescargarCSV}
                className="text-[11px] text-pink-400 hover:text-pink-300 font-semibold flex items-center gap-1 cursor-pointer"
                title="Descargar copia de respaldo en formato CSV"
              >
                <span>📤 Exportar CSV</span>
              </button>
            </div>

            {/* AVISO IMPORTANTE SOBRE COLUMNAS */}
            <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                <span>⚠️ IMPORTANTE SOBRE EL FORMATO CSV</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                El archivo o texto CSV para la categoría <strong className="text-white underline">{categoriaMeta?.label}</strong> debe respetar la siguiente estructura:
              </p>

              {categoriaActiva === 'integraciones' ? (
                <div className="bg-[#0f111a] border border-amber-900/50 p-2.5 rounded-lg text-[11px] font-mono text-gray-300 space-y-1">
                  <div className="text-pink-400 font-bold">Columnas requeridas (2 columnas):</div>
                  <div className="text-cyan-300">nombre,sponsorship</div>
                  <div className="text-gray-400 text-[10px] mt-1">Ejemplo:</div>
                  <div className="text-gray-400">Datalive,NO</div>
                  <div className="text-gray-400">Deliverect,SI</div>
                  <div className="text-gray-400">InvuPos,SI</div>
                </div>
              ) : (
                <div className="bg-[#0f111a] border border-amber-900/50 p-2.5 rounded-lg text-[11px] font-mono text-gray-300 space-y-1">
                  <div className="text-pink-400 font-bold">Columna requerida (1 columna):</div>
                  <div className="text-cyan-300">valor</div>
                  <div className="text-gray-400 text-[10px] mt-1">Ejemplo:</div>
                  <div className="text-gray-400">Opción 1</div>
                  <div className="text-gray-400">Opción 2</div>
                  <div className="text-gray-400">Opción 3</div>
                </div>
              )}

              <p className="text-[10px] text-gray-400">
                • Los duplicados se filtran automáticamente.<br />
                • Se admite separador por coma (,) o punto y coma (;).
              </p>
            </div>

            {/* Input de archivo CSV */}
            <div>
              <label className="block text-[11px] text-gray-400 mb-1.5 font-medium">
                Subir archivo .csv:
              </label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={manejarArchivoCSV}
                className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-800 file:text-pink-400 hover:file:bg-gray-700 cursor-pointer"
              />
            </div>

            {/* Textarea para pegar CSV */}
            <div>
              <label className="block text-[11px] text-gray-400 mb-1.5 font-medium">
                O pega el texto CSV directamente aquí:
              </label>
              <textarea
                value={textoCSV}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTextoCSV(e.target.value)}
                rows={6}
                placeholder={
                  categoriaActiva === 'integraciones'
                    ? "nombre,sponsorship\nMi Integracion,SI\nOtra Integracion,NO"
                    : "valor\nNuevo Elemento 1\nNuevo Elemento 2"
                }
                className="w-full bg-[#0f111a] border border-gray-800 rounded-xl p-2.5 text-xs text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-pink-500"
              />
            </div>

            {/* Botones de Importación */}
            {textoCSV.trim() && (
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => manejarImportarCSV(false)}
                  disabled={guardando}
                  className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-md shadow-pink-900/30 cursor-pointer"
                >
                  <span>📥 Agregar a los existentes</span>
                </button>
                <button
                  onClick={() => manejarImportarCSV(true)}
                  disabled={guardando}
                  className="w-full bg-rose-900/50 hover:bg-rose-800/80 text-rose-300 border border-rose-700/60 font-semibold py-1.5 rounded-xl text-[11px] transition cursor-pointer"
                >
                  <span>⚠️ Reemplazar catálogo completo</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
      )}

      {/* Overlay Fallback de Carga */}
      {guardando && !setCargandoOperacion && (
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-white animate-fadeIn">
          <div className="w-14 h-14 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold tracking-wide animate-pulse">Guardando cambios en catálogo...</p>
        </div>
      )}
    </div>
  );
}
