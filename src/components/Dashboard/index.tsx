import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from '../../firebase';
import { isAgentMatch, identificarMiembro } from '../../utils/agentMatching';
import { esSupervisor, puedeRegistrarCasos, obtenerPestanasPorDefecto, LISTA_PESTANAS_SISTEMA } from '../../utils/userPermissions';
import { procesarActualizacionCaso, analizarAlertasCaso, limpiarTextoEtapa, formatearFechaHora, esPushKamRealizado, normalizarRespuesta } from '../../utils/onboardingRules';
import { LISTA_INTEGRACIONES_OFICIALES } from '../../data/catalogoOnboarding';

import { consultarCasosGoogleSheets, actualizarCasoEnSheets, eliminarCasoGoogleSheets } from '../../services/googleSheetsService';
import { eliminarCasoFirestore, guardarCasosEnFirestore } from '../../services/firebaseCasosService';

import SearchBar from './SearchBar';
import CasoForm from './CasoForm';
import CasoCard from './CasoCard';
import AlertBadge from './AlertBadge';
import SyncIndicator from './SyncIndicator';
import ConfigModal from './ConfigModal';

import ModalDetalleCaso from '../ModalDetalleCaso';
import TLDashboard from '../TLDashboard';
import AdminCatalogoView from '../Admin/AdminCatalogoView';
import GestionUsuariosView from '../Admin/GestionUsuariosView';
import PushAlertContainer, { AlertaPush } from './PushAlertToast';
import { suscribirCatalogos, CATALOGOS_POR_DEFECTO, consultarCatalogosGoogleSheets, guardarCatalogosEnFirestore } from '../../services/catalogoService';

export interface DashboardProps {
  role?: string;
  email?: string;
  nombreUsuario?: string;
  onLogout?: () => void;
}

export interface FormularioNuevoCaso {
  casoOp: string;
  vendorId: string;
  tienda: string;
  pais: string;
  kam: string;
  integracion: string;
  oportunidad: string;
  asset: string;
  propietarioOportunidad: string;
  propietarioTicket: string;
  casoSeguimiento: string;
  tieneCasoInicio: string;
  comentarios: string;
  estado: string;
  etapa: string;
  fechaCreacion: string;
  sla_inicio?: string;
}

function esCasoMayorA24Horas(c: any, track: string = 'general'): boolean {
  if (!c) return false;
  // 1. Horas numéricas calculadas o acumuladas
  const horas = c.horasSLA || c.totalHorasOp || 0;
  if (typeof horas === 'number' && horas >= 24) return true;

  // 2. Tiempo transcurrido en texto con indicación de días (1 día = 24h)
  const txtOp = String(c.tiempoTranscurridoOp || c.tiempoTranscurridoLV || '').toLowerCase();
  const txtPos = String(c.tiempoTranscurridoPos || '').toLowerCase();
  const txtCat = String(c.tiempoTranscurridoCat || '').toLowerCase();
  if (track === 'pos' && txtPos.includes('d')) return true;
  if (track === 'cat' && txtCat.includes('d')) return true;
  if (txtOp.includes('d')) return true;

  // 3. Rangos SLA oficiales
  const rangos = [
    String(c.rangoSlaOp || c.rangoSla || '').toLowerCase(),
    track === 'pos' ? String(c.rangoSlaPos || '').toLowerCase() : '',
    track === 'cat' ? String(c.rangoSlaCat || '').toLowerCase() : ''
  ];

  for (const r of rangos) {
    if (!r || r === '-' || r === 's/v') continue;
    if (r.includes('<24') || r.includes('<4') || r.includes('≤6') || r.includes('0h a') || r.includes('>6h a')) continue;
    if (r.includes('≥24') || r.includes('>=24') || r.includes('>72') || r.includes('≥96') || r.includes('>=96')) return true;
    if (r.includes('24h') || r.includes('72h') || r.includes('96h')) return true;
  }

  return false;
}

function detectarCasosPushPendientes(casos: any[], rol?: string, emailUsuario?: string, nombreUsuario?: string): AlertaPush[] {
  if (!Array.isArray(casos) || casos.length === 0) return [];

  const esRolSupervisor = 
    rol?.toLowerCase().includes('supervisor') ||
    rol?.toLowerCase().includes('tl') ||
    rol?.toLowerCase().includes('leader');

  const casosActivos = casos.filter(c => {
    if (!c) return false;
    const est = String(c.estado || '').toLowerCase().trim();
    if (est.includes('cerrad') || est.includes('fallid') || est.includes('cancel')) return false;
    return true;
  });

  const ahora = new Date();
  const horaTexto = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const resultados: AlertaPush[] = [];

  if (esRolSupervisor) {
    casosActivos.forEach(c => {
      const opLabel = (c.casoOp && c.casoOp !== '-' && c.casoOp !== 'Sin caso OP') ? c.casoOp : (c.vendorId || c.id || 'Sin caso OP');
      const tiendaLabel = c.tienda || 'Sin tienda';

      // 1. Falta Push KAM en POS API: Si tiene fecha de inicio, fecha de push, en respuesta dice NO y Push KAM no está hecho
      const tieneInicioPos = Boolean(c.fechaInicioPos && c.fechaInicioPos !== 'S/V' && c.fechaInicioPos !== '-');
      const tienePushPos = Boolean(c.fechaPushPos && c.fechaPushPos !== 'S/V' && c.fechaPushPos !== '-');
      const respNoPos = normalizarRespuesta(c.respuestaPos) === 'No';
      const faltaKamPos = tieneInicioPos && tienePushPos && respNoPos && !esPushKamRealizado(c.pushKamPos);
      const esMasDe24Pos = esCasoMayorA24Horas(c, 'pos');

      if (faltaKamPos && esMasDe24Pos) {
        resultados.push({
          id: `kam_pos_${c.id || c.casoOp}`,
          caso: c,
          tipo: 'kam_pos',
          titulo: 'Push KAM POS Pendiente',
          hora: horaTexto,
          mensaje: `Falta push con KAM (>24 hrs) en caso OP #${opLabel} (${tiendaLabel})`
        });
      }

      // 2. Falta Push KAM en Catálogo: Si tiene fecha de inicio, fecha de push, en respuesta dice NO y Push KAM no está hecho
      const tieneInicioCat = Boolean(c.fechaInicioCat && c.fechaInicioCat !== 'S/V' && c.fechaInicioCat !== '-');
      const tienePushCat = Boolean(c.fechaPushCat && c.fechaPushCat !== 'S/V' && c.fechaPushCat !== '-');
      const respNoCat = normalizarRespuesta(c.respuestaCat) === 'No';
      const faltaKamCat = tieneInicioCat && tienePushCat && respNoCat && !esPushKamRealizado(c.pushKamCat);
      const esMasDe24Cat = esCasoMayorA24Horas(c, 'cat');

      if (faltaKamCat && esMasDe24Cat) {
        resultados.push({
          id: `kam_cat_${c.id || c.casoOp}`,
          caso: c,
          tipo: 'kam_cat',
          titulo: 'Push KAM Catálogo Pendiente',
          hora: horaTexto,
          mensaje: `Falta push con KAM (>24 hrs) en caso OP #${opLabel} (${tiendaLabel})`
        });
      }
    });
  } else {
    const misCasos = casosActivos.filter(c => isAgentMatch(c, emailUsuario, nombreUsuario));
    misCasos.forEach(c => {
      const horas = c.horasSLA || c.totalHorasOp || 0;
      const rOp = String(c.rangoSlaOp || c.rangoSla || '').toLowerCase();
      const rPos = String(c.rangoSlaPos || '').toLowerCase();
      const rCat = String(c.rangoSlaCat || '').toLowerCase();

      const enRango4a6 = (horas >= 4 && horas <= 6) ||
                         rOp.includes('4h') || rOp.includes('6h') || rOp.includes('≥4') ||
                         rPos.includes('4h') || rPos.includes('6h') || rPos.includes('≥4') ||
                         rCat.includes('4h') || rCat.includes('6h') || rCat.includes('≥4');
      if (!enRango4a6) return;

      const opLabel = (c.casoOp && c.casoOp !== '-' && c.casoOp !== 'Sin caso OP') ? c.casoOp : (c.vendorId || c.id || 'Sin caso OP');
      const tiendaLabel = c.tienda || 'Sin tienda';

      // Falta push de seguimiento en POS API
      const tieneInicioPos = Boolean(c.fechaInicioPos && c.fechaInicioPos !== 'S/V' && c.fechaInicioPos !== '-');
      const faltaPushPos = !c.fechaPushPos || c.fechaPushPos === '' || c.fechaPushPos === '-';
      const noResueltoPos = c.respuestaPos !== 'Sí' && c.respuestaPos !== 'Si' && c.respuestaPos !== 'S/V';
      if (tieneInicioPos && faltaPushPos && noResueltoPos) {
        resultados.push({
          id: `push_pos_${c.id || c.casoOp}`,
          caso: c,
          tipo: 'push_pos',
          titulo: 'Push de Seguimiento POS Pendiente',
          hora: horaTexto,
          mensaje: `Falta realizar push de seguimiento (4 a 6 hrs) en caso OP #${opLabel} (${tiendaLabel})`
        });
      }

      // Falta push de seguimiento en Catálogo
      const tieneInicioCat = Boolean(c.fechaInicioCat && c.fechaInicioCat !== 'S/V' && c.fechaInicioCat !== '-');
      const faltaPushCat = !c.fechaPushCat || c.fechaPushCat === '' || c.fechaPushCat === '-';
      const noResueltoCat = c.respuestaCat !== 'Sí' && c.respuestaCat !== 'Si' && c.respuestaCat !== 'S/V';
      if (tieneInicioCat && faltaPushCat && noResueltoCat) {
        resultados.push({
          id: `push_cat_${c.id || c.casoOp}`,
          caso: c,
          tipo: 'push_cat',
          titulo: 'Push de Seguimiento Catálogo Pendiente',
          hora: horaTexto,
          mensaje: `Falta realizar push de seguimiento (4 a 6 hrs) en caso OP #${opLabel} (${tiendaLabel})`
        });
      }
    });
  }

  return resultados;
}

