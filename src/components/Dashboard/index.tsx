import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { isAgentMatch, identificarMiembro } from '../../utils/agentMatching';
import { esSupervisor, puedeRegistrarCasos, obtenerPestanasPorDefecto, LISTA_PESTANAS_SISTEMA, LISTA_BLANCA_OFICIAL } from '../../utils/userPermissions';
import { 
  procesarActualizacionCaso, 
  analizarAlertasCaso, 
  limpiarTextoEtapa, 
  formatearFechaHora, 
  esPushKamRealizado, 
  normalizarRespuesta,
  resolverOportunidad 
} from '../../utils/onboardingRules';
import { LISTA_INTEGRACIONES_OFICIALES } from '../../data/catalogoOnboarding';
import { analizarTiemposCaso } from '../../utils/tiempoLaboral';

import { consultarCasosGoogleSheets, actualizarCasoEnSheets, eliminarCasoGoogleSheets } from '../../services/googleSheetsService';

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
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../../firebase';

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

  const esRolSupervisor = esSupervisor(rol);

  const casosActivos = casos.filter(c => {
    if (!c) return false;
    const est = String(c.estado || '').toLowerCase().trim();
    if (est.includes('cerrad') || est.includes('fallid') || est.includes('cancel')) return false;
    return true;
  });

  const ahora = new Date();
  const horaTexto = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const resultados: AlertaPush[] = [];

  // 1. SOLO AL TL / SUPERVISOR LE DEBEN APARECER LOS PUSH KAM DE MÁS DE 24 HORAS
  if (esRolSupervisor) {
    casosActivos.forEach(c => {
      const alertas = analizarAlertasCaso(c);
      const opLabel = (c.casoOp && c.casoOp !== '-' && c.casoOp !== 'Sin caso OP') ? c.casoOp : (c.vendorId || c.id || 'Sin caso OP');
      const tiendaLabel = c.tienda || 'Sin tienda';

      // Push KAM POS (> 24 hrs): requiere fecha de inicio real, push de agente, respuesta "No", push KAM pendiente y > 24 horas
      if (alertas.requierePushKamPos) {
        resultados.push({
          id: `kam_pos_${c.id || c.casoOp}`,
          caso: c,
          tipo: 'kam_pos',
          titulo: 'Push KAM POS Pendiente (>24h)',
          hora: horaTexto,
          mensaje: `Falta push con KAM (>24 hrs) en caso OP #${opLabel} (${tiendaLabel})`
        });
      }

      // Push KAM Catálogo (> 24 hrs): requiere fecha de inicio real, push de agente, respuesta "No", push KAM pendiente y > 24 horas
      if (alertas.requierePushKamCat) {
        resultados.push({
          id: `kam_cat_${c.id || c.casoOp}`,
          caso: c,
          tipo: 'kam_cat',
          titulo: 'Push KAM Catálogo Pendiente (>24h)',
          hora: horaTexto,
          mensaje: `Falta push con KAM (>24 hrs) en caso OP #${opLabel} (${tiendaLabel})`
        });
      }
    });
  }

  // 2. ALERTAS DE PUSH DE SEGUIMIENTO (>= 4 HORAS):
  // Solo sobre los casos propios asignados al usuario (Agente o TL para sus casos)
  // Condiciones obligatorias: Debe tener Fecha de Inicio real, faltar push y tiempo >= 4 horas
  const misCasos = casosActivos.filter(c => isAgentMatch(c, emailUsuario, nombreUsuario));

  misCasos.forEach(c => {
    const alertas = analizarAlertasCaso(c);
    const opLabel = (c.casoOp && c.casoOp !== '-' && c.casoOp !== 'Sin caso OP') ? c.casoOp : (c.vendorId || c.id || 'Sin caso OP');
    const tiendaLabel = c.tienda || 'Sin tienda';

    // Push de Seguimiento POS (≥ 4 hrs)
    if (alertas.requierePushPos) {
      resultados.push({
        id: `push_pos_${c.id || c.casoOp}`,
        caso: c,
        tipo: 'push_pos',
        titulo: 'Push de Seguimiento POS Pendiente',
        hora: horaTexto,
        mensaje: `Falta realizar push de seguimiento (≥ 4 hrs) en caso OP #${opLabel} (${tiendaLabel})`
      });
    }

    // Push de Seguimiento Catálogo (≥ 4 hrs)
    if (alertas.requierePushCat) {
      resultados.push({
        id: `push_cat_${c.id || c.casoOp}`,
        caso: c,
        tipo: 'push_cat',
        titulo: 'Push de Seguimiento Catálogo Pendiente',
        hora: horaTexto,
        mensaje: `Falta realizar push de seguimiento (≥ 4 hrs) en caso OP #${opLabel} (${tiendaLabel})`
      });
    }
  });

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
    const unsubscribe = onSnapshot(doc(db, 'usuarios_permitidos', correoLimpio), (docSnap: any) => {
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
    }, (error: any) => {
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
    return {
      casoOp: '', vendorId: '', tienda: '', pais: 'Argentina', kam: '',
      integracion: 'Datalive', oportunidad: 'Franchise Extension', asset: 'Integración',
      propietarioOportunidad: nombreUsuarioAutenticado, propietarioTicket: nombreUsuarioAutenticado,
      casoSeguimiento: '', tieneCasoInicio: 'Si', comentarios: '', estado: 'En progreso',
      etapa: 'Sin integración confirmada', 
      fechaCreacion: '',
      sla_inicio: ''
    };
  });

  // Lista de correos oficiales del equipo de Onboarding para tickets de seguimiento
  const [correosOnboarding, setCorreosOnboarding] = useState<string[]>(() => {
    return Object.keys(LISTA_BLANCA_OFICIAL).filter(c => !c.includes('demo'));
  });
  const [correoCopiado, setCorreoCopiado] = useState<string | null>(null);
  const [todosCorreosCopiados, setTodosCorreosCopiados] = useState<boolean>(false);

  useEffect(() => {
    const usuariosRef = collection(db, 'usuarios_permitidos');
    const unsubscribe = onSnapshot(usuariosRef, (snapshot) => {
      const correosSet = new Set<string>(Object.keys(LISTA_BLANCA_OFICIAL).filter(c => !c.includes('demo')));
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const correo = (data.correo || docSnap.id || '').toLowerCase().trim();
        if (correo && correo.includes('@') && !correo.includes('demo')) {
          correosSet.add(correo);
        }
      });
      setCorreosOnboarding(Array.from(correosSet));
    }, (err) => {
      console.warn('Error suscribiendo correos onboarding:', err);
    });
    return () => unsubscribe();
  }, []);

  const copiarCorreoIndividual = (correo: string) => {
    navigator.clipboard.writeText(correo);
    setCorreoCopiado(correo);
    mostrarNotificacion(`Copiado: ${correo}`);
    setTimeout(() => setCorreoCopiado(null), 2000);
  };

  const copiarTodosCorreosOnboarding = () => {
    if (correosOnboarding.length === 0) return;
    navigator.clipboard.writeText(correosOnboarding.join(', '));
    setTodosCorreosCopiados(true);
    mostrarNotificacion(`Copiados ${correosOnboarding.length} correos de onboarding`);
    setTimeout(() => setTodosCorreosCopiados(false), 2500);
  };

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

  // La única fuente de verdad oficial de casos es Google Sheets
  const casosTotales = useMemo(() => {
    return casosSheets;
  }, [casosSheets]);

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

  // 1. Al cargar casos / iniciar sesión: sonar y mostrar alertas emergentes si hay casos pendientes de push con SLA >= 4h
  useEffect(() => {
    if (casosTotales.length === 0) return;

    if (!alertaLoginEjecutadaRef.current) {
      alertaLoginEjecutadaRef.current = true;
      sessionStorage.setItem('peya_ultimo_timbre_ts', String(Date.now()));

      const pendientes = detectarCasosPushPendientes(casosTotales, role, email, nombreUsuarioAutenticado);
      if (pendientes.length > 0) {
        reproducirCampana();
        setAlertasPushActivas(pendientes);
      }
    }
  }, [casosTotales, role, email, nombreUsuarioAutenticado, reproducirCampana]);

  // 2. Recordatorio continuo cada 10 minutos si aún existen casos con SLA >= 4h sin push
  useEffect(() => {
    const timer = setInterval(() => {
      const casosActuales = casosTotalesRef.current || [];
      if (casosActuales.length === 0) return;

      const ultimoTs = parseInt(sessionStorage.getItem('peya_ultimo_timbre_ts') || '0', 10);
      const ahora = Date.now();
      const INTERVALO_RECORDATORIO_MS = 10 * 60 * 1000; // 10 minutos

      if (ultimoTs === 0 || ahora - ultimoTs >= INTERVALO_RECORDATORIO_MS) {
        sessionStorage.setItem('peya_ultimo_timbre_ts', String(ahora));
        const pendientes = detectarCasosPushPendientes(casosActuales, role, email, nombreUsuarioAutenticado);
        if (pendientes.length > 0) {
          reproducirCampana();
          setAlertasPushActivas(pendientes);
        }
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [role, email, nombreUsuarioAutenticado, reproducirCampana]);

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

  // Reloj de 1 minuto: fuerza el recálculo de SLA/alertas para que los casos que cruzan las 4h aparezcan sin recargar
  const [tickReloj, setTickReloj] = useState<number>(0);
  useEffect(() => {
    const t = setInterval(() => setTickReloj(x => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const casosConAlertas = useMemo(() => casosMostrados.map(c => ({ caso: c, alertas: analizarAlertasCaso(c) })), [casosMostrados, tickReloj]);
  
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
    
    // Obtener data en tiempo real desde Google Sheets (evita depender del caché local)
    let casosFrescos = casosTotales;
    try {
      const res = await fetch('/api/sheets/casos?forceRefresh=true'); // Forzar refresh si es posible, o simplemente fetch
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.casos) {
          casosFrescos = json.casos;
        }
      }
    } catch (err) {
      console.warn("Fallo búsqueda en tiempo real, usando caché local", err);
    }

    const resultadosLocales = casosFrescos.filter(c => 
      String(c.vendor_id || c.vendorId || '').toLowerCase() === term ||
      String(c.casoOp || c.id || '').toLowerCase() === term ||
      String(c.tienda || '').toLowerCase().includes(term)
    );
    setBusquedaResultados(resultadosLocales);
    if (resultadosLocales.length > 0) {
      // Ordenar para tomar el último caso registrado (fila más alta en la base)
      const casosOrdenados = [...resultadosLocales].sort((a, b) => {
        const filaA = Number(a.filaNumero) || 0;
        const filaB = Number(b.filaNumero) || 0;
        if (filaA && filaB) return filaB - filaA;
        return 0;
      });
      const d = casosOrdenados[0] || resultadosLocales[0];
      setFormulario(prev => ({
        ...prev, 
        casoOp: '', 
        vendorId: d.vendor_id || d.vendorId || busquedaId.trim(), 
        tienda: d.tienda || '',
        pais: d.pais || prev.pais || 'Argentina', 
        kam: d.kam || '', 
        integracion: d.integracion || 'Datalive',
        oportunidad: resolverOportunidad(d.oportunidad, catalogosDinamicos.oportunidades),
        asset: d.asset || prev.asset || 'Integración',
        etapa: d.etapa ? limpiarTextoEtapa(d.etapa, d.comentarios, d.integracion) : 'Sin integración confirmada',
        fechaCreacion: '',
        sla_inicio: ''
      }));
      mostrarNotificacion(`Encontrados ${resultadosLocales.length} antecedentes.`, "success");
    } else {
      // Si no existen antecedentes, redirigir automáticamente a la pestaña de agregar caso nuevo
      setFormulario(prev => ({ 
        ...prev, 
        casoOp: '', 
        vendorId: busquedaId.trim(),
        tienda: '',
        kam: '',
        fechaCreacion: '',
        sla_inicio: ''
      }));
      setSubTabNuevo('registro');
      mostrarNotificacion(`Sin antecedentes previos para "${busquedaId.trim()}". Redirigiendo a nuevo registro.`, "info");
    }
    setCargandoBusqueda(false);
  };

  const limpiarFormularioNuevoCaso = () => {
    setFormulario(prev => ({
      ...prev,
      casoOp: '',
      vendorId: '',
      tienda: '',
      pais: 'Argentina',
      kam: '',
      integracion: 'Datalive',
      oportunidad: 'Franchise Extension',
      asset: 'Integración',
      casoSeguimiento: '',
      tieneCasoInicio: 'Si',
      comentarios: '',
      estado: 'En progreso',
      etapa: 'Sin integración confirmada',
      fechaCreacion: '',
      sla_inicio: ''
    }));
    mostrarNotificacion('Formulario restablecido.', 'info');
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
      // Fecha de creación de la OP: se guarda vacía si el usuario no la ingresó, o la fecha que escribió
      const fechaCreacionInput = String(formulario.fechaCreacion || '').trim();
      const fCreacion = fechaCreacionInput ? formatearFechaHora(fechaCreacionInput) : '';
      const fInicio = formatearFechaHora(formulario.sla_inicio || fechaCreacionInput || ahora) || ahora;

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
        const recuentoCasos = casosSheets.length;
        proximaFila = recuentoCasos + 3;
      }

      const docId = esOpValido ? opInput : `SIN_OP_${formulario.vendorId || 'caso'}_r${proximaFila}`;
      const opResuelta = resolverOportunidad(formulario.oportunidad, catalogosDinamicos.oportunidades);

      const casoProcesado = procesarActualizacionCaso({}, {
        ...formulario, 
        oportunidad: opResuelta,
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

      // 2. Guardar y sincronizar directamente con Google Sheets
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

      mostrarNotificacion(`Caso registrado exitosamente en fila #${filaConfirmada}`, "success");
      
      // Limpiar formulario completo manteniendo propietario y fechas preparadas
      setFormulario({
        casoOp: '', 
        vendorId: '', 
        tienda: '', 
        pais: 'Argentina', 
        kam: '',
        integracion: 'Datalive', 
        oportunidad: 'Franchise Extension', 
        asset: 'Integración',
        propietarioOportunidad: nombreUsuarioAutenticado, 
        propietarioTicket: nombreUsuarioAutenticado,
        casoSeguimiento: '', 
        tieneCasoInicio: 'Si', 
        comentarios: '', 
        estado: 'En progreso',
        etapa: 'Sin integración confirmada', 
        fechaCreacion: '',
        sla_inicio: ''
      });
    } catch (err: any) {
      console.error("Error al registrar caso:", err);
      mostrarNotificacion(`❌ Error al registrar caso: ${err.message}`, "error");
    } finally {
      setCargandoOperacion(null);
    }
  };

  const actualizarCasoExistente = async (casoActualizado: any) => {
    setCargandoOperacion('Guardando cambios en Google Sheets...');
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

      const opResuelta = resolverOportunidad(casoActualizado.oportunidad, catalogosDinamicos.oportunidades);

      const casoFinal = procesarActualizacionCaso(casoPrevio, {
        ...casoActualizado,
        oportunidad: opResuelta,
        esNuevo: false,
        casoOp: casoOpFinal
      });
      casoFinal.esNuevo = false;
      
      if (filaNum) {
        casoFinal.filaNumero = filaNum;
      }

      const nuevoDocId = esOpValido ? opInput : (idPrevio || `SIN_OP_${casoFinal.vendorId || 'caso'}_r${filaNum || 'edit'}`);
      casoFinal.id = nuevoDocId;

      // 1. Actualizar estados locales de inmediato
      const coincideCaso = (c: any) => 
        (filaNum && c.filaNumero === filaNum) ||
        (idPrevio && String(c.id).trim() === idPrevio) ||
        (nuevoDocId && String(c.id).trim() === nuevoDocId) ||
        (esOpValido && String(c.casoOp).trim() === opInput);

      setCasosSheets(prev => prev.map(c => coincideCaso(c) ? { ...c, ...casoFinal } : c));

      // 2. Guardar y sincronizar directamente con Google Sheets
      await actualizarCasoEnSheets({ ...casoFinal, esNuevo: false }).catch(err => {
        console.warn('Sheets sync notice:', err);
      });

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

      // 2. Actualizar estado local de casos
      setCasosSheets(prev => prev.filter(c => String(c.id).trim() !== targetId && String(c.casoOp || '').trim() !== String(caso.casoOp || '').trim()));

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

      const cambiosRaw: Record<string, any> = {};
      if (tipo === 'pos') {
        cambiosRaw.fechaPushPos = fechaSheet;
      } else if (tipo === 'cat') {
        cambiosRaw.fechaPushCat = fechaSheet;
      } else if (tipo === 'kam_pos') {
        cambiosRaw.pushKamPos = true;
      } else if (tipo === 'kam_cat') {
        cambiosRaw.pushKamCat = true;
      }

      // Procesar todas las 4 casuísticas del flujo de Onboarding
      const casoActualizado = procesarActualizacionCaso(caso, cambiosRaw);
      casoActualizado.esNuevo = false;
      if (caso.filaNumero) casoActualizado.filaNumero = caso.filaNumero;
      if (caso.id) casoActualizado.id = caso.id;

      // 1. Actualización inmediata local
      const coincideCaso = (c: any) => 
        (String(c.id).trim() === idBuscado || 
         String(c.casoOp || '').trim() === idBuscado || 
         (caso.casoOp && String(c.casoOp).trim() === String(caso.casoOp).trim()) ||
         (caso.filaNumero && Number(c.filaNumero) === Number(caso.filaNumero)));

      setCasosSheets(prev => prev.map(c => coincideCaso(c) ? { ...c, ...casoActualizado } : c));

      // 2. Sincronizar directamente con Backend y Google Sheets
      try {
        const resPush = await fetch('/api/sheets/registrar-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            casoId: idBuscado, 
            casoOp: caso.casoOp, 
            filaNumero: caso.filaNumero, 
            fecha: fechaSheet, 
            tipo,
            respuestaPos: casoActualizado.respuestaPos,
            pushKamPos: casoActualizado.pushKamPos,
            fechaInicioPos: casoActualizado.fechaInicioPos,
            freezePos: casoActualizado.freezePos || '',
            respuestaCat: casoActualizado.respuestaCat,
            pushKamCat: casoActualizado.pushKamCat,
            fechaInicioCat: casoActualizado.fechaInicioCat,
            freezeCat: casoActualizado.freezeCat || ''
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
    const opResuelta = resolverOportunidad(datosTienda.oportunidad, catalogosDinamicos.oportunidades);
    const etapaLimpia = datosTienda.etapa 
      ? limpiarTextoEtapa(datosTienda.etapa, datosTienda.comentarios, datosTienda.integracion)
      : 'Sin integración confirmada';

    setFormulario(prev => ({
      ...prev, 
      casoOp: '', 
      vendorId: datosTienda.vendorId || datosTienda.vendor_id || prev.vendorId,
      tienda: datosTienda.tienda || prev.tienda, 
      pais: datosTienda.pais || prev.pais || 'Argentina',
      kam: datosTienda.kam || prev.kam || '', 
      integracion: datosTienda.integracion || prev.integracion || 'Datalive',
      oportunidad: opResuelta,
      asset: datosTienda.asset || prev.asset || 'Integración',
      etapa: etapaLimpia,
      fechaCreacion: '',
      sla_inicio: ''
    }));
    setActiveTab('nuevo');
    setSubTabNuevo('registro');
    mostrarNotificacion(`Datos replicados (${datosTienda.tienda || datosTienda.vendorId || ''}). Ingresa el N° de Caso OP.`);
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
    <div className="flex h-screen bg-[#121212] text-gray-200 font-sans">
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
          className="w-12 h-12 bg-[#E85A80] hover:bg-[#F46C8E] text-white rounded-full shadow-2xl flex items-center justify-center text-xl transition transform active:scale-95 border-2 border-pink-400 cursor-pointer"
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
          <div className="relative w-72 bg-[#202024] border-r border-[#3A3A3E] flex flex-col h-full shadow-2xl z-10 animate-slideRight">
            <div className="p-4 border-b border-[#3A3A3E] flex items-center justify-between">
              <h1 className="text-xl font-black text-[#E85A80] tracking-tighter">PeYa<span className="text-white">ONB</span></h1>
              <button 
                onClick={() => setSidebarMovilAbierto(false)} 
                className="text-[#B3B3B3] hover:text-white p-1.5 rounded-lg hover:bg-[#2C2C32] text-lg cursor-pointer"
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
                        ? 'bg-[#E85A80]/20 text-[#F46C8E] border border-[#E85A80]/30 font-bold' 
                        : 'text-[#B3B3B3] hover:bg-[#2C2C32] hover:text-gray-200'
                    }`}
                  >
                    <span className="text-base">{tab.icono}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t border-[#3A3A3E]">
              <SyncIndicator isConnected={true} ultimaSync={ultimaSync} sincronizando={cargandoSheets} totalCasos={casosSheets.length || casosTotales.length} onForzarSync={() => cargarCasosGoogleSheets()} />
              <button onClick={() => { setMostrarModalCreds(true); setSidebarMovilAbierto(false); }} className="w-full mt-2 bg-[#2C2C32] hover:bg-[#3A3A3E] text-[#D1D5DB] px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">⚙️ Configuración</button>
              <div className="mt-4 flex items-center justify-between text-xs text-[#B3B3B3]">
                <span className="truncate max-w-[150px]">{nombreUsuarioAutenticado}</span>
                <button onClick={manejarLogout} className="hover:text-[#F46C8E] cursor-pointer min-h-[44px]">Salir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar de escritorio: colapsable y responsivo */}
      <div className={`${sidebarColapsado ? 'w-20' : 'w-64'} bg-[#202024] border-r border-[#3A3A3E] flex flex-col hidden min-[1037px]:flex transition-all duration-300 select-none`}>
        <div className={`p-4 border-b border-[#3A3A3E] flex items-center ${sidebarColapsado ? 'justify-center flex-col gap-2' : 'justify-between'}`}>
          {!sidebarColapsado ? (
            <h1 className="text-xl font-black text-[#E85A80] tracking-tighter">PeYa<span className="text-white">ONB</span></h1>
          ) : (
            <span className="text-sm font-black text-[#E85A80]">PY</span>
          )}
          <button
            type="button"
            onClick={() => setSidebarColapsado(prev => !prev)}
            className="text-[#B3B3B3] hover:text-white bg-transparent border-0 text-base font-mono font-bold px-1.5 py-0.5 transition cursor-pointer select-none"
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
                    ? 'bg-[#E85A80]/20 text-[#F46C8E] border border-[#E85A80]/30 font-bold' 
                    : 'text-[#B3B3B3] hover:bg-[#2C2C32] hover:text-gray-200'
                } ${sidebarColapsado ? 'justify-center px-1' : ''}`}
              >
                <span className="text-base">{tab.icono}</span>
                {!sidebarColapsado && <span className="truncate">{tab.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-[#3A3A3E]">
          {!sidebarColapsado ? (
            <>
              <SyncIndicator isConnected={true} ultimaSync={ultimaSync} sincronizando={cargandoSheets} totalCasos={casosSheets.length || casosTotales.length} onForzarSync={() => cargarCasosGoogleSheets()} />
              <button onClick={() => setMostrarModalCreds(true)} className="w-full mt-2 bg-[#2C2C32] hover:bg-[#3A3A3E] text-[#D1D5DB] px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">⚙️ Configuración</button>
              <div className="mt-4 flex items-center justify-between text-xs text-[#B3B3B3]">
                <span className="truncate max-w-[130px]" title={nombreUsuarioAutenticado}>{nombreUsuarioAutenticado}</span>
                <button onClick={manejarLogout} className="hover:text-[#F46C8E] cursor-pointer min-h-[44px]">Salir</button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 text-xs">
              <button 
                onClick={() => cargarCasosGoogleSheets()} 
                title="Sincronizar desde Sheets"
                className="text-[#B3B3B3] hover:text-[#F46C8E] text-base cursor-pointer"
              >
                🔄
              </button>
              <button 
                onClick={() => setMostrarModalCreds(true)} 
                title="Configuración"
                className="text-[#B3B3B3] hover:text-white text-base cursor-pointer"
              >
                ⚙️
              </button>
              <button 
                onClick={manejarLogout} 
                title="Cerrar sesión"
                className="text-[#B3B3B3] hover:text-[#F46C8E] text-base cursor-pointer min-h-[44px]"
              >
                🚪
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

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
              setCargandoOperacion={setCargandoOperacion}
            />
          )}
          
          {activeTab === 'nuevo' && puedeVerTab('nuevo') && (
            <div className="space-y-5 w-full">
              {/* Barra superior de correos del equipo de Onboarding para tickets */}
              <div className="bg-[#1A1A1C] border border-[#3A3A3E] rounded-2xl p-3 sm:p-3.5 shadow-lg">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[#F46C8E] text-sm">✉️</span>
                    <span className="text-xs font-bold text-gray-200">Equipo Onboarding:</span>
                    <span className="text-[11px] text-[#B3B3B3] font-normal hidden sm:inline">
                      (1 clic para copiar a ticket de seguimiento)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {correosOnboarding.map((correo) => (
                      <button
                        key={correo}
                        type="button"
                        onClick={() => copiarCorreoIndividual(correo)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-mono transition flex items-center gap-1 cursor-pointer border ${
                          correoCopiado === correo
                            ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
                            : 'bg-[#121212] hover:bg-[#2C2C32] text-[#D1D5DB] hover:text-white border-[#3A3A3E]/80 hover:border-[#E85A80]/60'
                        }`}
                        title={`Clic para copiar ${correo}`}
                      >
                        <span>{correoCopiado === correo ? '✅' : '📋'}</span>
                        <span>{correo}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={copiarTodosCorreosOnboarding}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                        todosCorreosCopiados
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-pink-950/70 hover:bg-pink-900/90 text-pink-300 border-pink-700/60'
                      }`}
                      title="Copiar todos los correos del equipo separados por coma"
                    >
                      <span>{todosCorreosCopiados ? '✅' : '📑'}</span>
                      <span>{todosCorreosCopiados ? '¡Todos copiados!' : 'Copiar todos'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Barra de Sub-pestañas: Búsqueda vs Agregar Caso */}
              <div className="bg-[#1A1A1C] border border-[#3A3A3E] rounded-2xl p-2.5 shadow-lg flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSubTabNuevo('busqueda')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      subTabNuevo === 'busqueda'
                        ? 'bg-[#E85A80] text-white shadow-lg shadow-pink-900/40 border border-[#E85A80]'
                        : 'bg-[#121212] text-[#B3B3B3] hover:text-white hover:bg-[#2C2C32] border border-[#3A3A3E]'
                    }`}
                  >
                    <span>🔍</span>
                    <span>Búsqueda de Casos</span>
                    {busquedaResultados && busquedaResultados.length > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${subTabNuevo === 'busqueda' ? 'bg-white/20 text-white' : 'bg-pink-950 text-[#F46C8E] border border-pink-800'}`}>
                        {busquedaResultados.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setSubTabNuevo('registro')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      subTabNuevo === 'registro'
                        ? 'bg-[#E85A80] text-white shadow-lg shadow-pink-900/40 border border-[#E85A80]'
                        : 'bg-[#121212] text-[#B3B3B3] hover:text-white hover:bg-[#2C2C32] border border-[#3A3A3E]'
                    }`}
                  >
                    <span>➕</span>
                    <span>Agregar Caso (Nuevo Registro)</span>
                    {formulario.vendorId && (
                      <span className="text-[10px] text-[#F46C8E] font-mono hidden sm:inline">
                        ({formulario.tienda ? formulario.tienda.slice(0, 18) + '...' : formulario.vendorId})
                      </span>
                    )}
                  </button>
                </div>

                <div className="text-xs text-[#B3B3B3] px-3 hidden md:block">
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
                  }} 
                  onLimpiar={() => setBusquedaResultados([])}
                />
              ) : (
                <CasoForm 
                  formulario={formulario} 
                  onChange={manejarCambioForm} 
                  onGuardar={guardarNuevoCaso} 
                  onLimpiar={limpiarFormularioNuevoCaso}
                  nombreUsuario={nombreUsuarioAutenticado} 
                  puedeRegistrar={puedeRegistrar} 
                  integraciones={listaIntegracionesNombres}
                  integracionesDetalle={catalogosDinamicos.integraciones}
                  correosOnboarding={correosOnboarding}
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
                        ? 'bg-[#E85A80] text-white border-[#E85A80] shadow-sm font-bold'
                        : 'bg-[#2C2C32] text-[#D1D5DB] border-[#3A3A3E] hover:bg-[#3A3A3E] hover:text-white'
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
                        ? 'bg-[#E85A80] text-white border-[#E85A80] shadow-sm font-bold'
                        : 'bg-[#2C2C32] text-[#D1D5DB] border-[#3A3A3E] hover:bg-[#3A3A3E] hover:text-white'
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
                        ? 'bg-[#2C2C32] text-[#9CA3AF] border-[#3A3A3E] cursor-not-allowed'
                        : 'bg-[#2C2C32]/90 hover:bg-[#3A3A3E] text-[#F46C8E] hover:text-pink-300 border-[#E85A80]/40 hover:border-[#E85A80] shadow-sm cursor-pointer'
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
              <div className="bg-[#202024] border border-[#3A3A3E] rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-[#121212] border-b border-[#3A3A3E] text-xs text-[#B3B3B3] font-bold uppercase tracking-wider select-none">
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.op, minWidth: colWidthsMisCasos.op }}>
                          <span>OP</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('op', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#F46C8E] transition-colors" />
                        </th>
                        <th 
                          onClick={() => {
                            if (tipoOrdenMisCasos !== 'tienda') {
                              setTipoOrdenMisCasos('tienda');
                            } else {
                              setSentidoTienda(prev => prev === 'asc' ? 'desc' : 'asc');
                            }
                          }}
                          className="p-3 cursor-pointer hover:text-[#F46C8E] transition relative" 
                          title="Clic para ordenar alfabéticamente por tienda"
                          style={{ width: colWidthsMisCasos.tienda, minWidth: colWidthsMisCasos.tienda }}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Tienda</span>
                            <span className="text-[11px] font-mono">
                              {tipoOrdenMisCasos === 'tienda' ? (sentidoTienda === 'asc' ? '🔼 (A-Z)' : '🔽 (Z-A)') : '↕️'}
                            </span>
                          </div>
                          <div onMouseDown={(e) => { e.stopPropagation(); iniciarRedimensionarMisCasos('tienda', e); }} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#F46C8E] transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.pais, minWidth: colWidthsMisCasos.pais }}>
                          <span>País/KAM</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('pais', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#F46C8E] transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.integracion, minWidth: colWidthsMisCasos.integracion }}>
                          <span>Integración</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('integracion', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#F46C8E] transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.estado, minWidth: colWidthsMisCasos.estado }}>
                          <span>Estado / Etapa</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('estado', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#F46C8E] transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.pushPos, minWidth: colWidthsMisCasos.pushPos }}>
                          <span>Push POS</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('pushPos', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#F46C8E] transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.pushCat, minWidth: colWidthsMisCasos.pushCat }}>
                          <span>Push Catálogo</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('pushCat', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#F46C8E] transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.sla, minWidth: colWidthsMisCasos.sla }}>
                          <span>SLA</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('sla', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#F46C8E] transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.asignado, minWidth: colWidthsMisCasos.asignado }}>
                          <span>Asignado</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('asignado', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#F46C8E] transition-colors" />
                        </th>
                        <th className="p-3 relative" style={{ width: colWidthsMisCasos.accion, minWidth: colWidthsMisCasos.accion }}>
                          <span>Acción</span>
                          <div onMouseDown={(e) => iniciarRedimensionarMisCasos('accion', e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#F46C8E] transition-colors" />
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
              rolUsuario={role}
              onActualizarRoles={async (nuevosRoles: string[]) => {
                const nuevosCat = {
                  ...catalogosDinamicos,
                  roles: nuevosRoles
                };
                setCatalogosDinamicos(nuevosCat);
                await guardarCatalogosEnFirestore(nuevosCat);
              }}
              setCargandoOperacion={setCargandoOperacion}
            />
          )}
        </div>
      </div>

      {/* Overlay Global de Carga con Spinner */}
      {cargandoOperacion && (
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-white animate-fadeIn">
          <div className="w-14 h-14 border-4 border-[#E85A80] border-t-transparent rounded-full animate-spin"></div>
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
          integraciones={listaIntegracionesNombres}
        />
      )}

      {/* Notificación de confirmación: capa superior, visible incluso con modales abiertos */}
      {notificacion && (
        <div className={`fixed top-4 right-4 z-[99999] px-4 py-3 rounded-xl text-sm font-bold shadow-2xl animate-bounce pointer-events-none ${notificacion.tipo === 'error' ? 'bg-rose-600 text-white' : notificacion.tipo === 'info' ? 'bg-sky-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {notificacion.texto}
        </div>
      )}
    </div>
  );
}
