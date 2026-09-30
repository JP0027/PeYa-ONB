import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from '../../firebase';
import { isAgentMatch, identificarMiembro } from '../../utils/agentMatching';
import { esSupervisor, puedeRegistrarCasos, obtenerPestanasPorDefecto } from '../../utils/userPermissions';
import { procesarActualizacionCaso, analizarAlertasCaso, limpiarTextoEtapa } from '../../utils/onboardingRules';
import { LISTA_INTEGRACIONES_OFICIALES } from '../../data/catalogoOnboarding';

import { consultarCasosGoogleSheets, actualizarCasoEnSheets } from '../../services/googleSheetsService';
import { eliminarCasoFirestore } from '../../services/firebaseCasosService';

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
import { suscribirCatalogos, CATALOGOS_POR_DEFECTO } from '../../services/catalogoService';

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

function formatearFechaEspanol(d: Date = new Date()): string {
  const dia = d.getDate();
  const mes = d.getMonth() + 1;
  const anio = d.getFullYear();
  const horas = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const seg = String(d.getSeconds()).padStart(2, '0');
  return `${dia}/${mes}/${anio} ${horas}:${min}:${seg}`;
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
    // Si explícitamente es menor a 24 horas, ignorar
    if (r.includes('<24') || r.includes('<4') || r.includes('≤6') || r.includes('0h a') || r.includes('>6h a')) continue;
    // Si contiene 24, 72 o 96 horas o símbolos de mayor/igual
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
    // SUPERVISOR / TL:
    // Todos los casos de más de 24 horas que les falte Push de KAM (en POS API o en Catálogo)
    casosActivos.forEach(c => {
      const opLabel = c.casoOp || c.vendorId || c.id || 'Sin ID';
      const tiendaLabel = c.tienda || 'Sin tienda';

      // 1. Falta Push KAM en POS API
      const tieneTrackPos = Boolean((c.fechaInicioPos && c.fechaInicioPos !== 'S/V' && c.fechaInicioPos !== '-') || (c.rangoSlaPos && c.rangoSlaPos !== '-' && c.rangoSlaPos !== 'S/V'));
      const esSvPos = c.respuestaPos === 'S/V' || String(c.rangoSlaPos).toUpperCase() === 'S/V';
      const faltaKamPos = tieneTrackPos && !esSvPos && (c.pushKamPos !== true && String(c.pushKamPos).trim().toUpperCase() !== 'TRUE');
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

      // 2. Falta Push KAM en Catálogo
      const tieneTrackCat = Boolean((c.fechaInicioCat && c.fechaInicioCat !== 'S/V' && c.fechaInicioCat !== '-') || (c.rangoSlaCat && c.rangoSlaCat !== '-' && c.rangoSlaCat !== 'S/V'));
      const esSvCat = c.respuestaCat === 'S/V' || String(c.rangoSlaCat).toUpperCase() === 'S/V';
      const faltaKamCat = tieneTrackCat && !esSvCat && (c.pushKamCat !== true && String(c.pushKamCat).trim().toUpperCase() !== 'TRUE');
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
    // Casos asignados al agente exclusivamente (sin fallback a otros casos)
    const misCasos = casosActivos.filter(c => isAgentMatch(c, emailUsuario, nombreUsuario));
    const pool = misCasos;

    pool.forEach(c => {
      const horas = c.horasSLA || c.totalHorasOp || 0;
      const rOp = String(c.rangoSlaOp || c.rangoSla || '').toLowerCase();
      const rPos = String(c.rangoSlaPos || '').toLowerCase();
      const rCat = String(c.rangoSlaCat || '').toLowerCase();

      const enRango4a6 = (horas >= 4 && horas <= 6) ||
                         rOp.includes('4h') || rOp.includes('6h') || rOp.includes('≥4') ||
                         rPos.includes('4h') || rPos.includes('6h') || rPos.includes('≥4') ||
                         rCat.includes('4h') || rCat.includes('6h') || rCat.includes('≥4');
      if (!enRango4a6) return;

      const opLabel = c.casoOp || c.vendorId || c.id || 'Sin ID';
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

  // Lista dinámica de pestañas permitidas para el usuario autenticado (desde Firestore o por defecto)
  const [pestanasPermitidas, setPestanasPermitidas] = useState<string[]>(() => {
    const porDefecto = obtenerPestanasPorDefecto(role);
    return !tieneAccesoSupervisor ? porDefecto.filter(p => p !== 'usuarios') : porDefecto;
  });

  const puedeVerTab = useCallback((tabId: string): boolean => {
    // Regla estricta de seguridad: Agentes NUNCA pueden ver 'usuarios'
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

  // Escuchar en tiempo real los permisos de pestañas específicos asignados al usuario en Firestore
  useEffect(() => {
    if (!email) return;
    const correoLimpio = String(email).trim().toLowerCase();
    const unsubscribe = onSnapshot(doc(db, 'usuarios_permitidos', correoLimpio), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        let tabs = Array.isArray(data.pestanas) && data.pestanas.length > 0 
          ? data.pestanas 
          : obtenerPestanasPorDefecto(data.rol || role);
        
        // Regla estricta: Agentes NUNCA pueden ver 'usuarios'
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

  // Si la pestaña actual ya no está permitida (o se cargaron nuevos permisos), redirigir a la primera válida
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
  const [casosSheets, setCasosSheets] = useState<any[]>([]);
  const [cargandoSheets, setCargandoSheets] = useState<boolean>(false);
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null);
  
  const [casoSeleccionadoModal, setCasoSeleccionadoModal] = useState<any | null>(null);
  const [filtroMisCasos, setFiltroMisCasos] = useState<string>('todos');
  const [ordenMisCasosTienda, setOrdenMisCasosTienda] = useState<'sla' | 'asc' | 'desc'>('sla');
  const [mostrarModalCreds, setMostrarModalCreds] = useState<boolean>(false);

  const toggleOrdenMisCasosTienda = () => {
    setOrdenMisCasosTienda(prev => {
      if (prev === 'sla') return 'asc';
      if (prev === 'asc') return 'desc';
      return 'sla';
    });
  };
  
  const [busquedaResultados, setBusquedaResultados] = useState<any[]>([]);
  const [cargandoBusqueda, setCargandoBusqueda] = useState<boolean>(false);
  const [subTabNuevo, setSubTabNuevo] = useState<'busqueda' | 'registro'>('busqueda');
  const [notificacion, setNotificacion] = useState<{ texto: string; tipo: 'success' | 'error' | 'info' } | null>(null);
  const [alertasPushActivas, setAlertasPushActivas] = useState<AlertaPush[]>([]);
  const [casoResaltadoId, setCasoResaltadoId] = useState<string | null>(null);

  const manejarClicAlertaPush = useCallback((alerta: AlertaPush) => {
    if (!alerta || !alerta.caso) return;
    const targetCaso = alerta.caso;
    const idBuscado = String(targetCaso.casoOp || targetCaso.vendorId || targetCaso.id || '').trim();

    // 1. Navegar a la pestaña correspondiente
    if (puedeVerTab('tl')) {
      setActiveTab('tl');
    } else if (puedeVerTab('inicio')) {
      setActiveTab('inicio');
    } else if (pestanasPermitidas.length > 0) {
      setActiveTab(pestanasPermitidas[0]);
    }

    // 2. Resaltar / sombrear la fila en la tabla
    setCasoResaltadoId(idBuscado);

    // 3. Scroll suave hasta la fila del caso en la lista
    setTimeout(() => {
      const el = document.getElementById(`caso-row-${idBuscado}`) || 
                 document.getElementById(`caso-row-${targetCaso.id}`) ||
                 document.getElementById(`caso-row-${targetCaso.casoOp}`) ||
                 document.getElementById(`caso-row-${targetCaso.vendorId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);

    // 4. Remover el toast clicado
    setAlertasPushActivas(prev => prev.filter(a => a.id !== alerta.id));

    // 5. Quitar el sombreado automáticamente después de 8 segundos
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

  const [formulario, setFormulario] = useState<FormularioNuevoCaso>({
    casoOp: '', vendorId: '', tienda: '', pais: 'Argentina', kam: '',
    integracion: 'Datalive', oportunidad: 'Franchise Extensión', asset: 'Integración',
    propietarioOportunidad: nombreUsuarioAutenticado, propietarioTicket: nombreUsuarioAutenticado,
    casoSeguimiento: '', tieneCasoInicio: 'Si', comentarios: '', estado: 'En progreso',
    etapa: 'Sin integración confirmada', fechaCreacion: new Date().toISOString().split('T')[0]
  });

  const [catalogosDinamicos, setCatalogosDinamicos] = useState<Record<string, any[]>>(CATALOGOS_POR_DEFECTO);

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
          setCatalogosDinamicos(prev => ({
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
    if (!silencioso) setCargandoSheets(true);
    try {
      const data = await consultarCasosGoogleSheets();
      if (Array.isArray(data) && data.length > 0) {
        setCasosSheets(data);
        setUltimaSync(new Date());
      }
    } catch (err) {
      console.warn("Consulta Google Sheets fallida:", err);
    } finally {
      if (!silencioso) setCargandoSheets(false);
    }
  };

  useEffect(() => {
    cargarCasosGoogleSheets();
  }, []);

  useEffect(() => {
    const casosRef = collection(db, "casos");
    const unsubscribe = onSnapshot(casosRef, (snapshot) => {
      const nuevosCasos = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      casosCountRef.current = nuevosCasos.length;
      setCasosFirestore(nuevosCasos);
    }, (err) => {
      console.warn("Firestore subscription warning:", err);
    });
    return () => unsubscribe();
  }, []);

  const casosTotales = useMemo(() => {
    if (!casosSheets || casosSheets.length === 0) return casosFirestore;

    const mapaCasos = new Map<string, any>();
    // Guardar cada caso de Google Sheets con su clave única para preservar todas las filas
    casosSheets.forEach((c, idx) => {
      const key = String(c.id || (c.casoOp ? `${c.casoOp}_${idx}` : `fila_${idx}`)).trim();
      mapaCasos.set(key, c);
    });

    // Mezclar actualizaciones puntuales de Firestore sin duplicar casos ni revivir cerrados
    casosFirestore.forEach(c => {
      const idKey = String(c.id || '').trim();
      const opKey = String(c.casoOp || '').trim();
      const vendorKey = String(c.vendorId || c.vendor_id || '').trim();

      let casoExistenteKey: string | null = null;
      for (const [key, prev] of mapaCasos.entries()) {
        const matchOp = opKey && String(prev.casoOp || '').trim() === opKey;
        const matchVendor = vendorKey && String(prev.vendorId || prev.vendor_id || '').trim() === vendorKey && (!opKey || !prev.casoOp);
        const matchId = idKey && (key === idKey || key.startsWith(idKey + '_') || String(prev.vendorId || '').trim() === idKey);

        if (matchOp || matchVendor || matchId) {
          casoExistenteKey = key;
          break;
        }
      }

      if (casoExistenteKey) {
        const prev = mapaCasos.get(casoExistenteKey);
        // Si en Google Sheets ya figura como cerrado o sin oportunidad, respetar la clasificación oficial de Sheets
        const sheetsCerrado = !prev.esActivo || String(prev.estado || '').toLowerCase().match(/cerrad|fallid|cancel/);
        const sheetsSinOp = String(prev.estado || '').toLowerCase().includes('sin oportunidad');

        mapaCasos.set(casoExistenteKey, { 
          ...prev,
          comentarios: c.comentarios || prev.comentarios,
          fechaPushPos: c.fechaPushPos || prev.fechaPushPos,
          fechaPushCat: c.fechaPushCat || prev.fechaPushCat,
          pushKamPos: c.pushKamPos !== undefined ? c.pushKamPos : prev.pushKamPos,
          pushKamCat: c.pushKamCat !== undefined ? c.pushKamCat : prev.pushKamCat,
          respuestaPos: c.respuestaPos || prev.respuestaPos,
          respuestaCat: c.respuestaCat || prev.respuestaCat,
          freezePos: c.freezePos || prev.freezePos,
          freezeCat: c.freezeCat || prev.freezeCat,
          estado: sheetsCerrado ? prev.estado : (sheetsSinOp ? prev.estado : (c.estado || prev.estado)),
          esActivo: sheetsCerrado ? false : prev.esActivo
        });
      } else if (opKey && !opKey.startsWith('row_') && c.tienda && !mapaCasos.has(opKey)) {
        // Solo agregar un nuevo caso genuino creado en la app si tiene OP y tienda válida
        mapaCasos.set(opKey, c);
      }
    });

    return Array.from(mapaCasos.values());
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

  // 1. Al iniciar sesión: sonar y mostrar alertas tipo captura para los casos pendientes de push
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
      if (!tieneAccesoSupervisor) {
        sessionStorage.setItem('peya_agente_push_reproducciones_' + sesionUsuarioKey, '1');
      }
    }
  }, [casosTotales.length > 0, sesionUsuarioKey, role, email, nombreUsuarioAutenticado, tieneAccesoSupervisor, reproducirCampana]);

  // 2. Recordatorio independiente cada 10 minutos (suena dos veces dejando 10 minutos de diferencia)
  useEffect(() => {
    const timer = setInterval(() => {
      const ultimoTs = parseInt(sessionStorage.getItem('peya_ultimo_timbre_ts') || '0', 10);
      const ahora = Date.now();
      const INTERVALO_RECORDATORIO_MS = 10 * 60 * 1000; // 10 minutos de diferencia

      if (ultimoTs > 0 && ahora - ultimoTs >= INTERVALO_RECORDATORIO_MS) {
        sessionStorage.setItem('peya_ultimo_timbre_ts', String(ahora));
        const casosActuales = casosTotalesRef.current || [];
        if (casosActuales.length > 0) {
          const pendientes = detectarCasosPushPendientes(casosActuales, role, email, nombreUsuarioAutenticado);
          if (pendientes.length > 0) {
            // Si es Agente, verificar límite de 2 reproducciones máximo en la sesión dejando 10 minutos
            if (!tieneAccesoSupervisor) {
              const veces = parseInt(sessionStorage.getItem('peya_agente_push_reproducciones_' + sesionUsuarioKey) || '0', 10);
              if (veces < 2) {
                reproducirCampana();
                sessionStorage.setItem('peya_agente_push_reproducciones_' + sesionUsuarioKey, String(veces + 1));
              }
            } else {
              // Supervisor / TL
              reproducirCampana();
            }

            // Mostrar modal/toast por caso
            setAlertasPushActivas(pendientes);
          }
        }
      }
    }, 15000); // Evalúa cada 15 segundos
    return () => clearInterval(timer);
  }, [role, email, nombreUsuarioAutenticado, tieneAccesoSupervisor, sesionUsuarioKey, reproducirCampana]);

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
      // Mostrar ÚNICAMENTE los casos asignados al agente que ingresó sesión
      return casosTotales.filter(c => esCasoActivo(c) && isAgentMatch(c, email, nombreUsuarioAutenticado));
    }
    return casosTotales;
  }, [casosTotales, activeTab, email, nombreUsuarioAutenticado]);

  const casosConAlertas = useMemo(() => casosMostrados.map(c => ({ caso: c, alertas: analizarAlertasCaso(c) })), [casosMostrados]);
  
  const totalEnProgresoNormal = useMemo(() => casosConAlertas.filter(x => {
    const est = String(x.caso.estado || '').toLowerCase().trim();
    const esSinOp = est.includes('sin oportunidad') || !x.caso.casoOp || String(x.caso.casoOp).trim() === '';
    return !esSinOp && (est === 'en progreso' || est.includes('progreso'));
  }).length, [casosConAlertas]);

  const totalSinOportunidad = useMemo(() => casosConAlertas.filter(x => {
    const est = String(x.caso.estado || '').toLowerCase().trim();
    return est.includes('sin oportunidad') || !x.caso.casoOp || String(x.caso.casoOp).trim() === '';
  }).length, [casosConAlertas]);

  const totalPos = useMemo(() => casosConAlertas.filter(x => x.alertas.requierePushPos).length, [casosConAlertas]);
  const totalCat = useMemo(() => casosConAlertas.filter(x => x.alertas.requierePushCat).length, [casosConAlertas]);
  const totalSla = useMemo(() => casosConAlertas.filter(x => x.alertas.esVencido || x.alertas.esProximoVencer || x.alertas.esCritico).length, [casosConAlertas]);

  const listaFiltrada = useMemo(() => {
    const filtrados = casosConAlertas.filter(x => {
      const est = String(x.caso.estado || '').toLowerCase().trim();
      const esSinOp = est.includes('sin oportunidad') || !x.caso.casoOp || String(x.caso.casoOp).trim() === '';
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

    // Ordenamiento por Nombre de Tienda si está activado
    if (ordenMisCasosTienda === 'asc') {
      return [...filtrados].sort((a, b) => 
        String(a.caso.tienda || '').localeCompare(String(b.caso.tienda || ''), 'es', { sensitivity: 'base' })
      );
    }
    if (ordenMisCasosTienda === 'desc') {
      return [...filtrados].sort((a, b) => 
        String(b.caso.tienda || '').localeCompare(String(a.caso.tienda || ''), 'es', { sensitivity: 'base' })
      );
    }

    // Por defecto: ordenar los casos con SLA crítico o próximo a vencer arriba
    return filtrados.sort((a, b) => {
      const critA = (a.alertas?.esCritico || (a.alertas?.horasTranscurridas || 0) >= 96) ? 1 : 0;
      const critB = (b.alertas?.esCritico || (b.alertas?.horasTranscurridas || 0) >= 96) ? 1 : 0;
      if (critA !== critB) return critB - critA;

      const proxA = (a.alertas?.esProximoVencer || ((a.alertas?.horasTranscurridas || 0) >= 72 && (a.alertas?.horasTranscurridas || 0) < 96)) ? 1 : 0;
      const proxB = (b.alertas?.esProximoVencer || ((b.alertas?.horasTranscurridas || 0) >= 72 && (b.alertas?.horasTranscurridas || 0) < 96)) ? 1 : 0;
      if (proxA !== proxB) return proxB - proxA;

      return (b.alertas?.horasTranscurridas || 0) - (a.alertas?.horasTranscurridas || 0);
    });
  }, [casosConAlertas, filtroMisCasos, ordenMisCasosTienda]);

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
    if (!formulario.casoOp) return mostrarNotificacion("El N° Caso OP es obligatorio.", "error");
    try {
      const docId = String(formulario.casoOp).trim();
      const casoProcesado = procesarActualizacionCaso({}, {
        ...formulario, 
        id: docId, 
        vendor_id: formulario.vendorId, 
        agente: formulario.propietarioTicket,
        sla_inicio: formulario.sla_inicio || formulario.fechaCreacion || new Date().toISOString(),
        fechaInicioSeguimientoOP: formulario.sla_inicio || formulario.fechaCreacion || '',
        actualizadoEn: new Date().toISOString()
      });

      // 1. Guardar en Firebase Firestore (Persistencia inmediata)
      const casoRef = doc(db, "casos", docId);
      await setDoc(casoRef, casoProcesado, { merge: true });

      // Actualizar estado local de Firestore de inmediato
      setCasosFirestore(prev => [casoProcesado, ...prev.filter(c => String(c.id).trim() !== docId && String(c.casoOp || '').trim() !== docId)]);
      
      // 2. Guardar y sincronizar con Google Sheets
      const sheetsRes = await actualizarCasoEnSheets(casoProcesado).catch(() => null);
      const casoFinalConFila = {
        ...casoProcesado,
        filaNumero: sheetsRes?.caso?.filaNumero || (casosSheets.length + 2)
      };
      setCasosSheets(prev => [casoFinalConFila, ...prev.filter(c => String(c.id).trim() !== docId && String(c.casoOp || '').trim() !== docId)]);

      mostrarNotificacion(`✅ Caso OP #${docId} registrado con éxito en Firebase y Google Sheets.`, "success");
      setFormulario(prev => ({ ...prev, casoOp: '', vendorId: '', tienda: '', comentarios: '', casoSeguimiento: '' }));
    } catch (err: any) {
      console.error("Error al registrar caso en Firebase/Sheets:", err);
      mostrarNotificacion(`❌ Error al registrar caso: ${err.message}`, "error");
    }
  };

  const actualizarCasoExistente = async (casoActualizado: any) => {
    try {
      const idBuscado = String(casoActualizado.casoOp || casoActualizado.id).trim();
      const casoPrevio = casosTotales.find(c => String(c.casoOp || c.id) === idBuscado) || {};
      const casoFinal = procesarActualizacionCaso(casoPrevio, casoActualizado);
      
      // 1. Guardar en Firebase Firestore (Persistencia en tiempo real)
      const casoRef = doc(db, "casos", idBuscado);
      await setDoc(casoRef, { ...casoFinal, id: idBuscado, actualizadoEn: new Date().toISOString() }, { merge: true });
      
      // Si el caso tenía un ID numérico o alternativo diferente a casoOp, actualizarlo también en Firebase
      if (casoActualizado.id && String(casoActualizado.id).trim() !== idBuscado) {
        const altRef = doc(db, "casos", String(casoActualizado.id).trim());
        await setDoc(altRef, { ...casoFinal, actualizadoEn: new Date().toISOString() }, { merge: true }).catch(() => {});
      }

      // Actualizar estados locales inmediatos
      setCasosFirestore(prev => prev.map(c => (String(c.casoOp || c.id) === idBuscado || (casoActualizado.id && String(c.id) === String(casoActualizado.id))) ? { ...c, ...casoFinal } : c));
      setCasosSheets(prev => prev.map(c => (String(c.casoOp || c.id) === idBuscado || (casoActualizado.id && String(c.id) === String(casoActualizado.id))) ? { ...c, ...casoFinal } : c));

      // 2. Guardar y sincronizar con Google Sheets
      await actualizarCasoEnSheets(casoFinal).catch(() => null);

      setCasoSeleccionadoModal(casoFinal);
      mostrarNotificacion(`✅ Caso OP #${idBuscado} actualizado en Firebase y Google Sheets.`, "success");
    } catch (err: any) {
      console.error("Error actualizando caso en Firebase/Sheets:", err);
      mostrarNotificacion(`❌ Error actualizando caso: ${err.message}`, "error");
    }
  };

  const manejarEliminarCaso = async (caso: any): Promise<boolean> => {
    if (!caso) return false;
    const targetId = String(caso.id || caso.casoOp || '').trim();
    const op = caso.casoOp || caso.vendorId || targetId;

    try {
      // 1. Eliminar en Google Sheets (backend)
      try {
        await fetch('/api/sheets/eliminar-caso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ casoId: targetId, casoOp: caso.casoOp })
        });
      } catch (sheetsErr) {
        console.warn('Error llamando /api/sheets/eliminar-caso:', sheetsErr);
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

      mostrarNotificacion(`✅ Caso OP #${op} eliminado de Firebase y Google Sheets.`, "success");
      return true;
    } catch (err: any) {
      console.error("Error al eliminar caso:", err);
      mostrarNotificacion(`❌ Error al eliminar caso OP #${op}: ${err.message}`, "error");
      return false;
    }
  };

  const manejarRegistrarPush = async (caso: any, tipo: 'pos' | 'cat' | 'kam_pos' | 'kam_cat') => {
    try {
      const fechaSheet = formatearFechaEspanol(new Date());
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

      // 1. Actualización inmediata del estado local para que el botón desaparezca al instante
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

      // 3. Sincronizar con Backend y Google Sheets
      fetch('/api/sheets/registrar-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casoId: idBuscado, fecha: fechaSheet, tipo })
      }).catch((e) => console.warn('Error sincronizando push con sheets:', e));

      actualizarCasoEnSheets(casoActualizado).catch(() => {});

      const labelTipo = tipo === 'pos' ? 'POS API' : (tipo === 'cat' ? 'Catálogo' : (tipo === 'kam_pos' ? 'KAM (POS API)' : 'KAM (Catálogo)'));
      mostrarNotificacion(`✅ Push ${labelTipo} guardado en Firebase y Google Sheets para OP #${caso.casoOp || idBuscado}.`, "success");

      // Remover toast activo para este caso si existía
      setAlertasPushActivas(prev => prev.filter(a => {
        const c = a.caso;
        return !(String(c?.id || '').trim() === idBuscado || String(c?.casoOp || '').trim() === idBuscado);
      }));
    } catch (err) {
      console.error("Error al registrar push:", err);
      mostrarNotificacion("Error al registrar push.", "error");
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

  const mostrarNotificacion = (texto: string, tipo: 'success' | 'error' | 'info' = "success") => {
    setNotificacion({ texto, tipo });
    setTimeout(() => setNotificacion(null), 5000);
  };

  const manejarLogout = () => {
    try {
      sessionStorage.removeItem('peya_login_alarm_' + sesionUsuarioKey);
      sessionStorage.removeItem('peya_ultimo_timbre_ts');
      sessionStorage.removeItem('peya_onb_active_tab');
      sessionStorage.removeItem('peya_agente_push_reproducciones_' + sesionUsuarioKey);
    } catch (e) {}
    if (onLogout) onLogout();
  };

  return (
    <div className="flex h-screen bg-[#0f111a] text-gray-200 font-sans">
      <audio ref={audioRef} src="/ding.mp3" preload="auto" />
      
      {/* Alertas Push Flotantes Tipo Captura (30 segundos, clicables con sombreado) */}
      <PushAlertContainer 
        alertas={alertasPushActivas} 
        onCerrarAlerta={manejarCerrarAlertaPush} 
        onCerrarTodas={manejarCerrarTodasAlertasPush}
        onClicAlerta={manejarClicAlertaPush} 
      />
      
      <div className="w-64 bg-[#161925] border-r border-gray-800 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-black text-pink-500 tracking-tighter">PeYa<span className="text-white">ONB</span></h1>
        </div>
        <div className="p-4 flex-1 space-y-2">
          {puedeVerTab('tl') && (
            <button 
              onClick={() => setActiveTab('tl')} 
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'tl' 
                  ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30 font-bold' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              Casos en progreso global
            </button>
          )}

          {/* Datos */}
          {puedeVerTab('admin') && (
            <button 
              onClick={() => setActiveTab('admin')} 
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'admin' 
                  ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30 font-bold' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              Datos
            </button>
          )}

          {/* Mis casos */}
          {puedeVerTab('inicio') && (
            <button 
              onClick={() => setActiveTab('inicio')} 
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'inicio' 
                  ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30 font-bold' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              Mis casos
            </button>
          )}

          {/* Busqueda y registro */}
          {puedeVerTab('nuevo') && (
            <button 
              onClick={() => setActiveTab('nuevo')} 
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'nuevo' 
                  ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30 font-bold' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              Busqueda y registro
            </button>
          )}

          {/* Gestionar usuarios */}
          {puedeVerTab('usuarios') && (
            <button 
              onClick={() => setActiveTab('usuarios')} 
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'usuarios' 
                  ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30 font-bold' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              Gestionar usuarios
            </button>
          )}
        </div>
        <div className="p-4 border-t border-gray-800">
          <SyncIndicator isConnected={true} ultimaSync={ultimaSync} sincronizando={cargandoSheets} totalCasos={casosSheets.length || casosTotales.length} onForzarSync={() => cargarCasosGoogleSheets()} />
          <button onClick={() => setMostrarModalCreds(true)} className="w-full mt-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">⚙️ Configuración</button>
          <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
            <span>{nombreUsuarioAutenticado}</span>
            <button onClick={manejarLogout} className="hover:text-pink-400 cursor-pointer">Salir</button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {notificacion && (
          <div className={`absolute top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-2xl animate-bounce ${notificacion.tipo === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
            {notificacion.texto}
          </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar p-6">
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
                />
              )}
            </div>
          )}

          {/* Mis casos: visible según permisos */}
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
                <div className="flex items-center gap-2">
                  {/* Botón Ordenar por Nombre de Tienda A-Z / Z-A */}
                  <button
                    onClick={toggleOrdenMisCasosTienda}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      ordenMisCasosTienda !== 'sla'
                        ? 'bg-pink-600/30 text-pink-300 border-pink-500 shadow-sm'
                        : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
                    }`}
                    title="Ordenar casos por nombre de tienda A-Z o Z-A"
                  >
                    <span>🔤</span>
                    <span>
                      Tienda: {ordenMisCasosTienda === 'asc' ? 'A - Z 🔼' : ordenMisCasosTienda === 'desc' ? 'Z - A 🔽' : 'Por SLA'}
                    </span>
                  </button>

                  <button
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

                  {/* Identificador exclusivo del agente autenticado */}
                  <div className="px-3 py-1.5 rounded-lg bg-pink-950/40 border border-pink-800/50 text-pink-300 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                    <span>👤</span>
                    <span>Agente: {nombreUsuarioAutenticado}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#161925] border border-gray-800 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-[#0f111a] border-b border-gray-800 text-xs text-gray-400 font-bold uppercase tracking-wider">
                        <th className="p-3">OP</th>
                        <th 
                          onClick={toggleOrdenMisCasosTienda}
                          className="p-3 cursor-pointer hover:text-pink-400 select-none transition" 
                          title="Clic para ordenar por nombre de tienda A-Z o Z-A"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Tienda</span>
                            <span className="text-[11px] font-mono">
                              {ordenMisCasosTienda === 'asc' ? '🔼 (A-Z)' : ordenMisCasosTienda === 'desc' ? '🔽 (Z-A)' : '↕️'}
                            </span>
                          </div>
                        </th>
                        <th className="p-3">País/KAM</th>
                        <th className="p-3">Integración</th>
                        <th className="p-3">Estado / Etapa</th>
                        <th className="p-3">Push POS</th>
                        <th className="p-3">Push Catálogo</th>
                        <th className="p-3">SLA</th>
                        <th className="p-3">Asignado</th>
                        <th className="p-3">Acción</th>
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
            />
          )}
        </div>
      </div>

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
        />
      )}
    </div>
  );
}