export default function Dashboard({ role, email, nombreUsuario, onLogout }: DashboardProps) {
  const tieneAccesoSupervisor = useMemo(() => esSupervisor(role), [role]);
  const puedeRegistrar = useMemo(() => puedeRegistrarCasos(role), [role]);

  // Sidebar responsivo y colapsable
  const [sidebarColapsado, setSidebarColapsado] = useState<boolean>(false);
  const [sidebarMovilAbierto, setSidebarMovilAbierto] = useState<boolean>(false);

  // Overlay global de carga
  const [cargandoOperacion, setCargandoOperacion] = useState<string | null>(null);

  // Columnas redimensionables en Mis Casos
  const [colWidthsMisCasos, setColWidthsMisCasos] = useState<Record<string, number>>({
    op: 120,
    tienda: 230,
    pais: 120,
    integracion: 120,
    estado: 150,
    pushPos: 120,
    pushCat: 120,
    sla: 110,
    asignado: 130,
    accion: 100
  });

  const iniciarRedimensionarMisCasos = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidthsMisCasos[colKey] || 120;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setColWidthsMisCasos(prev => ({
        ...prev,
        [colKey]: Math.max(60, startWidth + delta)
      }));
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Lista dinámica de pestañas permitidas para el usuario autenticado (desde Firestore o por defecto)
  const [pestanasPermitidas, setPestanasPermitidas] = useState<string[]>(() => {
    const porDefecto = obtenerPestanasPorDefecto(role);
    return !tieneAccesoSupervisor ? porDefecto.filter(p => p !== 'usuarios') : porDefecto;
  });

  const puedeVerTab = useCallback((tabId: string): boolean => {
    if (tabId === 'usuarios' && !tieneAccesoSupervisor) return false;
    return pestanasPermitidas.includes(tabId);
  }, [pestanasPermitidas, tieneAccesoSupervisor]);

  const [activeTab, setActiveTabState] = useState<string>(() => {
    const saved = sessionStorage.getItem('peya_onb_active_tab');
    const tabsDefecto = obtenerPestanasPorDefecto(role);
    const tabsValidas = !tieneAccesoSupervisor ? tabsDefecto.filter(p => p !== 'usuarios') : tabsDefecto;
    if (saved && tabsValidas.includes(saved)) {
      return saved;
    }
    return tabsValidas[0] || (tieneAccesoSupervisor ? 'tl' : 'inicio');
  });

  const setActiveTab = useCallback((tab: string) => {
    sessionStorage.setItem('peya_onb_active_tab', tab);
    setActiveTabState(tab);
  }, []);

  // Escuchar permisos de pestañas en tiempo real desde Firestore
  useEffect(() => {
    if (!email) return;
    const correoLimpio = String(email).trim().toLowerCase();
    const unsubscribe = onSnapshot(doc(db, 'usuarios_permitidos', correoLimpio), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        let tabs = Array.isArray(data.pestanas) && data.pestanas.length > 0 
          ? data.pestanas 
          : obtenerPestanasPorDefecto(data.rol || role);
        
        const esRolSupervisorActual = esSupervisor(data.rol || role);
        if (!esRolSupervisorActual) {
          tabs = tabs.filter((t: string) => t !== 'usuarios');
        }
        setPestanasPermitidas(tabs);
      } else {
        const porDefecto = obtenerPestanasPorDefecto(role);
        setPestanasPermitidas(!tieneAccesoSupervisor ? porDefecto.filter(p => p !== 'usuarios') : porDefecto);
      }
    }, (error) => {
      console.warn("No se pudo obtener permisos específicos de usuario desde Firestore:", error);
      const porDefecto = obtenerPestanasPorDefecto(role);
      setPestanasPermitidas(!tieneAccesoSupervisor ? porDefecto.filter(p => p !== 'usuarios') : porDefecto);
    });

    return () => unsubscribe();
  }, [email, role, tieneAccesoSupervisor]);

  useEffect(() => {
    if (!pestanasPermitidas || pestanasPermitidas.length === 0) return;
    if (!puedeVerTab(activeTab)) {
      const primeraValida = pestanasPermitidas.find(p => puedeVerTab(p));
      if (primeraValida) {
        setActiveTab(primeraValida);
      }
    }
  }, [pestanasPermitidas, activeTab, puedeVerTab, setActiveTab]);

  const [casosFirestore, setCasosFirestore] = useState<any[]>([]);
  const [casosSheets, setCasosSheets] = useState<any[]>(() => {
    try {
      const local = localStorage.getItem('PEDA_CASOS_LOCAL');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [];
  });
  const [cargandoSheets, setCargandoSheets] = useState<boolean>(false);
  const [ultimaSync, setUltimaSync] = useState<Date | null>(() => {
    try {
      const saved = localStorage.getItem('PEDA_ULTIMA_SYNC');
      return saved ? new Date(saved) : new Date();
    } catch {
      return new Date();
    }
  });
  
  const [casoSeleccionadoModal, setCasoSeleccionadoModal] = useState<any | null>(null);
  const [filtroMisCasos, setFiltroMisCasos] = useState<string>('todos');
  
  // Ordenamiento en Mis Casos: 2 botones independientes
  const [tipoOrdenMisCasos, setTipoOrdenMisCasos] = useState<'sla' | 'tienda'>('sla');
  const [sentidoTienda, setSentidoTienda] = useState<'asc' | 'desc'>('asc');

  const [mostrarModalCreds, setMostrarModalCreds] = useState<boolean>(false);
  
  const [busquedaResultados, setBusquedaResultados] = useState<any[]>([]);
  const [cargandoBusqueda, setCargandoBusqueda] = useState<boolean>(false);
  const [subTabNuevo, setSubTabNuevo] = useState<'busqueda' | 'registro'>('busqueda');
  const [notificacion, setNotificacion] = useState<{ texto: string; tipo: 'success' | 'error' | 'info' } | null>(null);
  const [alertasPushActivas, setAlertasPushActivas] = useState<AlertaPush[]>([]);
  const [casoResaltadoId, setCasoResaltadoId] = useState<string | null>(null);

  const mostrarNotificacion = (texto: string, tipo: string = "success") => {
    const tipoNormalizado: 'success' | 'error' | 'info' = tipo === 'error' ? 'error' : (tipo === 'info' ? 'info' : 'success');
    setNotificacion({ texto, tipo: tipoNormalizado });
    setTimeout(() => setNotificacion(null), 4000);
  };

  const manejarClicAlertaPush = useCallback((alerta: AlertaPush) => {
    if (!alerta || !alerta.caso) return;
    const targetCaso = alerta.caso;
    const idBuscado = String(targetCaso.casoOp || targetCaso.vendorId || targetCaso.id || '').trim();

    if (puedeVerTab('tl')) {
      setActiveTab('tl');
    } else if (puedeVerTab('inicio')) {
      setActiveTab('inicio');
    } else if (pestanasPermitidas.length > 0) {
      setActiveTab(pestanasPermitidas[0]);
    }

    setCasoResaltadoId(idBuscado);

    setTimeout(() => {
      const el = document.getElementById(`caso-row-${idBuscado}`) || 
                 document.getElementById(`caso-row-${targetCaso.id}`) ||
                 document.getElementById(`caso-row-${targetCaso.casoOp}`) ||
                 document.getElementById(`caso-row-${targetCaso.vendorId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);

    setAlertasPushActivas(prev => prev.filter(a => a.id !== alerta.id));

    setTimeout(() => {
      setCasoResaltadoId(prev => (prev === idBuscado ? null : prev));
    }, 8000);
  }, [puedeVerTab, pestanasPermitidas, setActiveTab]);

  const manejarCerrarAlertaPush = useCallback((id: string | number) => {
    setAlertasPushActivas(prev => prev.filter(a => a.id !== id));
  }, []);

  const manejarCerrarTodasAlertasPush = useCallback(() => {
    setAlertasPushActivas([]);
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const casosCountRef = useRef<number>(0);

  const miembroActual = useMemo(() => identificarMiembro(email), [email]);
  const nombreUsuarioAutenticado = nombreUsuario || miembroActual?.nombre || (email || '').split('@')[0] || 'Usuario';

  const [formulario, setFormulario] = useState<FormularioNuevoCaso>(() => {
    const ahora = formatearFechaHora(new Date());
    return {
      casoOp: '', vendorId: '', tienda: '', pais: 'Argentina', kam: '',
      integracion: 'Datalive', oportunidad: 'Franchise Extensión', asset: 'Integración',
      propietarioOportunidad: nombreUsuarioAutenticado, propietarioTicket: nombreUsuarioAutenticado,
      casoSeguimiento: '', tieneCasoInicio: 'Si', comentarios: '', estado: 'En progreso',
      etapa: 'Sin integración confirmada', 
      fechaCreacion: ahora,
      sla_inicio: ahora
    };
  });

  const [catalogosDinamicos, setCatalogosDinamicos] = useState<any>(CATALOGOS_POR_DEFECTO);

  useEffect(() => {
    const unsubscribe = suscribirCatalogos((nuevosCatalogos) => {
      setCatalogosDinamicos(nuevosCatalogos);
    });
    return () => unsubscribe();
  }, []);

  const [listaIntegraciones, setListaIntegraciones] = useState<string[]>(LISTA_INTEGRACIONES_OFICIALES);

  useEffect(() => {
    fetch('/api/sheets/catalogos')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.catalogos) {
          setCatalogosDinamicos((prev: any) => ({
            ...prev,
            ...data.catalogos
          }));
          if (Array.isArray(data.catalogos.integraciones) && data.catalogos.integraciones.length > 0) {
            setListaIntegraciones(data.catalogos.integraciones.map((i: any) => typeof i === 'object' ? i.nombre : i));
          }
        }
      })
      .catch(() => {});
  }, []);

  const listaIntegracionesNombres = useMemo(() => {
    if (catalogosDinamicos?.integraciones && catalogosDinamicos.integraciones.length > 0) {
      return catalogosDinamicos.integraciones.map((i: any) => typeof i === 'object' ? i.nombre : i);
    }
    return listaIntegraciones;
  }, [catalogosDinamicos, listaIntegraciones]);

  const cargarCasosGoogleSheets = async (silencioso = false) => {
    if (!silencioso) {
      setCargandoSheets(true);
      setCargandoOperacion('Sincronizando casos y datos desde Google Sheets...');
    }
    try {
      const dataCasos = await consultarCasosGoogleSheets();
      if (Array.isArray(dataCasos) && dataCasos.length > 0) {
        setCasosSheets(dataCasos);
        setUltimaSync(new Date());
        try { localStorage.setItem('PEDA_ULTIMA_SYNC', new Date().toISOString()); } catch (_) {}

        // Sincronizar casos activos en Firestore para que Firebase siempre tenga la data real de Sheets
        const casosActivosParaSync = dataCasos.filter((c: any) => c.esActivo);
        if (casosActivosParaSync.length > 0) {
          guardarCasosEnFirestore(casosActivosParaSync).catch(errSync => {
            console.warn('[Dashboard] Sincronización silenciosa con Firestore:', errSync);
          });
        }
      }

      const dataCatalogos = await consultarCatalogosGoogleSheets();
      if (dataCatalogos) {
        setCatalogosDinamicos(dataCatalogos);
        if (Array.isArray(dataCatalogos.integraciones) && dataCatalogos.integraciones.length > 0) {
          setListaIntegraciones(dataCatalogos.integraciones.map((i: any) => typeof i === 'object' ? i.nombre : i));
        }
        guardarCatalogosEnFirestore(dataCatalogos).catch(err => {
          console.warn('[Dashboard] Error guardando catálogos en Firestore:', err);
        });
      }

      if (!silencioso) {
        mostrarNotificacion('Actualizado', 'success');
      }
    } catch (err: any) {
      console.warn("Consulta Google Sheets fallida:", err);
      if (!silencioso) {
        mostrarNotificacion(`Error al sincronizar: ${err?.message || 'Error de conexión'}`, 'error');
      }
    } finally {
      if (!silencioso) {
        setCargandoSheets(false);
        setCargandoOperacion(null);
      }
    }
  };

  useEffect(() => {
    cargarCasosGoogleSheets(true);
  }, []);

  useEffect(() => {
    const casosRef = collection(db, "casos");
    const unsubscribe = onSnapshot(casosRef, (snapshot) => {
      const nuevosCasos = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      casosCountRef.current = nuevosCasos.length;
      setCasosFirestore(nuevosCasos);
      setUltimaSync(new Date());
      try { localStorage.setItem('PEDA_ULTIMA_SYNC', new Date().toISOString()); } catch (_) {}
    }, (err) => {
      console.warn("Firestore subscription warning:", err);
    });
    return () => unsubscribe();
  }, []);

  const casosTotales = useMemo(() => {
    if (!casosSheets || casosSheets.length === 0) return casosFirestore;
    if (!casosFirestore || casosFirestore.length === 0) return casosSheets;

    const firestoreMap = new Map<string, any>();
    casosFirestore.forEach(c => {
      const docId = String(c.id || '').trim();
      const op = String(c.casoOp || '').trim();
      if (docId) firestoreMap.set(docId, c);
      if (op && !firestoreMap.has(op)) firestoreMap.set(op, c);
    });

    return casosSheets.map(s => {
      const idKey = String(s.id || '').trim();
      const opKey = String(s.casoOp || '').trim();
      const filaKey = s.filaNumero ? `${opKey || 'caso'}_${s.filaNumero}` : '';
      
      const fCaso = (idKey && firestoreMap.get(idKey)) || 
                    (filaKey && firestoreMap.get(filaKey)) || 
                    (opKey && firestoreMap.get(opKey));

      if (!fCaso) return s;

      const sheetsCerrado = !s.esActivo || String(s.estado || '').toLowerCase().match(/cerrad|fallid|cancel/);
      const sheetsSinOp = String(s.estado || '').toLowerCase().includes('sin oportunidad');

      const pushKamPosFinal = (s.pushKamPos !== undefined && s.pushKamPos !== '') 
        ? s.pushKamPos 
        : (fCaso.pushKamPos !== undefined ? fCaso.pushKamPos : 'FALSE');

      const pushKamCatFinal = (s.pushKamCat !== undefined && s.pushKamCat !== '') 
        ? s.pushKamCat 
        : (fCaso.pushKamCat !== undefined ? fCaso.pushKamCat : 'FALSE');

      let respuestaPosFinal = (s.respuestaPos !== undefined && s.respuestaPos !== '') 
        ? s.respuestaPos 
        : (fCaso.respuestaPos || '');

      let respuestaCatFinal = (s.respuestaCat !== undefined && s.respuestaCat !== '') 
        ? s.respuestaCat 
        : (fCaso.respuestaCat || '');

      // Sanear: si no hay fecha de push y la etapa está en espera, respuesta no puede ser 'No'
      const etapaMergeLower = String(s.etapa || fCaso.etapa || '').toLowerCase();
      const esEsperaPos = etapaMergeLower.includes('sin integración confirmada') || etapaMergeLower.includes('sin integracion confirmada') || etapaMergeLower.includes('en proceso de seteo');
      const tienePushPos = Boolean((s.fechaPushPos && s.fechaPushPos !== 'S/V' && s.fechaPushPos !== '-') || (fCaso.fechaPushPos && fCaso.fechaPushPos !== 'S/V' && fCaso.fechaPushPos !== '-'));
      if (esEsperaPos && !tienePushPos && respuestaPosFinal === 'No') {
        respuestaPosFinal = '';
      }

      const esEsperaCat = etapaMergeLower.includes('verificación de catálogo') || etapaMergeLower.includes('verificacion de catalogo') || etapaMergeLower.includes('carga de catálogo') || etapaMergeLower.includes('carga de catalogo');
      const tienePushCat = Boolean((s.fechaPushCat && s.fechaPushCat !== 'S/V' && s.fechaPushCat !== '-') || (fCaso.fechaPushCat && fCaso.fechaPushCat !== 'S/V' && fCaso.fechaPushCat !== '-'));
      if (esEsperaCat && !tienePushCat && respuestaCatFinal === 'No') {
        respuestaCatFinal = '';
      }

      return {
        ...s,
        comentarios: fCaso.comentarios || s.comentarios,
        fechaPushPos: (s.fechaPushPos && s.fechaPushPos !== 'S/V' && s.fechaPushPos !== '-') ? s.fechaPushPos : (fCaso.fechaPushPos || s.fechaPushPos),
        fechaPushCat: (s.fechaPushCat && s.fechaPushCat !== 'S/V' && s.fechaPushCat !== '-') ? s.fechaPushCat : (fCaso.fechaPushCat || s.fechaPushCat),
        pushKamPos: pushKamPosFinal,
        pushKamCat: pushKamCatFinal,
        respuestaPos: respuestaPosFinal,
        respuestaCat: respuestaCatFinal,
        freezePos: (s.freezePos && s.freezePos !== '-') ? s.freezePos : (fCaso.freezePos || s.freezePos),
        freezeCat: (s.freezeCat && s.freezeCat !== '-') ? s.freezeCat : (fCaso.freezeCat || s.freezeCat),
        estado: sheetsCerrado ? s.estado : (sheetsSinOp ? s.estado : (fCaso.estado || s.estado)),
        esActivo: sheetsCerrado ? false : s.esActivo
      };
    });
  }, [casosFirestore, casosSheets]);

  const sesionUsuarioKey = useMemo(() => `${email || ''}_${nombreUsuarioAutenticado || ''}`, [email, nombreUsuarioAutenticado]);
  const alertaLoginEjecutadaRef = useRef<boolean>(false);
  const casosTotalesRef = useRef<any[]>(casosTotales);
  useEffect(() => {
    casosTotalesRef.current = casosTotales;
  }, [casosTotales]);

  const reproducirCampana = useCallback(() => {
    if (!audioRef.current) return;
    try {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 0.8;
      const promise = audioRef.current.play();
      if (promise !== undefined) {
        promise.catch(() => {
          const sonarAlClic = () => {
            audioRef.current?.play().catch(() => {});
            window.removeEventListener('click', sonarAlClic);
          };
          window.addEventListener('click', sonarAlClic, { once: true });
        });
      }
    } catch (e) {
      console.warn('[Audio] Error al reproducir timbre:', e);
    }
  }, []);

  // 1. Al iniciar sesión: sonar y mostrar alertas tipo push (máximo 2 veces en la sesión)
  useEffect(() => {
    if (casosTotales.length === 0) return;

    const loginKey = 'peya_login_alarm_' + sesionUsuarioKey;
    if (alertaLoginEjecutadaRef.current || sessionStorage.getItem(loginKey) === 'true') {
      return;
    }

    alertaLoginEjecutadaRef.current = true;
    sessionStorage.setItem(loginKey, 'true');
    sessionStorage.setItem('peya_ultimo_timbre_ts', String(Date.now()));

    const pendientes = detectarCasosPushPendientes(casosTotales, role, email, nombreUsuarioAutenticado);
    if (pendientes.length > 0) {
      reproducirCampana();
      setAlertasPushActivas(pendientes);
      sessionStorage.setItem('peya_sesion_push_reproducciones_' + sesionUsuarioKey, '1');
    }
  }, [casosTotales.length > 0, sesionUsuarioKey, role, email, nombreUsuarioAutenticado, reproducirCampana]);

  // 2. Recordatorio cada 10 minutos (suena solo 2 veces en total por sesión para todos los usuarios)
  useEffect(() => {
    const timer = setInterval(() => {
      const ultimoTs = parseInt(sessionStorage.getItem('peya_ultimo_timbre_ts') || '0', 10);
      const ahora = Date.now();
      const INTERVALO_RECORDATORIO_MS = 10 * 60 * 1000; // 10 minutos

      if (ultimoTs > 0 && ahora - ultimoTs >= INTERVALO_RECORDATORIO_MS) {
        sessionStorage.setItem('peya_ultimo_timbre_ts', String(ahora));
        const casosActuales = casosTotalesRef.current || [];
        if (casosActuales.length > 0) {
          const pendientes = detectarCasosPushPendientes(casosActuales, role, email, nombreUsuarioAutenticado);
          if (pendientes.length > 0) {
            const veces = parseInt(sessionStorage.getItem('peya_sesion_push_reproducciones_' + sesionUsuarioKey) || '0', 10);
            if (veces < 2) {
              reproducirCampana();
              sessionStorage.setItem('peya_sesion_push_reproducciones_' + sesionUsuarioKey, String(veces + 1));
            }
            setAlertasPushActivas(pendientes);
          }
        }
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [role, email, nombreUsuarioAutenticado, sesionUsuarioKey, reproducirCampana]);

  const esCasoActivo = (c: any): boolean => {
    if (!c) return false;
    const est = String(c.estado || '').toLowerCase().trim();
    if (est.includes('cerrad') || est.includes('fallid') || est.includes('cancel')) return false;
    if (est.includes('sin oportunidad') || est.includes('progreso') || est === 'nuevo' || est === 'abierto' || est === 'activo') return true;
    if (c.esActivo === true) return true;
    return false;
  };

  const casosMostrados = useMemo(() => {
    if (activeTab === 'global') return casosTotales.filter(esCasoActivo);
    if (activeTab === 'inicio') {
      return casosTotales.filter(c => esCasoActivo(c) && isAgentMatch(c, email, nombreUsuarioAutenticado));
    }
    return casosTotales;
  }, [casosTotales, activeTab, email, nombreUsuarioAutenticado]);

  const casosConAlertas = useMemo(() => casosMostrados.map(c => ({ caso: c, alertas: analizarAlertasCaso(c) })), [casosMostrados]);
  
  const totalEnProgresoNormal = useMemo(() => casosConAlertas.filter(x => {
    const est = String(x.caso.estado || '').toLowerCase().trim();
    const esSinOp = est.includes('sin oportunidad') || !x.caso.casoOp || String(x.caso.casoOp).trim() === '' || String(x.caso.casoOp).toLowerCase() === 'sin caso op';
    return !esSinOp && (est === 'en progreso' || est.includes('progreso'));
  }).length, [casosConAlertas]);

  const totalSinOportunidad = useMemo(() => casosConAlertas.filter(x => {
    const est = String(x.caso.estado || '').toLowerCase().trim();
    return est.includes('sin oportunidad') || !x.caso.casoOp || String(x.caso.casoOp).trim() === '' || String(x.caso.casoOp).toLowerCase() === 'sin caso op';
  }).length, [casosConAlertas]);

  const totalPos = useMemo(() => casosConAlertas.filter(x => x.alertas.requierePushPos).length, [casosConAlertas]);
  const totalCat = useMemo(() => casosConAlertas.filter(x => x.alertas.requierePushCat).length, [casosConAlertas]);
  const totalSla = useMemo(() => casosConAlertas.filter(x => x.alertas.esVencido || x.alertas.esProximoVencer || x.alertas.esCritico).length, [casosConAlertas]);

  const listaFiltrada = useMemo(() => {
    const filtrados = casosConAlertas.filter(x => {
      const est = String(x.caso.estado || '').toLowerCase().trim();
      const esSinOp = est.includes('sin oportunidad') || !x.caso.casoOp || String(x.caso.casoOp).trim() === '' || String(x.caso.casoOp).toLowerCase() === 'sin caso op';
      if (filtroMisCasos === 'enProgreso') {
        return !esSinOp && (est === 'en progreso' || est.includes('progreso'));
      }
      if (filtroMisCasos === 'sinOportunidad') {
        return esSinOp;
      }
      if (filtroMisCasos === 'pushPos') return x.alertas.requierePushPos;
      if (filtroMisCasos === 'pushCat') return x.alertas.requierePushCat;
      if (filtroMisCasos === 'sla') return x.alertas.esVencido || x.alertas.esProximoVencer || x.alertas.esCritico;
      return true;
    });

    if (tipoOrdenMisCasos === 'tienda') {
      if (sentidoTienda === 'asc') {
        return [...filtrados].sort((a, b) => 
          String(a.caso.tienda || '').localeCompare(String(b.caso.tienda || ''), 'es', { sensitivity: 'base' })
        );
      } else {
        return [...filtrados].sort((a, b) => 
          String(b.caso.tienda || '').localeCompare(String(a.caso.tienda || ''), 'es', { sensitivity: 'base' })
        );
      }
    }

    // Por defecto: ordenar por prioridad de SLA
    return [...filtrados].sort((a, b) => {
      const critA = (a.alertas?.esCritico || (a.alertas?.horasTranscurridas || 0) >= 96) ? 1 : 0;
      const critB = (b.alertas?.esCritico || (b.alertas?.horasTranscurridas || 0) >= 96) ? 1 : 0;
      if (critA !== critB) return critB - critA;

      const proxA = (a.alertas?.esProximoVencer || ((a.alertas?.horasTranscurridas || 0) >= 72 && (a.alertas?.horasTranscurridas || 0) < 96)) ? 1 : 0;
      const proxB = (b.alertas?.esProximoVencer || ((b.alertas?.horasTranscurridas || 0) >= 72 && (b.alertas?.horasTranscurridas || 0) < 96)) ? 1 : 0;
      if (proxA !== proxB) return proxB - proxA;

      return (b.alertas?.horasTranscurridas || 0) - (a.alertas?.horasTranscurridas || 0);
    });
  }, [casosConAlertas, filtroMisCasos, tipoOrdenMisCasos, sentidoTienda]);

  const manejarBusqueda = async (busquedaId: string) => {
    if (!busquedaId.trim()) return;
    setCargandoBusqueda(true);
    const term = busquedaId.trim().toLowerCase();
    const resultadosLocales = casosTotales.filter(c => 
      String(c.vendor_id || c.vendorId || '').toLowerCase() === term ||
      String(c.casoOp || c.id || '').toLowerCase() === term ||
      String(c.tienda || '').toLowerCase().includes(term)
    );
    setBusquedaResultados(resultadosLocales);
    if (resultadosLocales.length > 0) {
      const d = resultadosLocales[0];
      setFormulario(prev => ({
        ...prev, 
        casoOp: '', 
        vendorId: d.vendor_id || d.vendorId || term, 
        tienda: d.tienda || '',
        pais: d.pais || 'Argentina', 
        kam: d.kam || prev.kam, 
        integracion: d.integracion || 'Datalive',
        oportunidad: d.oportunidad || prev.oportunidad,
        asset: d.asset || prev.asset,
        sla_inicio: d.sla_inicio || d.fechaInicioSeguimientoOP || '',
        etapa: d.etapa ? limpiarTextoEtapa(d.etapa, d.comentarios, d.integracion) : 'Sin integración confirmada'
      }));
      mostrarNotificacion(`Encontrados ${resultadosLocales.length} antecedentes.`, "success");
    } else {
      setFormulario(prev => ({ ...prev, casoOp: '', vendorId: term }));
      mostrarNotificacion(`Sin antecedentes previos.`, "info");
    }
    setCargandoBusqueda(false);
  };

  const manejarCambioForm = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormulario(prev => ({ ...prev, [name]: value }));
  };

  const guardarNuevoCaso = async () => {
    setCargandoOperacion('Detectando base de datos y registrando nuevo caso...');
    try {
      const opInput = String(formulario.casoOp || '').trim();
      const esOpValido = opInput && 
        opInput !== '-' && 
        opInput.toLowerCase() !== 'sin caso op' && 
        !opInput.startsWith('TEMP_') && 
        !opInput.startsWith('SIN_OP_') && 
        !opInput.includes('_r');
      const casoOpFinal = esOpValido ? opInput : '';
      
      const ahora = formatearFechaHora(new Date());
      const fCreacion = formatearFechaHora(formulario.fechaCreacion) || ahora;
      const fInicio = formatearFechaHora(formulario.sla_inicio || formulario.fechaCreacion) || ahora;

      // 1. Detectar en tiempo real cuántas filas hay en total en la base antes de añadir el nuevo caso
      let proximaFila = 0;
      try {
        const resConteo = await fetch('/api/sheets/conteo-filas', { cache: 'no-store' });
        if (resConteo.ok) {
          const dataConteo = await resConteo.json();
          if (dataConteo.success && dataConteo.proximaFilaNueva) {
            proximaFila = dataConteo.proximaFilaNueva;
          }
        }
      } catch (e) {
        console.warn('Error consultando conteo de filas en base:', e);
      }

      if (!proximaFila) {
        // En la hoja: Fila 1 y 2 encabezados. Última fila ocupada = recuentoCasos + 2.
        // La nueva fila a insertar = recuentoCasos + 3
        const recuentoCasos = casosSheets.length;
        proximaFila = recuentoCasos + 3;
      }

      const docId = esOpValido ? opInput : `SIN_OP_${formulario.vendorId || 'caso'}_r${proximaFila}`;

      const casoProcesado = procesarActualizacionCaso({}, {
        ...formulario, 
        id: docId, 
        casoOp: casoOpFinal,
        vendor_id: formulario.vendorId, 
        agente: formulario.propietarioTicket,
        fechaCreacion: fCreacion,
        sla_inicio: fInicio,
        fechaInicioSeguimientoOP: fInicio,
        filaNumero: proximaFila,
        esNuevo: true,
        actualizadoEn: new Date().toISOString()
      });

      // 2. Guardar y sincronizar con Google Sheets
      const sheetsRes = await actualizarCasoEnSheets({ ...casoProcesado, esNuevo: true }).catch(err => {
        console.warn('Sheets sync notice:', err);
        return null;
      });
      const filaConfirmada = sheetsRes?.caso?.filaNumero || sheetsRes?.filaNumero || proximaFila;
      const casoFinalConFila = {
        ...casoProcesado,
        filaNumero: filaConfirmada,
        esNuevo: false
      };

      // 3. Actualizar estado local
      setCasosSheets(prev => [casoFinalConFila, ...prev.filter(c => String(c.id).trim() !== docId && String(c.casoOp || '').trim() !== docId)]);
      setCasosFirestore(prev => [casoFinalConFila, ...prev.filter(c => String(c.id).trim() !== docId && String(c.casoOp || '').trim() !== docId)]);

      // 4. Respaldar en Firestore en segundo plano
      try {
        const casoRef = doc(db, "casos", docId);
        setDoc(casoRef, casoFinalConFila, { merge: true }).catch(() => {});
      } catch (_) {}

      mostrarNotificacion(`Caso registrado exitosamente en fila #${filaConfirmada}`, "success");
      const nuevoAhora = formatearFechaHora(new Date());
      setFormulario(prev => ({ 
        ...prev, 
        casoOp: '', 
        vendorId: '', 
        tienda: '', 
        comentarios: '', 
        casoSeguimiento: '',
        fechaCreacion: nuevoAhora,
        sla_inicio: nuevoAhora
      }));
    } catch (err: any) {
      console.error("Error al registrar caso:", err);
      mostrarNotificacion(`❌ Error al registrar caso: ${err.message}`, "error");
    } finally {
      setCargandoOperacion(null);
    }
  };

  const actualizarCasoExistente = async (casoActualizado: any) => {
    setCargandoOperacion('Guardando cambios en Google Sheets y Firebase...');
    try {
      const opInput = String(casoActualizado.casoOp || '').trim();
      const esOpValido = opInput && 
        opInput !== '-' && 
        opInput.toLowerCase() !== 'sin caso op' && 
        !opInput.startsWith('TEMP_') && 
        !opInput.startsWith('SIN_OP_') && 
        !opInput.includes('_r');
      const casoOpFinal = esOpValido ? opInput : '';

      // Identificar caso previo por filaNumero, id previo o casoOp
      const filaNum = Number(casoActualizado.filaNumero);
      const idPrevio = String(casoActualizado.id || '').trim();

      const casoPrevio = casosTotales.find(c => 
        (filaNum && c.filaNumero === filaNum) ||
        (idPrevio && String(c.id).trim() === idPrevio) ||
        (esOpValido && String(c.casoOp).trim() === opInput)
      ) || {};

      const casoFinal = procesarActualizacionCaso(casoPrevio, {
        ...casoActualizado,
        esNuevo: false,
        casoOp: casoOpFinal
      });
      casoFinal.esNuevo = false;
      
      if (casoActualizado.pushKamPos !== undefined) {
        casoFinal.pushKamPos = Boolean(casoActualizado.pushKamPos);
      }
      if (casoActualizado.pushKamCat !== undefined) {
        casoFinal.pushKamCat = Boolean(casoActualizado.pushKamCat);
      }
      if (filaNum) {
        casoFinal.filaNumero = filaNum;
      }

      // Si tiene OP real usarlo como ID de Firestore, sino conservar el id previo o generar id SIN_OP
      const nuevoDocId = esOpValido ? opInput : (idPrevio || `SIN_OP_${casoFinal.vendorId || 'caso'}_r${filaNum || 'edit'}`);
      casoFinal.id = nuevoDocId;

      // 1. Actualizar estados locales de inmediato
      const coincideCaso = (c: any) => 
        (filaNum && c.filaNumero === filaNum) ||
        (idPrevio && String(c.id).trim() === idPrevio) ||
        (nuevoDocId && String(c.id).trim() === nuevoDocId) ||
        (esOpValido && String(c.casoOp).trim() === opInput);

      setCasosFirestore(prev => prev.map(c => coincideCaso(c) ? { ...c, ...casoFinal } : c));
      setCasosSheets(prev => prev.map(c => coincideCaso(c) ? { ...c, ...casoFinal } : c));

      // 2. Guardar y sincronizar con Google Sheets
      await actualizarCasoEnSheets({ ...casoFinal, esNuevo: false }).catch(err => {
        console.warn('Sheets sync notice:', err);
      });

      // 3. Respaldar en Firestore en segundo plano
      try {
        const casoRef = doc(db, "casos", nuevoDocId);
        setDoc(casoRef, { ...casoFinal, id: nuevoDocId, actualizadoEn: new Date().toISOString() }, { merge: true }).catch(() => {});
        
        // Si antes tenía un docId temporal y ahora tiene OP real, limpiar el doc temporal viejo
        if (idPrevio && idPrevio !== nuevoDocId) {
          try {
            await deleteDoc(doc(db, "casos", idPrevio));
          } catch (_) {}
        }
      } catch (_) {}

      setCasoSeleccionadoModal(casoFinal);
      mostrarNotificacion('Actualizado', "success");
    } catch (err: any) {
      console.error("Error actualizando caso en Firebase/Sheets:", err);
      mostrarNotificacion(`❌ Error actualizando caso: ${err.message}`, "error");
    } finally {
      setCargandoOperacion(null);
    }
  };

  const manejarEliminarCaso = async (caso: any): Promise<any> => {
    if (!caso) return false;
    const targetId = String(caso.id || caso.casoOp || '').trim();
    const op = (caso.casoOp && caso.casoOp !== '-' && caso.casoOp !== 'Sin caso OP') ? caso.casoOp : (caso.vendorId || targetId);

    setCargandoOperacion(`Eliminando caso OP #${op}...`);
    try {
      // 1. Eliminar en Google Sheets
      try {
        await eliminarCasoGoogleSheets(targetId, caso.casoOp, caso.filaNumero);
      } catch (sheetsErr) {
        console.warn('Error llamando eliminarCasoGoogleSheets:', sheetsErr);
      }

      // 2. Eliminar en Firebase Firestore
      await eliminarCasoFirestore(targetId);
      if (caso.casoOp && String(caso.casoOp).trim() !== targetId) {
        await eliminarCasoFirestore(String(caso.casoOp).trim());
      }
      if (caso.vendorId && String(caso.vendorId).trim() !== targetId && String(caso.vendorId).trim() !== String(caso.casoOp || '').trim()) {
        await eliminarCasoFirestore(String(caso.vendorId).trim());
      }

      // 3. Actualizar estados locales de casos
      setCasosSheets(prev => prev.filter(c => String(c.id).trim() !== targetId && String(c.casoOp || '').trim() !== String(caso.casoOp || '').trim()));
      setCasosFirestore(prev => prev.filter(c => String(c.id).trim() !== targetId && String(c.casoOp || '').trim() !== String(caso.casoOp || '').trim()));

      mostrarNotificacion('Actualizado', 'success');
      return true;
    } catch (err: any) {
      console.error("Error al eliminar caso:", err);
      mostrarNotificacion(`❌ Error al eliminar caso OP #${op}: ${err.message}`, "error");
      return false;
    } finally {
      setCargandoOperacion(null);
    }
  };

  const manejarRegistrarPush = async (caso: any, tipo: 'pos' | 'cat' | 'kam_pos' | 'kam_cat' | string) => {
    setCargandoOperacion('Registrando push...');
    try {
      const fechaSheet = formatearFechaHora(new Date());
      const idBuscado = String(caso.casoOp || caso.id).trim();

      const cambios: Record<string, any> = {};
      if (tipo === 'pos') {
        cambios.fechaPushPos = fechaSheet;
      } else if (tipo === 'cat') {
        cambios.fechaPushCat = fechaSheet;
      } else if (tipo === 'kam_pos') {
        cambios.pushKamPos = 'TRUE';
      } else if (tipo === 'kam_cat') {
        cambios.pushKamCat = 'TRUE';
      }

      const casoActualizado = {
        ...caso,
        ...cambios
      };

      // 1. Actualización inmediata local
      setCasosSheets(prev => prev.map(c => 
        (String(c.id).trim() === idBuscado || String(c.casoOp).trim() === idBuscado || (caso.casoOp && String(c.casoOp).trim() === String(caso.casoOp).trim()))
          ? { ...c, ...cambios }
          : c
      ));
      setCasosFirestore(prev => prev.map(c => 
        (String(c.id).trim() === idBuscado || String(c.casoOp).trim() === idBuscado || (caso.casoOp && String(c.casoOp).trim() === String(caso.casoOp).trim()))
          ? { ...c, ...cambios }
          : c
      ));
      
      // 2. Guardar en Firebase Firestore
      const casoRef = doc(db, "casos", idBuscado);
      await setDoc(casoRef, { 
        ...casoActualizado, 
        id: idBuscado, 
        actualizadoEn: new Date().toISOString() 
      }, { merge: true });

      // 3. Sincronizar con Backend y Google Sheets (actualiza solo la celda específica por casoOp)
      try {
        const resPush = await fetch('/api/sheets/registrar-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            casoId: idBuscado, 
            casoOp: caso.casoOp, 
            filaNumero: caso.filaNumero, 
            fecha: fechaSheet, 
            tipo 
          })
        });

        if (!resPush.ok) {
          await actualizarCasoEnSheets(casoActualizado).catch(() => {});
        }
      } catch (e) {
        console.warn('Error sincronizando push con sheets, usando fallback:', e);
        await actualizarCasoEnSheets(casoActualizado).catch(() => {});
      }

      mostrarNotificacion('Actualizado', "success");

      setAlertasPushActivas(prev => prev.filter(a => {
        const c = a.caso;
        return !(String(c?.id || '').trim() === idBuscado || String(c?.casoOp || '').trim() === idBuscado);
      }));
    } catch (err) {
      console.error("Error al registrar push:", err);
      mostrarNotificacion("Error al registrar push.", "error");
    } finally {
      setCargandoOperacion(null);
    }
  };

  const onReplicarTienda = (datosTienda: any) => {
    setFormulario(prev => ({
      ...prev, 
      casoOp: '', 
      vendorId: datosTienda.vendorId || prev.vendorId,
      tienda: datosTienda.tienda || prev.tienda, 
      pais: datosTienda.pais || prev.pais,
      kam: datosTienda.kam || prev.kam, 
      integracion: datosTienda.integracion || prev.integracion,
      oportunidad: datosTienda.oportunidad || prev.oportunidad,
      asset: datosTienda.asset || prev.asset
    }));
    setActiveTab('nuevo');
    mostrarNotificacion(`Datos replicados. Ingresa el N° de Caso OP.`);
  };

  const manejarLogout = () => {
    try {
      sessionStorage.removeItem('peya_login_alarm_' + sesionUsuarioKey);
      sessionStorage.removeItem('peya_ultimo_timbre_ts');
      sessionStorage.removeItem('peya_onb_active_tab');
      sessionStorage.removeItem('peya_sesion_push_reproducciones_' + sesionUsuarioKey);
    } catch (e) {}
    if (onLogout) onLogout();
  };

  return (
    <div className="flex h-screen bg-[#0f111a] text-gray-200 font-sans">
      <audio ref={audioRef} src="/ding.mp3" preload="auto" />
      
      {/* Alertas Push Flotantes Tipo Captura */}
      <PushAlertContainer 
        alertas={alertasPushActivas} 
        onCerrarAlerta={manejarCerrarAlertaPush} 
        onCerrarTodas={manejarCerrarTodasAlertasPush}
        onClicAlerta={manejarClicAlertaPush} 
      />

      {/* Botón flotante para ver sidebar en móviles y pantallas <= 1036px */}
      <div className="fixed bottom-5 left-5 z-40 max-[1036px]:flex min-[1037px]:hidden">
        <button
          type="button"
          onClick={() => setSidebarMovilAbierto(true)}
          className="w-12 h-12 bg-pink-600 hover:bg-pink-500 text-white rounded-full shadow-2xl flex items-center justify-center text-xl transition transform active:scale-95 border-2 border-pink-400 cursor-pointer"
          title="Abrir opciones del menú"
        >
          ☰
        </button>
      </div>

      {/* Drawer móvil de Sidebar para pantallas <= 1036px */}
      {sidebarMovilAbierto && (
        <div className="fixed inset-0 z-50 flex max-[1036px]:flex min-[1037px]:hidden">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm" 
            onClick={() => setSidebarMovilAbierto(false)}
          />
          <div className="relative w-72 bg-[#161925] border-r border-gray-800 flex flex-col h-full shadow-2xl z-10 animate-slideRight">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h1 className="text-xl font-black text-pink-500 tracking-tighter">PeYa<span className="text-white">ONB</span></h1>
              <button 
                onClick={() => setSidebarMovilAbierto(false)} 
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex-1 space-y-2 overflow-y-auto">
              {LISTA_PESTANAS_SISTEMA.filter(tab => puedeVerTab(tab.id)).map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSidebarMovilAbierto(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isActive 
                        ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30 font-bold' 
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    }`}
                  >
                    <span className="text-base">{tab.icono}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t border-gray-800">
              <SyncIndicator isConnected={true} ultimaSync={ultimaSync} sincronizando={cargandoSheets} totalCasos={casosSheets.length || casosTotales.length} onForzarSync={() => cargarCasosGoogleSheets()} />
              <button onClick={() => { setMostrarModalCreds(true); setSidebarMovilAbierto(false); }} className="w-full mt-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">⚙️ Configuración</button>
              <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                <span className="truncate max-w-[150px]">{nombreUsuarioAutenticado}</span>
                <button onClick={manejarLogout} className="hover:text-pink-400 cursor-pointer">Salir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar de escritorio: colapsable y responsivo */}
      <div className={`${sidebarColapsado ? 'w-20' : 'w-64'} bg-[#161925] border-r border-gray-800 flex flex-col hidden min-[1037px]:flex transition-all duration-300 select-none`}>
        <div className={`p-4 border-b border-gray-800 flex items-center ${sidebarColapsado ? 'justify-center flex-col gap-2' : 'justify-between'}`}>
          {!sidebarColapsado ? (
            <h1 className="text-xl font-black text-pink-500 tracking-tighter">PeYa<span className="text-white">ONB</span></h1>
          ) : (
            <span className="text-sm font-black text-pink-500">PY</span>
          )}
          <button
            type="button"
            onClick={() => setSidebarColapsado(prev => !prev)}
            className="text-gray-400 hover:text-white bg-transparent border-0 text-base font-mono font-bold px-1.5 py-0.5 transition cursor-pointer select-none"
            title={sidebarColapsado ? 'Expandir barra lateral' : 'Comprimir barra lateral'}
          >
            {sidebarColapsado ? '>' : '<'}
          </button>
        </div>
        
        <div className="p-3 flex-1 space-y-1.5 overflow-y-auto">
          {LISTA_PESTANAS_SISTEMA.filter(tab => puedeVerTab(tab.id)).map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={sidebarColapsado ? tab.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isActive 
                    ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30 font-bold' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                } ${sidebarColapsado ? 'justify-center px-1' : ''}`}
              >
                <span className="text-base">{tab.icono}</span>
                {!sidebarColapsado && <span className="truncate">{tab.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-gray-800">
          {!sidebarColapsado ? (
            <>
              <SyncIndicator isConnected={true} ultimaSync={ultimaSync} sincronizando={cargandoSheets} totalCasos={casosSheets.length || casosTotales.length} onForzarSync={() => cargarCasosGoogleSheets()} />
              <button onClick={() => setMostrarModalCreds(true)} className="w-full mt-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">⚙️ Configuración</button>
              <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                <span className="truncate max-w-[130px]" title={nombreUsuarioAutenticado}>{nombreUsuarioAutenticado}</span>
                <button onClick={manejarLogout} className="hover:text-pink-400 cursor-pointer">Salir</button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 text-xs">
              <button 
                onClick={() => cargarCasosGoogleSheets()} 
                title="Sincronizar desde Sheets"
                className="text-gray-400 hover:text-pink-400 text-base cursor-pointer"
              >
                🔄
              </button>
              <button 
                onClick={() => setMostrarModalCreds(true)} 
                title="Configuración"
                className="text-gray-400 hover:text-white text-base cursor-pointer"
              >
                ⚙️
              </button>
              <button 
                onClick={manejarLogout} 
                title="Cerrar sesión"
                className="text-gray-400 hover:text-pink-400 text-base cursor-pointer"
              >
                🚪
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {notificacion && (
          <div className={`absolute top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-2xl animate-bounce ${notificacion.tipo === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
            {notificacion.texto}
          </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-6">
          {activeTab === 'tl' && puedeVerTab('tl') && (
            <TLDashboard 
              casos={casosTotales}
              onSeleccionarCaso={setCasoSeleccionadoModal}
              onActualizarCaso={actualizarCasoExistente}
              onRegistrarPush={manejarRegistrarPush}
              nombreUsuario={nombreUsuarioAutenticado}
              rolUsuario={role}
              mostrarNotificacion={mostrarNotificacion}
              onForzarSync={() => cargarCasosGoogleSheets()}
              sincronizando={cargandoSheets}
              casoResaltadoId={casoResaltadoId}
            />
          )}

          {activeTab === 'admin' && puedeVerTab('admin') && (
            <AdminCatalogoView
              catalogos={catalogosDinamicos}
              onActualizarCatalogos={setCatalogosDinamicos}
              mostrarNotificacion={mostrarNotificacion}
              casos={casosTotales}
              onSeleccionarCaso={setCasoSeleccionadoModal}
              onActualizarCaso={actualizarCasoExistente}
              onEliminarCaso={manejarEliminarCaso}
              onForzarSyncCasos={cargarCasosGoogleSheets}
              sincronizando={cargandoSheets}
            />
          )}
          
          {activeTab === 'nuevo' && puedeVerTab('nuevo') && (
            <div className="space-y-6 w-full">
              {/* Barra de Sub-pestañas: Búsqueda vs Agregar Caso */}
              <div className="bg-[#151824] border border-gray-800 rounded-2xl p-2.5 shadow-lg flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSubTabNuevo('busqueda')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      subTabNuevo === 'busqueda'
                        ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/40 border border-pink-500'
                        : 'bg-[#0f111a] text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800'
                    }`}
                  >
                    <span>🔍</span>
                    <span>Búsqueda de Casos</span>
                    {busquedaResultados && busquedaResultados.length > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${subTabNuevo === 'busqueda' ? 'bg-white/20 text-white' : 'bg-pink-950 text-pink-400 border border-pink-800'}`}>
                        {busquedaResultados.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setSubTabNuevo('registro')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      subTabNuevo === 'registro'
                        ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/40 border border-pink-500'
                        : 'bg-[#0f111a] text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800'
                    }`}
                  >
                    <span>➕</span>
                    <span>Agregar Caso (Nuevo Registro)</span>
                    {formulario.vendorId && (
                      <span className="text-[10px] text-pink-400 font-mono hidden sm:inline">
                        ({formulario.tienda ? formulario.tienda.slice(0, 18) + '...' : formulario.vendorId})
                      </span>
                    )}
                  </button>
                </div>

                <div className="text-xs text-gray-400 px-3 hidden md:block">
                  {subTabNuevo === 'busqueda' 
                    ? 'Busca por Vendor ID, OP o Tienda y replica antecedentes con 1 clic' 
                    : 'Ingresa los datos para registrar un nuevo caso en Firebase y Google Sheets'}
                </div>
              </div>

              {/* Contenido según la sub-pestaña activa */}
              {subTabNuevo === 'busqueda' ? (
                <SearchBar 
                  onBuscar={manejarBusqueda} 
                  cargando={cargandoBusqueda} 
                  resultados={busquedaResultados} 
                  onSeleccionarCaso={setCasoSeleccionadoModal} 
                  onReplicarTienda={(r) => {
                    onReplicarTienda(r);
                    setSubTabNuevo('registro');
                  }} 
                  onLimpiar={() => setBusquedaResultados([])}
                />
              ) : (
                <CasoForm 
                  formulario={formulario} 
                  onChange={manejarCambioForm} 
                  onGuardar={guardarNuevoCaso} 
                  nombreUsuario={nombreUsuarioAutenticado} 
                  puedeRegistrar={puedeRegistrar} 
                  integraciones={listaIntegracionesNombres}
                  paises={catalogosDinamicos.paises}
                  oportunidades={catalogosDinamicos.oportunidades}
                  assets={catalogosDinamicos.assets}
                  estados={catalogosDinamicos.estados}
                  etapas={catalogosDinamicos.etapas}
                  agentes={catalogosDinamicos.agentes}
                />
              )}
            </div>
          )}

          {/* Mis casos */}
          {activeTab === 'inicio' && puedeVerTab('inicio') && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <AlertBadge tipo="todos" cantidad={casosConAlertas.length} activo={filtroMisCasos === 'todos'} onClick={setFiltroMisCasos} />
                  <AlertBadge tipo="enProgreso" cantidad={totalEnProgresoNormal} activo={filtroMisCasos === 'enProgreso'} onClick={setFiltroMisCasos} />
                  <AlertBadge tipo="sinOportunidad" cantidad={totalSinOportunidad} activo={filtroMisCasos === 'sinOportunidad'} onClick={setFiltroMisCasos} />
                  <AlertBadge tipo="pushPos" cantidad={totalPos} activo={filtroMisCasos === 'pushPos'} onClick={setFiltroMisCasos} />
                  <AlertBadge tipo="pushCat" cantidad={totalCat} activo={filtroMisCasos === 'pushCat'} onClick={setFiltroMisCasos} />
                  <AlertBadge tipo="sla" cantidad={totalSla} activo={filtroMisCasos === 'sla'} onClick={setFiltroMisCasos} />
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Botón 1: Ordenar por SLA */}
                  <button
                    type="button"
                    onClick={() => setTipoOrdenMisCasos('sla')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      tipoOrdenMisCasos === 'sla'
                        ? 'bg-pink-600 text-white border-pink-500 shadow-sm font-bold'
                        : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
                    }`}
                    title="Ordenar casos por SLA y prioridad"
                  >
                    <span>⏱️</span>
                    <span>Ordenar por SLA</span>
                  </button>

                  {/* Botón 2: Tienda A-Z / Z-A */}
                  <button
                    type="button"
                    onClick={() => {
                      if (tipoOrdenMisCasos !== 'tienda') {
                        setTipoOrdenMisCasos('tienda');
                      } else {
                        setSentidoTienda(prev => prev === 'asc' ? 'desc' : 'asc');
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      tipoOrdenMisCasos === 'tienda'
                        ? 'bg-pink-600 text-white border-pink-500 shadow-sm font-bold'
                        : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
                    }`}
                    title="Ordenar alfabéticamente por tienda (A-Z o Z-A)"
                  >
                    <span>🔤</span>
                    <span>Tienda: {tipoOrdenMisCasos === 'tienda' ? (sentidoTienda === 'asc' ? 'A - Z 🔼' : 'Z - A 🔽') : 'A - Z'}</span>
                  </button>

                  {/* Botón Actualizar */}
                  <button
                    type="button"
                    onClick={() => cargarCasosGoogleSheets()}
                    disabled={cargandoSheets}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                      cargandoSheets
                        ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                        : 'bg-gray-800/90 hover:bg-gray-700 text-pink-400 hover:text-pink-300 border-pink-500/40 hover:border-pink-500 shadow-sm cursor-pointer'
                    }`}
                    title="Actualizar datos desde Google Sheets"
                  >
                    <span className={cargandoSheets ? 'animate-spin inline-block text-xs' : 'text-xs'}>🔄</span>
                    <span>{cargandoSheets ? 'Actualizando...' : 'Actualizar'}</span>
                  </button>

                  {/* Usuario autenticado */}
                  <div className="px-3 py-1.5 rounded-lg bg-pink-950/40 border border-pink-800/50 text-pink-300 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                    <span>👤</span>
                    <span>Agente: {nombreUsuarioAutenticado}</span>
                  </div>
                </div>
              </div>

              {/* Tabla de Mis Casos con columnas redimensionables */}
              <div className="bg-[#161925] border border-gray-800 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-[#0f111a] border-b border-gray-800 text-xs text-gray-400 font-bold uppercase tracking-wider select-none">
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.op, minWidth: colWidthsMisCasos.op }}>
                          <span>OP</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('op', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-pink-500 transition-colors" />
                        </th>
                        <th 
                          onClick={() => {
                            if (tipoOrdenMisCasos !== 'tienda') {
                              setTipoOrdenMisCasos('tienda');
                            } else {
                              setSentidoTienda(prev => prev === 'asc' ? 'desc' : 'asc');
                            }
                          }}
                          className="p-3 cursor-pointer hover:text-pink-400 transition relative" 
                          title="Clic para ordenar alfabéticamente por tienda"
                          style={{ width: colWidthsMisCasos.tienda, minWidth: colWidthsMisCasos.tienda }}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Tienda</span>
                            <span className="text-[11px] font-mono">
                              {tipoOrdenMisCasos === 'tienda' ? (sentidoTienda === 'asc' ? '🔼 (A-Z)' : '🔽 (Z-A)') : '↕️'}
                            </span>
                          </div>
                          <div onMouseDown={(e) => { e.stopPropagation(); iniciarRedimensionarMisCasos('tienda', e); }} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-pink-500 transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.pais, minWidth: colWidthsMisCasos.pais }}>
                          <span>País/KAM</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('pais', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-pink-500 transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.integracion, minWidth: colWidthsMisCasos.integracion }}>
                          <span>Integración</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('integracion', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-pink-500 transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.estado, minWidth: colWidthsMisCasos.estado }}>
                          <span>Estado / Etapa</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('estado', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-pink-500 transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.pushPos, minWidth: colWidthsMisCasos.pushPos }}>
                          <span>Push POS</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('pushPos', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-pink-500 transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.pushCat, minWidth: colWidthsMisCasos.pushCat }}>
                          <span>Push Catálogo</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('pushCat', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-pink-500 transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.sla, minWidth: colWidthsMisCasos.sla }}>
                          <span>SLA</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('sla', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-pink-500 transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.asignado, minWidth: colWidthsMisCasos.asignado }}>
                          <span>Asignado</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('asignado', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-pink-500 transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.accion, minWidth: colWidthsMisCasos.accion }}>
                          <span>Acción</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('accion', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-pink-500 transition-colors" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaFiltrada.map((item, index) => {
                        const estaResaltado = Boolean(casoResaltadoId && (
                          String(item.caso.id) === String(casoResaltadoId) ||
                          String(item.caso.casoOp) === String(casoResaltadoId) ||
                          String(item.caso.vendorId || item.caso.vendor_id) === String(casoResaltadoId)
                        ));
                        return (
                          <CasoCard 
                            key={index} 
                            caso={item.caso} 
                            alertas={item.alertas} 
                            onClick={setCasoSeleccionadoModal} 
                            onRegistrarPush={manejarRegistrarPush}
                            estaResaltado={estaResaltado}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Gestionar usuarios */}
          {activeTab === 'usuarios' && puedeVerTab('usuarios') && (
            <GestionUsuariosView 
              nombreUsuarioAutenticado={nombreUsuarioAutenticado}
              mostrarNotificacion={mostrarNotificacion}
              rolesDisponibles={catalogosDinamicos?.roles}
            />
          )}
        </div>
      </div>

      {/* Overlay Global de Carga con Spinner */}
      {cargandoOperacion && (
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-white animate-fadeIn">
          <div className="w-14 h-14 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold tracking-wide animate-pulse">{cargandoOperacion}</p>
        </div>
      )}

      <ConfigModal visible={mostrarModalCreds} onCerrar={() => setMostrarModalCreds(false)} onSincronizar={() => cargarCasosGoogleSheets()} casosCount={casosSheets.length} />
      
      {casoSeleccionadoModal && (
        <ModalDetalleCaso 
          caso={casoSeleccionadoModal} 
          alCerrar={() => setCasoSeleccionadoModal(null)} 
          alActualizar={actualizarCasoExistente} 
          alReplicarTienda={onReplicarTienda} 
          nombreUsuarioAutenticado={nombreUsuarioAutenticado}
          estados={catalogosDinamicos.estados}
          etapas={catalogosDinamicos.etapas}
          oportunidades={catalogosDinamicos.oportunidades}
          agentes={catalogosDinamicos.agentes}
          paises={catalogosDinamicos.paises}
          assets={catalogosDinamicos.assets}
        />
      )}
    </div>
  );
}
