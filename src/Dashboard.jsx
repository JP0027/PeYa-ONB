import { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, onSnapshot, where, getDocs, setDoc, doc } from "firebase/firestore";
import { db } from './firebase';
import { 
  guardarCasosEnFirestore, 
  generarScriptAppsScriptParaFirebase 
} from './services/firebaseCasosService';
import { 
  LISTA_INTEGRACIONES, 
  obtenerDetallesIntegracion 
} from './data/integracionesCuadro';
import { 
  consultarCasosGoogleSheets, 
  verificarEstadoCuentaServicio, 
  guardarCuentaServicio,
  obtenerGasUrl,
  guardarGasUrl,
  probarConexionGas,
  importarCasosCSV,
  actualizarCasoEnSheets,
  APPS_SCRIPT_TEMPLATE
} from './services/googleSheetsService';
import { isAgentMatch, AGENTES_CONOCIDOS, SUPERVISORES, AGENTES_OPERATIVOS, identificarMiembro } from './utils/agentMatching';
import { 
  procesarActualizacionCaso, 
  analizarAlertasCaso 
} from './utils/onboardingRules';
import ModalDetalleCaso from './components/ModalDetalleCaso';
import HeroCareTLView from './components/HeroCareTLView';
import { puedeRegistrarCasos, esSupervisor } from './utils/userPermissions';

const LISTA_PAISES = [
  'Argentina', 'Chile', 'Uruguay', 'Ecuador', 'Perú', 
  'Bolivia', 'Colombia', 'Costa Rica', 'El Salvador', 
  'Guatemala', 'Honduras', 'Nicaragua', 'Panamá', 
  'Paraguay', 'República Dominicana', 'Venezuela'
];

const LISTA_ASSETS = [
  'Integración', 'Menú', 'Ambos (Integración y Menú)', 
  'Logística', 'Dispositivo', 'New Business', 
  'Upgrade/Upsell Alta Integracion', 'Upgrade/Upsell Baja Integracion', 
  'Franchise Extension', 'Win Back', 'Otros'
];

const LISTA_AGENTES = [
  'Jean Palomino', 'Prisila Leon', 'Joel Tocas', 
  'Yadira Flores', 'Guillermo Gonzales', 'Jean Changanaqui', 
  'Henry Serrato', 'Joseline Yactayo', 'Comercial', 'Sin asignación'
];

const LISTA_ESTADOS = [
  'Nuevo', 'En progreso', 'Ticket HC', 
  'Cerrado por oportunidad satisfactoria', 
  'Cerrado por KAM', 'Cerrado por API Vendor', 'Fallido'
];

const LISTA_ETAPAS = [
  'Sin integración confirmada', 
  'En proceso de seteo', 
  'En proceso de verificación de catálogo', 
  'Validación del Onboarding', 
  'En proceso para pruebas', 
  'Pedido de prueba realizado'
];

const LISTA_OPORTUNIDADES = [
  'Franchise Extension', 'New Business', 'Sabor y Arte', 
  'Migración de Sistema', 'Apertura de Sucursal', 'Reingreso', 
  'Cambio de Razón Social', 'Upgrade/Upsell Alta Integracion', 
  'Upgrade/Upsell Baja Integracion'
];

export default function Dashboard({ role, email, nombreUsuario, onLogout }) {
  const tieneAccesoSupervisor = useMemo(() => esSupervisor(role), [role]);
  const puedeRegistrar = useMemo(() => puedeRegistrarCasos(role), [role]);

  const [activeTab, setActiveTab] = useState(tieneAccesoSupervisor ? 'tl' : 'inicio');
  const [casosFirestore, setCasosFirestore] = useState([]);
  const [casosSheets, setCasosSheets] = useState([]);
  const [cargandoSheets, setCargandoSheets] = useState(false);
  const [ultimaSync, setUltimaSync] = useState(null);
  const [sincronizandoAuto, setSincronizandoAuto] = useState(false);
  const [notificacion, setNotificacion] = useState(null);

  // Estado para la vista flotante (Modal) de caso previo / activo
  const [casoSeleccionadoModal, setCasoSeleccionadoModal] = useState(null);

  // Filtro específico para "Mis Casos" (alertas de Push y SLA)
  const [filtroMisCasos, setFiltroMisCasos] = useState('todos'); // 'todos' | 'pushPos' | 'pushCat' | 'sla'

  // Estado de conexión con Cuenta de Servicio de Google Sheets
  const [estadoCredenciales, setEstadoCredenciales] = useState({ configured: true, email: null });
  const [mostrarModalCreds, setMostrarModalCreds] = useState(false);
  const [jsonCredsInput, setJsonCredsInput] = useState("");
  const [guardandoCreds, setGuardandoCreds] = useState(false);
  
  // Filtro de Agente seleccionado en vista
  const [agenteFiltro, setAgenteFiltro] = useState("auto"); // "auto" = usa cuenta logueada, o nombre específico
  
  // Estados de Búsqueda
  const [busquedaId, setBusquedaId] = useState("");
  const [historialBusqueda, setHistorialBusqueda] = useState([]);
  const [cargandoBusqueda, setCargandoBusqueda] = useState(false);

  const audioRef = useRef(null);
  const miembroActual = useMemo(() => identificarMiembro(email), [email]);
  const nombreUsuarioAutenticado = nombreUsuario || miembroActual?.nombre || (email || '').split('@')[0] || 'Jean Palomino';

  // Estado del Formulario (Campos a - p exactos)
  const [formulario, setFormulario] = useState({
    casoOp: '', // a
    vendorId: '', // b
    tienda: '', // c
    pais: 'Argentina', // d
    kam: '', // e
    integracion: 'Datalive', // f
    oportunidad: 'Franchise Extension', // g
    asset: 'Integración', // h
    propietarioOportunidad: nombreUsuarioAutenticado, // i (automático con la cuenta)
    propietarioTicket: nombreUsuarioAutenticado, // j
    casoSeguimiento: '', // k
    tieneCasoInicio: 'Si', // l
    comentarios: '', // m
    estado: 'Nuevo', // n
    etapa: 'Validación del Onboarding', // o
    fechaCreacion: new Date().toISOString().split('T')[0] // p
  });

  // Detalles de la integración seleccionada desde el cuadro
  const detallesIntegracionSeleccionada = useMemo(() => {
    return obtenerDetallesIntegracion(formulario.integracion);
  }, [formulario.integracion]);

  // Chequear estado de la cuenta de servicio y cargar datos
  const verificarYCargar = async () => {
    try {
      const status = await verificarEstadoCuentaServicio();
      setEstadoCredenciales(status);
    } catch (e) {
      console.warn("No se pudo verificar estado de credenciales:", e);
    }
    await cargarCasosGoogleSheets();
  };

  const cargarCasosGoogleSheets = async (silencioso = false) => {
    if (!silencioso) setCargandoSheets(true);
    else setSincronizandoAuto(true);
    try {
      const data = await consultarCasosGoogleSheets();
      if (Array.isArray(data) && data.length > 0) {
        setCasosSheets(data);
        setUltimaSync(new Date());
        const activos = data.filter(c => c.esActivo).length;
        if (!silencioso) {
          mostrarNotificacion(`Sincronizado: ${data.length} casos totales (${activos} activos)`, "success");
        }
      }
    } catch (err) {
      console.warn("No se pudo cargar data de Google Sheets:", err);
      if (!silencioso) {
        mostrarNotificacion("Aviso: Sincronizando data en memoria", "info");
      }
    } finally {
      if (!silencioso) setCargandoSheets(false);
      else setSincronizandoAuto(false);
    }
  };

  useEffect(() => {
    verificarYCargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronización automática periódica cada 30 segundos
  useEffect(() => {
    const INTERVALO_30_SEG = 30000;
    const interval = setInterval(() => {
      cargarCasosGoogleSheets(true);
    }, INTERVALO_30_SEG);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Suscripción reactiva a Firestore en tiempo real para todos los casos
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const casosRef = collection(db, "casos");
      unsubscribe = onSnapshot(casosRef, (snapshot) => {
        const nuevosCasos = snapshot.docs.map(docSnap => ({ 
          id: docSnap.id, 
          origen: "Firebase (Tiempo Real)",
          ...docSnap.data() 
        }));
        if (nuevosCasos.length > casosFirestore.length && casosFirestore.length > 0 && audioRef.current) {
          audioRef.current.play().catch(() => {});
        }
        setCasosFirestore(nuevosCasos);
      }, (err) => {
        console.warn("Firestore subscription warning:", err);
      });
    } catch (err) {
      console.warn("Firestore error:", err);
    }
    return () => unsubscribe();
  }, [casosFirestore.length]);

  // Sincronización continua en segundo plano para múltiples agentes y supervisores en simultáneo
  useEffect(() => {
    let ultimoTimestamp = 0;
    const chequearCambiosSimultaneos = async () => {
      try {
        const res = await fetch('/api/sheets/sync-status');
        if (res.ok) {
          const data = await res.json();
          if (data.ultimoCambioTimestamp && data.ultimoCambioTimestamp > ultimoTimestamp) {
            if (ultimoTimestamp > 0) {
              // Silenciosamente refrescar lista de casos sin interrumpir inputs
              const nuevosCasos = await consultarCasosGoogleSheets();
              if (Array.isArray(nuevosCasos) && nuevosCasos.length > 0) {
                setCasosSheets(nuevosCasos);
              }
            }
            ultimoTimestamp = data.ultimoCambioTimestamp;
          }
        }
      } catch {
        // Ignorar errores transitorios de polling
      }
    };

    const interval = setInterval(chequearCambiosSimultaneos, 6000);
    return () => clearInterval(interval);
  }, []);

  // Helper para saber si un caso es activo y está realmente en progreso
  const esCasoActivo = (c) => {
    const est = String(c.estado || '').toLowerCase().trim();
    const etap = String(c.etapa || '').toLowerCase().trim();
    
    // Descartar cerrados, fallidos o finalizados
    if (est.includes('cerrado') || est.includes('fallido') || est.includes('cancelado') || est.includes('resuelto')) return false;
    if (etap.includes('cerrado') || etap.includes('fallido') || etap.includes('pedido de prueba realizado')) return false;

    // Si viene booleano esActivo explícito y no es una fecha corrupta
    if (typeof c.esActivo === 'boolean') {
      // Si el estado es una fecha corrupta (GMT...), revisar si esActivo fue puesto en true
      if (est.includes('gmt') || est.includes('hora estándar')) {
        // En los casos con fecha corrupta, sólo considerar activos si no son cerrados
        return c.esActivo && !est.includes('cerrado') && !etap.includes('cerrado');
      }
      return c.esActivo;
    }

    // Si no tiene booleano, evaluar estados válidos en progreso
    return est.includes('en progreso') || est.includes('nuevo') || est.includes('ticket hc') || est.includes('abierto');
  };

  // Helper para formatear visualmente el estado y limpiar si vino como fecha
  const limpiarTextoEstado = (estado, etapa) => {
    const estStr = String(estado || '').trim();
    if (!estStr || estStr.includes('GMT') || estStr.includes('hora estándar') || estStr.includes('00:00:00')) {
      return etapa && !etapa.includes('GMT') ? etapa : 'En progreso';
    }
    return estStr;
  };

  // Casos unificados y filtrados para la vista actual
  const casosMostrados = useMemo(() => {
    // Mapa unificado evitando duplicados por casoOp
    const mapaCasos = new Map();
    casosSheets.forEach(c => mapaCasos.set(String(c.casoOp || c.id), c));
    casosFirestore.forEach(c => {
      const key = String(c.casoOp || c.id);
      if (!mapaCasos.has(key)) {
        mapaCasos.set(key, c);
      }
    });

    const listaUnificada = Array.from(mapaCasos.values());

    if (activeTab === 'global') {
      // Alertas Globales (Supervisor): Todos los casos activos del equipo (~43 casos)
      return listaUnificada.filter(esCasoActivo);
    }

    if (activeTab === 'inicio') {
      // Mis Casos: Casos activos asignados al agente seleccionado o autenticado
      if (agenteFiltro !== 'auto' && agenteFiltro !== 'todos') {
        return listaUnificada.filter(c => esCasoActivo(c) && isAgentMatch(c, agenteFiltro, agenteFiltro));
      }
      if (agenteFiltro === 'todos') {
        return listaUnificada.filter(esCasoActivo);
      }
      
      const misCasos = listaUnificada.filter(c => 
        esCasoActivo(c) && isAgentMatch(c, email, nombreUsuarioAutenticado)
      );

      // Si el rol es Supervisor o Jean Palomino, y no tiene casos asignados puntuales, mostrar activos del equipo
      const esSupervisor = role === 'Supervisor' || email?.includes('jean.palomino') || nombreUsuarioAutenticado === 'Jean Palomino';
      if (esSupervisor && misCasos.length === 0) {
        return listaUnificada.filter(esCasoActivo);
      }

      return misCasos;
    }

    return listaUnificada;
  }, [casosSheets, casosFirestore, activeTab, email, nombreUsuarioAutenticado, agenteFiltro, role]);

  // Motor de Búsqueda Híbrido: busca concurrentemente en Google Sheets y Firestore
  const manejarBusqueda = async () => {
    if (!busquedaId.trim()) return;
    setCargandoBusqueda(true);
    setHistorialBusqueda([]);
    
    try {
      const term = busquedaId.trim().toLowerCase();
      
      // 1. Búsqueda exhaustiva en todas las filas de Google Sheets (incluidos casos antiguos y cerrados)
      const resultadosSheets = casosSheets.filter(c => 
        String(c.vendor_id || c.vendorId || '').toLowerCase() === term ||
        String(c.casoOp || c.id || '').toLowerCase() === term ||
        String(c.tienda || '').toLowerCase().includes(term)
      );

      // 2. Búsqueda en Firestore
      let resultadosFirestore = [];
      try {
        const qString = query(collection(db, "casos"), where("vendor_id", "==", busquedaId.trim()));
        const qNumber = query(collection(db, "casos"), where("vendor_id", "==", Number(busquedaId.trim())));
        const [snapString, snapNumber] = await Promise.all([getDocs(qString), getDocs(qNumber)]);
        resultadosFirestore = [...snapString.docs, ...snapNumber.docs].map(docSnap => ({ 
          id: docSnap.id, 
          origen: "Firebase",
          ...docSnap.data() 
        }));
      } catch (errFirestore) {
        console.warn("Búsqueda en Firestore no disponible:", errFirestore);
      }

      // Unificar resultados
      const mapaResultados = new Map();
      resultadosSheets.forEach(r => mapaResultados.set(String(r.casoOp || r.id), r));
      resultadosFirestore.forEach(r => {
        const key = String(r.casoOp || r.id);
        if (!mapaResultados.has(key)) {
          mapaResultados.set(key, r);
        }
      });

      const todosResultados = Array.from(mapaResultados.values());
      setHistorialBusqueda(todosResultados);

      // Si el ID existe, autocompletar formulario con datos maestros de la tienda (b, c, d, e, f)
      if (todosResultados.length > 0) {
        const dataTienda = todosResultados[0];
        setFormulario(prev => ({
          ...prev,
          casoOp: '', // Limpio para que el agente ingrese la nueva OP
          vendorId: dataTienda.vendor_id || dataTienda.vendorId || busquedaId.trim(),
          tienda: dataTienda.tienda || '',
          pais: dataTienda.pais || prev.pais || 'Argentina',
          kam: dataTienda.kam || prev.kam,
          integracion: dataTienda.integracion || prev.integracion || 'Datalive',
          oportunidad: 'Franchise Extension',
          asset: 'Integración',
          propietarioOportunidad: nombreUsuarioAutenticado, // Automático con cuenta logueada
          propietarioTicket: dataTienda.propietarioTicket || dataTienda.agente || nombreUsuarioAutenticado,
          casoSeguimiento: '',
          tieneCasoInicio: 'Si',
          comentarios: '',
          estado: 'Nuevo',
          etapa: 'Validación del Onboarding',
          fechaCreacion: new Date().toISOString().split('T')[0]
        }));
        mostrarNotificacion(`Se encontraron ${todosResultados.length} antecedentes para ID ${busquedaId.trim()} (${dataTienda.tienda || 'Sin nombre'}). Datos de tienda b, c y d replicados. Haz clic en cualquier registro para ver el detalle flotante.`, "success");
      } else {
        // Si no existe ni un registro: habilitar creación limpia
        setFormulario(prev => ({
          ...prev,
          casoOp: '',
          vendorId: busquedaId.trim(),
          tienda: '',
          pais: 'Argentina',
          kam: '',
          integracion: 'Datalive',
          oportunidad: 'New Business',
          asset: 'Integración',
          propietarioOportunidad: nombreUsuarioAutenticado,
          propietarioTicket: nombreUsuarioAutenticado,
          casoSeguimiento: '',
          tieneCasoInicio: 'Si',
          comentarios: '',
          estado: 'Nuevo',
          etapa: 'Validación del Onboarding',
          fechaCreacion: new Date().toISOString().split('T')[0]
        }));
        mostrarNotificacion(`Sin antecedentes previos para ID ${busquedaId.trim()}. Habilitada creación limpia de nuevo caso.`, "info");
      }
    } catch (error) {
      console.error("Error en búsqueda:", error);
      mostrarNotificacion("Error al ejecutar búsqueda.", "error");
    }
    setCargandoBusqueda(false);
  };

  // Replicar datos de tienda desde la vista flotante al formulario de creación
  const alReplicarTienda = (datosTienda) => {
    setFormulario(prev => ({
      ...prev,
      casoOp: '',
      vendorId: datosTienda.vendorId || prev.vendorId,
      tienda: datosTienda.tienda || prev.tienda,
      pais: datosTienda.pais || prev.pais,
      kam: datosTienda.kam || prev.kam,
      integracion: datosTienda.integracion || prev.integracion,
      propietarioOportunidad: 'Jean Palomino'
    }));
    setActiveTab('nuevo');
    mostrarNotificacion(`Datos de tienda replicados: ${datosTienda.tienda} (ID: ${datosTienda.vendorId}). Ahora ingresa el N° de Caso OP.`);
  };

  // Actualizar un caso existente desde la vista flotante sin duplicar registro
  const manejarActualizarCasoDesdeModal = async (casoActualizado) => {
    try {
      const res = await actualizarCasoEnSheets(casoActualizado);
      if (res.success) {
        // Actualizar en el estado de casos de Google Sheets
        setCasosSheets(prev => {
          const idBuscado = String(casoActualizado.casoOp || casoActualizado.id).trim();
          const idx = prev.findIndex(c => String(c.casoOp || c.id).trim() === idBuscado);
          if (idx !== -1) {
            const copia = [...prev];
            copia[idx] = { ...copia[idx], ...casoActualizado };
            return copia;
          }
          return [casoActualizado, ...prev];
        });

        // Actualizar en historial de búsqueda
        setHistorialBusqueda(prev => prev.map(c => 
          String(c.casoOp || c.id).trim() === String(casoActualizado.casoOp || casoActualizado.id).trim()
            ? { ...c, ...casoActualizado }
            : c
        ));

        // Actualizar en caso seleccionado del modal
        setCasoSeleccionadoModal(casoActualizado);

        if (res.sheetsSincronizado) {
          mostrarNotificacion(`✅ Caso OP ${casoActualizado.casoOp || casoActualizado.id} actualizado y sincronizado en Google Sheets en vivo.`, "success");
        } else {
          mostrarNotificacion(`💾 Caso OP ${casoActualizado.casoOp || casoActualizado.id} guardado en la app. NOTA: No impactó en el archivo de Google Sheets porque la Web App no está conectada o requiere permisos corporativos.`, "warning");
        }
        return res;
      }
    } catch (err) {
      console.error("Error al actualizar caso:", err);
      mostrarNotificacion("Error al actualizar el registro.", "error");
    }
  };

  const manejarCambioFormulario = (e) => {
    const { name, value } = e.target;
    setFormulario(prev => ({ ...prev, [name]: value }));
  };

  const mostrarNotificacion = (texto, tipo = "success") => {
    setNotificacion({ texto, tipo });
    setTimeout(() => setNotificacion(null), 5000);
  };

  const GAS_WEBAPP_URL = import.meta.env.VITE_GAS_WEBAPP_URL || "";

  const guardarNuevoCaso = async () => {
    if (!formulario.casoOp) {
      mostrarNotificacion("El N° Caso OP (a) es obligatorio para guardar.", "error");
      return;
    }
    
    try {
      // Aplicar reglas de negocio automáticas
      const casoProcesado = procesarActualizacionCaso({}, {
        ...formulario,
        id: formulario.casoOp,
        vendor_id: formulario.vendorId,
        agente: formulario.propietarioTicket,
        sla_inicio: new Date().toISOString()
      });

      // 1. Guardar en backend (persistencia en cache y Google Sheets)
      const _resBackend = await actualizarCasoEnSheets(casoProcesado);

      // 2. Escritura Firestore opcional
      const casoRef = doc(db, "casos", formulario.casoOp);
      setDoc(casoRef, casoProcesado).catch(err => {
        console.warn("Aviso: Firestore offline:", err);
      });

      // 3. Web App Google Apps Script si está configurada (vía backend o cliente)
      const urlGas = obtenerGasUrl() || GAS_WEBAPP_URL;
      if (urlGas) {
        fetch(urlGas, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(casoProcesado)
        }).catch(err => {
          console.warn("Advertencia en sincronización secundaria con GAS:", err);
        });
      }

      // Actualizar estados reactivos locales
      setCasosSheets(prev => [casoProcesado, ...prev.filter(c => String(c.casoOp || c.id) !== String(formulario.casoOp))]);
      
      if (String(formulario.vendorId).trim() === String(busquedaId).trim()) {
        setHistorialBusqueda(prev => [casoProcesado, ...prev]);
      }

      mostrarNotificacion(`¡Caso OP ${formulario.casoOp} guardado y sincronizado exitosamente!`, "success");
      
      // Limpiar formulario para nuevo registro
      setFormulario(prev => ({
        ...prev,
        casoOp: '',
        comentarios: ''
      }));
    } catch (error) {
      console.error("Error al guardar:", error);
      mostrarNotificacion("Error al guardar el caso.", "error");
    }
  };

  const calcularSLA = (slaInicioStr) => {
    if (!slaInicioStr) return { texto: 'Sin SLA', badgeClass: 'bg-gray-800 text-gray-400 border-gray-700' };
    const inicio = new Date(slaInicioStr);
    if (isNaN(inicio.getTime())) return { texto: slaInicioStr, badgeClass: 'bg-gray-800 text-gray-400 border-gray-700' };
    const diffHoras = Math.floor((Date.now() - inicio.getTime()) / (1000 * 60 * 60));
    if (diffHoras < 24) {
      return { texto: `${diffHoras}h (En tiempo)`, badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800' };
    }
    if (diffHoras < 48) {
      return { texto: `${diffHoras}h (Por vencer)`, badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-800' };
    }
    return { texto: `${diffHoras}h (SLA Vencido)`, badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-800 animate-pulse' };
  };

  // Estados para el modal de conexión
  const [tipoConexionModal, setTipoConexionModal] = useState('firebase'); // 'firebase' | 'gas' | 'csv' | 'codigo' | 'sa'
  const [gasUrlInput, setGasUrlInput] = useState(obtenerGasUrl());
  const [probandoGas, setProbandoGas] = useState(false);
  const [resultadoTestGas, setResultadoTestGas] = useState(null);
  const [csvTextInput, setCsvTextInput] = useState('');
  const [procesandoCsv, setProcesandoCsv] = useState(false);
  const [codigoCopiado, setCodigoCopiado] = useState(false);
  const [codigoFirebaseCopiado, setCodigoFirebaseCopiado] = useState(false);
  const [subiendoAFirebase, setSubiendoAFirebase] = useState(false);

  // Subir casos a Firebase Firestore
  const manejarSubirCasosAFirebase = async (casosAEnviar = null) => {
    const casos = casosAEnviar || (casosSheets.length > 0 ? casosSheets : casosMostrados);
    if (!casos || casos.length === 0) {
      mostrarNotificacion("No hay casos cargados para sincronizar con Firebase.", "error");
      return;
    }

    setSubiendoAFirebase(true);
    try {
      const res = await guardarCasosEnFirestore(casos);
      mostrarNotificacion(`🔥 ¡Éxito! Se sincronizaron ${res.total} casos directamente en Firebase Firestore.`, "success");
      setMostrarModalCreds(false);
    } catch (err) {
      mostrarNotificacion(`Error al sincronizar con Firebase: ${err.message}`, "error");
    } finally {
      setSubiendoAFirebase(false);
    }
  };

  // Probar y conectar Google Apps Script en tiempo real
  const manejarTestGas = async () => {
    if (!gasUrlInput.trim()) {
      mostrarNotificacion("Ingresa la URL de tu Google Apps Script.", "error");
      return;
    }
    setProbandoGas(true);
    setResultadoTestGas(null);
    try {
      const data = await probarConexionGas(gasUrlInput.trim());
      guardarGasUrl(gasUrlInput.trim());
      const totalFilas = data.total || data.casos?.length || 0;
      setResultadoTestGas({ success: true, count: totalFilas });
      mostrarNotificacion(`¡Conexión exitosa! Se detectaron ${totalFilas} casos en Onboarding_New.`, "success");
      setEstadoCredenciales(prev => ({ ...prev, configured: true }));
      await cargarCasosGoogleSheets();
    } catch (err) {
      setResultadoTestGas({ success: false, error: err.message });
      mostrarNotificacion(`Error: ${err.message}`, "error");
    } finally {
      setProbandoGas(false);
    }
  };

  const manejarGuardarGasUrl = async () => {
    guardarGasUrl(gasUrlInput);
    mostrarNotificacion("Enlace guardado. Sincronizando casos...", "success");
    await cargarCasosGoogleSheets();
    setMostrarModalCreds(false);
  };

  // Importar archivo CSV / TSV de Google Sheets
  const manejarImportarCsv = async (textoCSV = csvTextInput) => {
    if (!textoCSV.trim()) {
      mostrarNotificacion("Selecciona un archivo CSV o pega el contenido de la hoja.", "error");
      return;
    }
    setProcesandoCsv(true);
    try {
      const res = await importarCasosCSV(textoCSV, 'Archivo CSV');
      
      // Guardar también en Firebase Firestore en la nube
      if (Array.isArray(res.casos) && res.casos.length > 0) {
        guardarCasosEnFirestore(res.casos).catch(err => {
          console.warn("[Firebase] Error guardando batch en Firestore:", err);
        });
      }

      mostrarNotificacion(`¡Éxito! Se importaron ${res.total} casos y se sincronizaron con Firebase Firestore.`, "success");
      setMostrarModalCreds(false);
      setCsvTextInput('');
      setEstadoCredenciales(prev => ({ ...prev, configured: true }));
      await cargarCasosGoogleSheets();
    } catch (err) {
      mostrarNotificacion(`Error importando CSV: ${err.message}`, "error");
    } finally {
      setProcesandoCsv(false);
    }
  };

  const handleCsvFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setCsvTextInput(content);
        await manejarImportarCsv(content);
      }
    };
    reader.readAsText(file);
  };

  const copiarCodigoAppsScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
    setCodigoCopiado(true);
    mostrarNotificacion("¡Código copiado! Pégalo en Extensiones > Apps Script de tu Google Sheet.", "success");
    setTimeout(() => setCodigoCopiado(false), 3000);
  };

  // Subir o guardar service-account.json
  const manejarGuardarCredenciales = async () => {
    if (!jsonCredsInput.trim()) return;
    
    // Si el usuario pegó la tabla de integraciones u otro texto plano
    if (jsonCredsInput.includes('Integración,') || jsonCredsInput.includes('Contacto 01') || !jsonCredsInput.trim().startsWith('{')) {
      mostrarNotificacion("Has ingresado el cuadro de integraciones, no el archivo de credenciales de Google Cloud. El cuadro de integraciones ya está cargado en el sistema.", "error");
      return;
    }

    setGuardandoCreds(true);
    try {
      const parsed = JSON.parse(jsonCredsInput);
      const res = await guardarCuentaServicio(parsed);
      mostrarNotificacion(res.message || "service-account.json guardado con éxito.", "success");
      setMostrarModalCreds(false);
      setJsonCredsInput("");
      setEstadoCredenciales({ configured: true, email: parsed.client_email });
      await cargarCasosGoogleSheets();
    } catch (err) {
      mostrarNotificacion(`Error en credenciales: ${err.message}`, "error");
    } finally {
      setGuardandoCreds(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonCredsInput(event.target?.result || "");
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-screen bg-[#0f111a] text-gray-200 font-sans">
      <audio ref={audioRef} src="/ding.mp3" preload="auto" />

      {/* MODAL CONFIGURACIÓN CONEXIÓN GOOGLE SHEETS */}
      {mostrarModalCreds && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161925] border border-pink-700/60 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-600/20 text-pink-400 rounded-xl flex items-center justify-center font-bold text-xl border border-pink-500/30">
                  📊
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Sincronización con Google Sheets</h3>
                  <p className="text-xs text-gray-400">Hoja: Onboarding_New (PedidosYa) • Casos cargados: <span className="text-emerald-400 font-semibold">{casosSheets.length}</span></p>
                </div>
              </div>
              <button 
                onClick={() => setMostrarModalCreds(false)}
                className="text-gray-400 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-gray-800"
              >
                ✕
              </button>
            </div>

            {/* PESTAÑAS DE MÉTODO DE CONEXIÓN */}
            <div className="flex flex-wrap gap-2 border-b border-gray-800 mb-4 pb-2 shrink-0">
              <button
                onClick={() => setTipoConexionModal('firebase')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${tipoConexionModal === 'firebase' ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                🔥 1. Sheets ➔ Firebase (Sin Enlaces)
              </button>
              <button
                onClick={() => setTipoConexionModal('csv')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${tipoConexionModal === 'csv' ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                📥 2. Cargar CSV a Firebase
              </button>
              <button
                onClick={() => setTipoConexionModal('gas')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${tipoConexionModal === 'gas' ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                🔗 3. Enlace Web App / CSV
              </button>
              <button
                onClick={() => setTipoConexionModal('sa')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${tipoConexionModal === 'sa' ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                ⚙️ 4. Google Cloud JSON
              </button>
            </div>

            <div className="overflow-y-auto pr-1 flex-1">
              {tipoConexionModal === 'firebase' && (
                <div>
                  <div className="bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-gray-900 border border-pink-700/50 p-3.5 rounded-xl mb-3.5 text-xs">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-lg">🔥</span>
                      <p className="font-bold text-white text-sm">Sincronización Directa Google Sheets ➔ Firebase Firestore</p>
                    </div>
                    <p className="text-gray-300 leading-relaxed text-[11px]">
                      Al conectar Google Sheets directamente con Firebase, <strong>no necesitas poner enlaces web ni depender de dominios públicos</strong>. Tu hoja de cálculo de PedidosYa enviará los casos de forma desatendida a Firestore, y la app los recibirá al instante en tiempo real.
                    </p>
                  </div>

                  <div className="bg-[#0f111a] p-3 rounded-lg border border-gray-800 mb-3 space-y-2">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="text-pink-400 font-bold">Paso a paso (1 sola vez en tu Google Sheet):</span>
                    </h4>
                    <ol className="text-[11px] text-gray-300 list-decimal list-inside space-y-1 leading-relaxed">
                      <li>En tu Google Sheet (<strong>ONB 2026</strong>), ve al menú: <strong className="text-white">Extensiones &gt; Apps Script</strong>.</li>
                      <li>Borra todo el código que haya, pega el script de abajo y pulsa el botón de <strong>Guardar (💾)</strong>.</li>
                      <li>Recarga la pestaña de tu Google Sheet: verás arriba el nuevo menú: <strong className="text-pink-400">🚀 Firebase ONB &gt; ☁️ Sincronizar Casos a Firebase</strong>.</li>
                      <li>
                        <strong className="text-emerald-400">Para automatizarlo 100%:</strong> En el editor de Apps Script, haz clic en el icono del <strong>reloj (Activadores)</strong> en la barra izquierda &gt; <em>Añadir activador</em> &gt; Función: <code className="text-pink-400">sincronizarCasosAFirebase</code> &gt; Tipo: <em>Basado en tiempo</em> &gt; <em>Cada 5 minutos</em>.
                      </li>
                    </ol>
                  </div>

                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-gray-400">Script para Apps Script (REST API Oficial Firestore):</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generarScriptAppsScriptParaFirebase());
                        setCodigoFirebaseCopiado(true);
                        mostrarNotificacion("¡Script copiado! Pégalo en Extensiones > Apps Script.", "success");
                        setTimeout(() => setCodigoFirebaseCopiado(false), 3000);
                      }}
                      className="bg-pink-600 hover:bg-pink-700 text-white text-xs px-3.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 shadow"
                    >
                      {codigoFirebaseCopiado ? '✅ ¡Script Copiado!' : '📋 Copiar Script de Sincronización'}
                    </button>
                  </div>

                  <pre className="bg-[#0f111a] border border-gray-800 rounded-lg p-3 text-[11px] font-mono text-gray-300 max-h-48 overflow-y-auto select-all leading-normal mb-3">
                    {generarScriptAppsScriptParaFirebase()}
                  </pre>

                  <div className="bg-gray-900/80 p-3 rounded-lg border border-gray-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white">¿Quieres poblar Firebase ahora mismo desde esta app?</p>
                      <p className="text-[11px] text-gray-400">Sube los {casosSheets.length || casosMostrados.length} casos actuales a Firebase Firestore.</p>
                    </div>
                    <button
                      onClick={() => manejarSubirCasosAFirebase()}
                      disabled={subiendoAFirebase}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg text-xs transition flex items-center gap-1.5 shadow"
                    >
                      {subiendoAFirebase ? 'Subiendo a Firebase...' : '🔥 Sincronizar Casos a Firestore'}
                    </button>
                  </div>
                </div>
              )}
              {tipoConexionModal === 'gas' && (
                <div>
                  <p className="text-xs text-gray-300 mb-3 leading-relaxed">
                    Pega aquí la <strong>URL de tu Web App de Apps Script</strong> o el <strong>enlace de Publicar en la web (.csv)</strong> de tu Google Sheet. La app se conectará automáticamente cada 30 segundos.
                  </p>

                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      URL de sincronización (Apps Script o Google Sheets CSV):
                    </label>
                    <input
                      type="text"
                      value={gasUrlInput}
                      onChange={(e) => {
                        setGasUrlInput(e.target.value);
                        setResultadoTestGas(null);
                      }}
                      placeholder="https://script.google.com/macros/s/.../exec o https://docs.google.com/spreadsheets/..."
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-pink-500 font-mono"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Soporta Web Apps de Google Apps Script y enlaces de Google Sheets publicados en la web.
                    </p>
                  </div>

                  {/* RESULTADO DE LA PRUEBA */}
                  {resultadoTestGas && (
                    <div className={`p-3.5 rounded-xl border text-xs mb-4 ${resultadoTestGas.success ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300' : 'bg-rose-950/40 border-rose-700 text-rose-300'}`}>
                      {resultadoTestGas.success ? (
                        <div className="flex items-center gap-2">
                          <span className="text-base">✅</span>
                          <div>
                            <p className="font-semibold">¡Conexión establecida con éxito!</p>
                            <p className="text-[11px] text-emerald-400/90">Se encontraron {resultadoTestGas.count} casos en Onboarding. La app se actualizará automáticamente cada 30 segundos.</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold flex items-center gap-1.5"><span className="text-base">⚠️</span> Estado de la conexión:</p>
                          <p className="text-[11px] font-mono mt-1 text-rose-200">{resultadoTestGas.error}</p>
                          
                          <div className="mt-3 text-[11px] bg-gray-900/90 p-3.5 rounded-lg border border-gray-700 space-y-3">
                            <p className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                              💡 Cómo habilitar la sincronización 100% automática:
                            </p>

                            <div className="bg-emerald-950/40 border border-emerald-600/40 p-2.5 rounded-lg">
                              <p className="font-semibold text-emerald-300 mb-1">
                                Opción 1: Publicar en la web como CSV (Recomendado - 2 pasos, sin restricciones de TI):
                              </p>
                              <ol className="list-decimal pl-4 space-y-1 text-gray-300">
                                <li>En tu Google Sheet ve a: <strong>Archivo &gt; Compartir &gt; Publicar en la web</strong>.</li>
                                <li>Elige la hoja <strong>Onboarding</strong> y en formato selecciona <strong>Valores separados por comas (.csv)</strong>.</li>
                                <li>Haz clic en <strong>Publicar</strong>, copia ese enlace y pégalo arriba. ¡Se actualizará solo cada 30s!</li>
                              </ol>
                            </div>

                            <div className="bg-blue-950/40 border border-blue-600/40 p-2.5 rounded-lg">
                              <p className="font-semibold text-blue-300 mb-1">
                                Opción 2: Si usas la Web App de Apps Script:
                              </p>
                              <ol className="list-decimal pl-4 space-y-1 text-gray-300">
                                <li>En el editor de Apps Script ve al botón azul <strong>Implementar &gt; Gestionar implementaciones</strong>.</li>
                                <li>Haz clic en el <strong>Lápiz (Editar)</strong> de la implementación activa.</li>
                                <li>En <strong>"Quién tiene acceso"</strong> cambia de "PedidosYa" a <strong>"Cualquier usuario" (Anyone)</strong>.</li>
                                <li>Guarda e implementa.</li>
                              </ol>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                    <button 
                      type="button"
                      onClick={manejarTestGas}
                      disabled={probandoGas || !gasUrlInput.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-xs transition flex items-center gap-2"
                    >
                      {probandoGas ? '🔄 Verificando conexión...' : '⚡ Probar Conexión Ahora'}
                    </button>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setMostrarModalCreds(false)}
                        className="px-4 py-2 text-xs text-gray-400 hover:text-white transition"
                      >
                        Cerrar
                      </button>
                      <button 
                        onClick={manejarGuardarGasUrl}
                        className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-5 rounded-lg text-xs transition"
                      >
                        Guardar y Sincronizar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tipoConexionModal === 'csv' && (
                <div>
                  <div className="bg-emerald-950/30 border border-emerald-700/50 p-3 rounded-lg mb-4 text-xs text-emerald-300">
                    <p className="font-semibold mb-1">💡 Conexión Inmediata sin configuraciones complejas:</p>
                    <p className="text-gray-300 text-[11px]">
                      Abre tu Google Sheet &gt; Clic en <strong>Archivo &gt; Descargar &gt; Valores separados por comas (.csv)</strong> y suelta el archivo aquí abajo. Los 1,760+ casos quedarán guardados en el servidor al instante.
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-gray-700 hover:border-pink-500 rounded-xl p-5 text-center transition mb-4 bg-gray-900/40">
                    <span className="text-3xl block mb-2">📁</span>
                    <label className="cursor-pointer block text-xs font-semibold text-pink-400 hover:text-pink-300">
                      Selecciona o arrastra el archivo .csv descargado de tu Google Sheet
                      <input 
                        type="file" 
                        accept=".csv,.tsv,.txt"
                        onChange={handleCsvFileUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-gray-500 mt-1">Soporta .csv, .tsv exportado directamente desde Google Sheets</p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-400 mb-1">O pega filas copiadas de Google Sheets directamente:</label>
                    <textarea 
                      rows={4}
                      value={csvTextInput}
                      onChange={(e) => setCsvTextInput(e.target.value)}
                      placeholder="N° Caso OP,ID,Tienda,País,Kam,Integración...&#10;350844255,637914,Sushi Boom - Caballito,Argentina,..."
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2 text-xs font-mono text-gray-300 focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800">
                    <button 
                      onClick={() => setMostrarModalCreds(false)}
                      className="px-4 py-2 text-xs text-gray-400 hover:text-white transition"
                    >
                      Cerrar
                    </button>
                    <button 
                      onClick={() => manejarImportarCsv()}
                      disabled={procesandoCsv || !csvTextInput.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg text-xs transition flex items-center gap-2"
                    >
                      {procesandoCsv ? 'Procesando...' : '📥 Procesar e Importar Casos'}
                    </button>
                  </div>
                </div>
              )}

              {tipoConexionModal === 'codigo' && (
                <div>
                  <div className="bg-[#0f111a] p-3 rounded-lg border border-gray-800 mb-3">
                    <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                      <span className="text-pink-400">1.</span> Pasos para configurar el script en Google Sheets:
                    </h4>
                    <ol className="text-[11px] text-gray-300 list-decimal list-inside space-y-1.5 leading-relaxed">
                      <li>En tu archivo de Google Sheets, ve al menú superior: <strong className="text-white">Extensiones &gt; Apps Script</strong>.</li>
                      <li>Borra cualquier código anterior y pega el bloque que está abajo.</li>
                      <li>Haz clic en el botón azul <strong className="text-white">Implementar &gt; Nueva implementación</strong>.</li>
                      <li>En Tipo selecciona <strong className="text-white">Aplicación web</strong>.</li>
                      <li>En <em>"Quién tiene acceso"</em> selecciona: <strong className="text-emerald-400">Cualquier usuario (Anyone)</strong>.</li>
                      <li>Haz clic en <strong className="text-white">Implementar</strong>, copia la URL que termina en <code className="text-pink-400 font-mono">/exec</code> y pégala en la pestaña <strong>"1. Enlace Web App"</strong>.</li>
                    </ol>
                    <div className="mt-3 p-2 bg-amber-950/40 border border-amber-600/40 rounded text-[11px] text-amber-200/90 leading-relaxed">
                      <strong>⚠️ Importante para usuarios @pedidosya.com:</strong> Si tu organización restringe la opción "Cualquier usuario" a nivel de dominio, como ya diste acceso de editor a tu Gmail personal (<code className="text-white">jppd.e270498@gmail.com</code>), abre la hoja con esa cuenta personal y realiza la implementación desde allí. Las cuentas Gmail personales no tienen bloqueo corporativo.
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-gray-400">Código optimizado para Onboarding_New:</span>
                    <button
                      onClick={copiarCodigoAppsScript}
                      className="bg-pink-600 hover:bg-pink-700 text-white text-xs px-3 py-1 rounded font-semibold transition flex items-center gap-1"
                    >
                      {codigoCopiado ? '✅ ¡Copiado!' : '📋 Copiar Código'}
                    </button>
                  </div>

                  <pre className="bg-[#0f111a] border border-gray-800 rounded-lg p-3 text-[11px] font-mono text-gray-300 max-h-56 overflow-y-auto select-all leading-normal">
                    {APPS_SCRIPT_TEMPLATE}
                  </pre>
                </div>
              )}

              {tipoConexionModal === 'sa' && (
                <div>
                  <p className="text-xs text-gray-300 mb-3 leading-relaxed">
                    Esta opción es únicamente para el archivo de claves de Google Cloud (<code className="text-pink-400">peyatools2-f50f4f552cca.json</code>) descargado de GCP con permisos de Service Account.
                  </p>

                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Subir archivo .json de Google Cloud:</label>
                    <input 
                      type="file" 
                      accept=".json"
                      onChange={handleFileUpload}
                      className="w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-pink-600 file:text-white hover:file:bg-pink-700 cursor-pointer"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-400 mb-1">O contenido del JSON de GCP:</label>
                    <textarea 
                      rows={4}
                      value={jsonCredsInput}
                      onChange={(e) => setJsonCredsInput(e.target.value)}
                      placeholder='{ "type": "service_account", "project_id": "peyatools2", "private_key": "-----BEGIN PRIVATE KEY-----..." }'
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-xs font-mono text-gray-300 focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800">
                    <button 
                      onClick={() => setMostrarModalCreds(false)}
                      className="px-4 py-2 text-xs text-gray-400 hover:text-white transition"
                    >
                      Cerrar
                    </button>
                    <button 
                      onClick={manejarGuardarCredenciales}
                      disabled={guardandoCreds || !jsonCredsInput.trim()}
                      className="bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg text-xs transition flex items-center gap-2"
                    >
                      {guardandoCreds ? 'Validando...' : 'Guardar Llave GCP'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <div className="w-64 bg-[#161925] border-r border-gray-800 flex flex-col justify-between shrink-0">
        <div>
          <div className="p-6 flex items-center gap-3 border-b border-gray-800">
            <div className="w-9 h-9 bg-pink-600 rounded-lg flex items-center justify-center font-black text-white shadow-md">PY</div>
            <div>
              <h1 className="text-lg font-bold text-pink-500 leading-tight">PeYa ONB</h1>
              <p className="text-[11px] text-gray-400">PedidosYa Onboarding</p>
            </div>
          </div>
          <nav className="p-4 flex flex-col gap-2">
            {tieneAccesoSupervisor && (
              <button 
                onClick={() => setActiveTab('tl')} 
                className={`text-left px-4 py-2.5 rounded-lg flex items-center justify-between transition text-sm font-semibold ${activeTab === 'tl' ? 'bg-[#00e5ff] text-black shadow-lg shadow-cyan-500/20' : 'hover:bg-gray-800 text-cyan-300'}`}
              >
                <div className="flex items-center gap-2.5">
                  <span>📦</span>
                  <span>HeroCare TL</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${activeTab === 'tl' ? 'bg-black text-cyan-300' : 'bg-cyan-950 text-cyan-400 border border-cyan-800'}`}>
                  TL
                </span>
              </button>
            )}

            <button 
              onClick={() => setActiveTab('inicio')} 
              className={`text-left px-4 py-2.5 rounded-lg flex items-center gap-2.5 transition text-sm font-medium ${activeTab === 'inicio' ? 'bg-pink-600 text-white font-semibold' : 'hover:bg-gray-800 text-gray-300'}`}
            >
              <span>📁</span>
              <span>Mis Casos</span>
            </button>
            <button 
              onClick={() => setActiveTab('global')} 
              className={`text-left px-4 py-2.5 rounded-lg flex items-center gap-2.5 transition text-sm font-medium ${activeTab === 'global' ? 'bg-pink-600 text-white font-semibold' : 'hover:bg-gray-800 text-gray-300'}`}
            >
              <span>🌐</span>
              <span>Alertas Globales</span>
            </button>
            <button 
              onClick={() => setActiveTab('nuevo')} 
              className={`text-left px-4 py-2.5 rounded-lg flex items-center gap-2.5 transition text-sm font-medium ${activeTab === 'nuevo' ? 'bg-pink-600 text-white font-semibold' : 'hover:bg-gray-800 text-gray-300'}`}
            >
              <span>🔍</span>
              <span>{puedeRegistrar ? 'Consultar / Registrar' : 'Consultar / Historial'}</span>
            </button>
          </nav>
        </div>

        {/* User profile & Google Service status */}
        <div className="p-4 border-t border-gray-800 bg-[#12141e]">
          <div className="mb-3">
            <p className="text-xs text-gray-400 truncate">{email}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
              <p className="text-xs font-semibold text-pink-400">{role || 'Agente'}</p>
            </div>
          </div>

          <div className="mb-3 pt-2 border-t border-gray-800/80">
            <button 
              onClick={() => setMostrarModalCreds(true)}
              className="w-full text-left flex items-center justify-between text-[11px] p-2 rounded bg-gray-900/60 hover:bg-gray-800 border border-gray-800 transition group"
              title="Configurar conexión con Google Sheets (Web App o Archivo CSV)"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className={`w-2 h-2 rounded-full ${casosSheets.length > 0 ? 'bg-emerald-400 animate-pulse' : (estadoCredenciales.configured ? 'bg-cyan-400' : 'bg-amber-400')}`}></span>
                <span className="text-gray-300 truncate font-medium">
                  {casosSheets.length > 0 ? `Sheets (${casosSheets.length})` : 'Conectar Sheets'}
                </span>
              </div>
              <span className="text-gray-400 group-hover:text-white font-mono text-[10px]">⚙️</span>
            </button>
          </div>

          {onLogout && (
            <button 
              onClick={onLogout}
              className="w-full text-left px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition flex items-center gap-2"
            >
              <span>🚪</span>
              <span>Cerrar sesión</span>
            </button>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-auto p-6 lg:p-8">
        {/* Banner de Notificación */}
        {notificacion && (
          <div className={`mb-6 p-4 rounded-lg flex items-center justify-between text-sm ${notificacion.tipo === 'error' ? 'bg-red-950/80 border border-red-800 text-red-200' : 'bg-emerald-950/80 border border-emerald-800 text-emerald-200'}`}>
            <span>{notificacion.texto}</span>
            <button onClick={() => setNotificacion(null)} className="ml-4 text-xs font-bold opacity-75 hover:opacity-100">✕</button>
          </div>
        )}

        {/* TAB: HEROCARE TL (SUPERVISIÓN & ESCALAMIENTO) */}
        {activeTab === 'tl' && (
          <div className="max-w-7xl mx-auto">
            <HeroCareTLView 
              casos={casosSheets}
              onSeleccionarCaso={(caso) => setCasoSeleccionadoModal(caso)}
              onActualizarCaso={manejarActualizarCasoDesdeModal}
              nombreUsuario={nombreUsuarioAutenticado}
              rolUsuario={role}
              mostrarNotificacion={mostrarNotificacion}
            />
          </div>
        )}

        {/* TAB: MIS CASOS / GLOBAL */}
        {(activeTab === 'inicio' || activeTab === 'global') && (
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span>{activeTab === 'global' ? '🌐' : '📁'}</span>
                  <span>{activeTab === 'global' ? 'Alertas Globales (Equipo)' : 'Mis Casos en Progreso'}</span>
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  {activeTab === 'global' 
                    ? `Monitoreo de todos los casos en progreso del equipo (${casosMostrados.length} activos)`
                    : `Casos en progreso filtrados por estado. Monitoreo y alertas para Push POS API, Push Catálogo y SLA.`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Selector de Agente para pruebas / supervisión */}
                <div className="flex items-center gap-2 bg-[#1a1d27] border border-gray-700 px-3 py-1.5 rounded-lg text-xs">
                  <span className="text-gray-400">Filtrar:</span>
                  <select 
                    value={agenteFiltro} 
                    onChange={(e) => setAgenteFiltro(e.target.value)}
                    className="bg-transparent text-white focus:outline-none cursor-pointer font-medium"
                  >
                    <optgroup label="— Vista General —" className="bg-[#161925] text-pink-400 font-semibold">
                      <option value="auto" className="bg-[#161925] text-white">Mi Cuenta ({nombreUsuarioAutenticado})</option>
                      <option value="todos" className="bg-[#161925] text-white">Todos los Activos ({casosSheets.filter(c => c.esActivo).length})</option>
                    </optgroup>
                    
                    <optgroup label="— Supervisores —" className="bg-[#161925] text-amber-400 font-semibold">
                      {SUPERVISORES.map(sup => (
                        <option key={sup.nombre} value={sup.nombre} className="bg-[#161925] text-white">
                          👑 {sup.nombre} (Supervisor)
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="— Agentes Operativos —" className="bg-[#161925] text-cyan-400 font-semibold">
                      {AGENTES_OPERATIVOS.map(ag => (
                        <option key={ag.nombre} value={ag.nombre} className="bg-[#161925] text-white">
                          👤 {ag.nombre} (Agente)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Indicador de Auto-sync en tiempo real cada 30 segundos */}
                <div 
                  className="hidden md:flex items-center gap-2 bg-[#121522] border border-gray-800 px-3 py-1.5 rounded-lg text-xs"
                  title="Sincronización automática en segundo plano cada 30 segundos"
                >
                  <span className={`w-2 h-2 rounded-full ${sincronizandoAuto || cargandoSheets ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`}></span>
                  <span className="text-gray-400">
                    Auto-sync <strong className="text-emerald-400 font-semibold">30s</strong>
                  </span>
                  {ultimaSync && (
                    <span className="text-[10px] text-gray-400 border-l border-gray-700/80 pl-2 font-mono">
                      {ultimaSync.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => cargarCasosGoogleSheets(false)}
                  disabled={cargandoSheets}
                  className="bg-[#1a1d27] hover:bg-gray-800 border border-gray-700 text-gray-300 font-medium py-2 px-3 rounded-lg transition text-xs flex items-center gap-2 disabled:opacity-50"
                  title="Forzar sincronización inmediata ahora"
                >
                  <span className={cargandoSheets || sincronizandoAuto ? 'animate-spin' : ''}>🔄</span>
                  <span className="hidden sm:inline">{cargandoSheets ? 'Sincronizando...' : 'Sincronizar'}</span>
                </button>

                <button 
                  onClick={() => setActiveTab('nuevo')}
                  className="bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 px-4 rounded-lg transition text-xs flex items-center gap-2 shadow-md shadow-pink-900/20"
                >
                  <span>+</span>
                  <span>Nuevo Caso</span>
                </button>
              </div>
            </div>

            {/* BARRA DE FILTROS DE ALERTAS (PUSH POS API, PUSH CATÁLOGO Y SLA) */}
            {(() => {
              const casosConAlertas = casosMostrados.map(c => ({
                caso: c,
                alertas: analizarAlertasCaso(c)
              }));

              const totalPos = casosConAlertas.filter(x => x.alertas.requierePushPos).length;
              const totalCat = casosConAlertas.filter(x => x.alertas.requierePushCat).length;
              const totalSla = casosConAlertas.filter(x => x.alertas.esVencido || x.alertas.esProximoVencer).length;

              const listaFiltrada = casosConAlertas.filter(x => {
                if (filtroMisCasos === 'pushPos') return x.alertas.requierePushPos;
                if (filtroMisCasos === 'pushCat') return x.alertas.requierePushCat;
                if (filtroMisCasos === 'sla') return x.alertas.esVencido || x.alertas.esProximoVencer;
                return true;
              });

              return (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <button
                      onClick={() => setFiltroMisCasos('todos')}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${filtroMisCasos === 'todos' ? 'bg-[#1e2333] border-pink-500 shadow-md' : 'bg-[#1a1d27] border-gray-800 hover:border-gray-700'}`}
                    >
                      <div>
                        <p className="text-[11px] text-gray-400">Todos en Progreso</p>
                        <p className="text-xl font-bold text-white mt-0.5">{casosMostrados.length}</p>
                      </div>
                      <span className="text-xl">📁</span>
                    </button>

                    <button
                      onClick={() => setFiltroMisCasos('pushPos')}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${filtroMisCasos === 'pushPos' ? 'bg-amber-950/60 border-amber-500 shadow-md' : 'bg-[#1a1d27] border-gray-800 hover:border-amber-700/50'}`}
                    >
                      <div>
                        <p className="text-[11px] text-amber-300 font-medium">Alerta Push POS API</p>
                        <p className="text-xl font-bold text-amber-400 mt-0.5">{totalPos}</p>
                      </div>
                      <span className="text-xl">🖥️</span>
                    </button>

                    <button
                      onClick={() => setFiltroMisCasos('pushCat')}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${filtroMisCasos === 'pushCat' ? 'bg-pink-950/60 border-pink-500 shadow-md' : 'bg-[#1a1d27] border-gray-800 hover:border-pink-700/50'}`}
                    >
                      <div>
                        <p className="text-[11px] text-pink-300 font-medium">Alerta Push Catálogo</p>
                        <p className="text-xl font-bold text-pink-400 mt-0.5">{totalCat}</p>
                      </div>
                      <span className="text-xl">📦</span>
                    </button>

                    <button
                      onClick={() => setFiltroMisCasos('sla')}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${filtroMisCasos === 'sla' ? 'bg-rose-950/60 border-rose-500 shadow-md' : 'bg-[#1a1d27] border-gray-800 hover:border-rose-700/50'}`}
                    >
                      <div>
                        <p className="text-[11px] text-rose-300 font-medium">Vencimiento SLA</p>
                        <p className="text-xl font-bold text-rose-400 mt-0.5">{totalSla}</p>
                      </div>
                      <span className="text-xl">🚨</span>
                    </button>
                  </div>

                  {listaFiltrada.length === 0 ? (
                    <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-12 text-center">
                      <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
                        {casosSheets.length === 0 ? '📊' : '✅'}
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {casosSheets.length === 0 
                          ? "Sin datos cargados de la hoja ONB 2026" 
                          : "Sin casos para el filtro seleccionado"}
                      </h3>
                      <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">
                        {casosSheets.length === 0
                          ? "Conecta la Web App de Apps Script con acceso 'Cualquier usuario' o arrastra el archivo CSV de tu Google Sheet para cargar los casos reales."
                          : (filtroMisCasos !== 'todos'
                            ? `No hay casos que requieran este tipo de alerta en este momento.`
                            : (agenteFiltro !== 'auto' && agenteFiltro !== 'todos'
                              ? `No hay casos activos asignados a ${agenteFiltro}.`
                              : "No tienes casos en progreso asignados actualmente."))
                        }
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        {casosSheets.length === 0 ? (
                          <>
                            <button 
                              onClick={cargarCasosGoogleSheets}
                              disabled={cargandoSheets}
                              className="bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition flex items-center gap-1.5"
                            >
                              <span>🔄</span>
                              <span>{cargandoSheets ? 'Sincronizando...' : 'Sincronizar Sheets'}</span>
                            </button>
                            <button 
                              onClick={() => {
                                setTipoConexionModal('csv');
                                setMostrarModalCreds(true);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition flex items-center gap-1.5"
                            >
                              <span>📥</span>
                              <span>Cargar / Pegar CSV de ONB 2026</span>
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => {
                              setFiltroMisCasos('todos');
                              setAgenteFiltro('todos');
                            }}
                            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-pink-400 text-xs font-semibold py-2 px-4 rounded-lg transition"
                          >
                            Ver todos los casos activos ({casosSheets.filter(c => c.esActivo).length})
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#1a1d27] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                      <div className="p-3.5 bg-[#12141e] border-b border-gray-800 flex items-center justify-between text-xs text-gray-400">
                        <span>Mostrando <strong>{listaFiltrada.length}</strong> casos en progreso. Haz clic en cualquier fila para abrir la <strong>vista flotante</strong> y editar el caso.</span>
                        <span className="font-mono text-[11px] text-pink-400">Click = Abrir Detalle</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-[#12141e] text-xs uppercase text-gray-400 border-b border-gray-800">
                            <tr>
                              <th className="py-3 px-4 font-semibold">N° Caso OP</th>
                              <th className="py-3 px-4 font-semibold">Tienda / Vendor ID</th>
                              <th className="py-3 px-4 font-semibold">País / KAM</th>
                              <th className="py-3 px-4 font-semibold">Integración</th>
                              <th className="py-3 px-4 font-semibold">Estado / Etapa</th>
                              <th className="py-3 px-4 font-semibold">Push POS API</th>
                              <th className="py-3 px-4 font-semibold">Push Catálogo</th>
                              <th className="py-3 px-4 font-semibold">SLA</th>
                              <th className="py-3 px-4 font-semibold">Propietario</th>
                              <th className="py-3 px-4 font-semibold text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {listaFiltrada.map(({ caso: c, alertas }) => {
                              const sla = calcularSLA(c.sla_inicio);
                              return (
                                <tr 
                                  key={c.id || c.casoOp} 
                                  onClick={() => setCasoSeleccionadoModal(c)}
                                  className="hover:bg-[#202538] transition cursor-pointer group"
                                  title="Haz clic para ver y editar el caso en la vista flotante"
                                >
                                  {/* a. N° Caso OP */}
                                  <td className="py-3.5 px-4 font-mono font-bold text-pink-400 group-hover:text-pink-300">
                                    <div className="flex items-center gap-1.5">
                                      <span>{c.casoOp || c.id}</span>
                                    </div>
                                  </td>

                                  {/* b & c. Tienda y Vendor ID */}
                                  <td className="py-3.5 px-4">
                                    <p className="text-white font-semibold text-xs leading-tight">{c.tienda || 'Sin especificar'}</p>
                                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">ID: {c.vendor_id || c.vendorId || 'N/A'}</p>
                                  </td>

                                  {/* d & e. País y KAM */}
                                  <td className="py-3.5 px-4 text-xs">
                                    <p className="text-gray-200">{c.pais || 'N/A'}</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">KAM: {c.kam || 'N/A'}</p>
                                  </td>

                                  {/* f. Integración */}
                                  <td className="py-3.5 px-4">
                                    <span className="bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-300 border border-gray-700">
                                      {c.integracion || 'N/A'}
                                    </span>
                                  </td>

                                  {/* n & o. Estado y Etapa */}
                                  <td className="py-3.5 px-4 text-xs">
                                    <span className="text-cyan-400 font-medium block">{limpiarTextoEstado(c.estado, c.etapa)}</span>
                                    <span className="text-gray-400 text-[11px] mt-0.5 block truncate max-w-[130px]">{c.etapa && !c.etapa.includes('GMT') ? c.etapa : 'Validación del Onboarding'}</span>
                                  </td>

                                  {/* Push POS API */}
                                  <td className="py-3.5 px-4">
                                    {alertas.requierePushPos ? (
                                      <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[11px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1">
                                        <span>⚠️</span> Push Requerido
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-[11px] bg-gray-800/60 px-2 py-0.5 rounded border border-gray-700">
                                        {c.respuestaPos || 'Al día'}
                                      </span>
                                    )}
                                  </td>

                                  {/* Push Catálogo */}
                                  <td className="py-3.5 px-4">
                                    {alertas.requierePushCat ? (
                                      <span className="bg-pink-950 text-pink-300 border border-pink-800 text-[11px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1">
                                        <span>📦</span> Push Catálogo
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-[11px] bg-gray-800/60 px-2 py-0.5 rounded border border-gray-700">
                                        {c.respuestaCat || 'Al día'}
                                      </span>
                                    )}
                                  </td>

                                  {/* SLA */}
                                  <td className="py-3.5 px-4">
                                    {alertas.estaCongelado ? (
                                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium border bg-indigo-950/80 text-indigo-300 border-indigo-700">
                                        ❄️ Pausado
                                      </span>
                                    ) : (
                                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${sla.badgeClass}`}>
                                        {sla.texto}
                                      </span>
                                    )}
                                  </td>

                                  {/* Propietario Oportunidad / Ticket */}
                                  <td className="py-3.5 px-4 text-xs text-gray-300">
                                    <p className="font-medium text-white">{c.propietarioOportunidad || c.agente || 'Sin asignar'}</p>
                                    <p className="text-[10px] text-gray-500">HC: {c.propietarioTicket || 'Auto'}</p>
                                  </td>

                                  {/* Acción */}
                                  <td className="py-3.5 px-4 text-right">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCasoSeleccionadoModal(c);
                                      }}
                                      className="bg-gray-800 hover:bg-pink-600 text-pink-400 hover:text-white px-2.5 py-1 rounded text-xs transition border border-gray-700"
                                    >
                                      Gestionar
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB: NUEVO / CONSULTAR */}
        {activeTab === 'nuevo' && (
          <div className="max-w-7xl mx-auto">
            
            {casosSheets.length === 0 && (
              <div className="bg-amber-950/50 border border-amber-600/60 rounded-xl p-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">⚠️</span>
                  <div>
                    <p className="font-bold text-amber-200 text-sm">Google Sheets no está sincronizado aún (0 registros cargados)</p>
                    <p className="text-gray-300 text-xs mt-1 leading-relaxed">
                      Para que al buscar IDs como <strong className="text-white bg-black/40 px-1 py-0.5 rounded font-mono">637914</strong> (Sushi Boom) o <strong className="text-white bg-black/40 px-1 py-0.5 rounded font-mono">637917</strong> se muestren los antecedentes y se autocompleten tienda, KAM y país, conecta tu Web App de Apps Script o sube el CSV de la hoja.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setMostrarModalCreds(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2.5 rounded-lg transition shrink-0 flex items-center justify-center gap-1.5 shadow"
                >
                  <span>⚙️</span>
                  <span>Conectar Sheets Ahora</span>
                </button>
              </div>
            )}

            <div className="bg-[#1a1d27] p-4 rounded-xl border border-gray-800 flex flex-col sm:flex-row gap-3 mb-6">
              <input 
                type="text" 
                value={busquedaId}
                onChange={(e) => setBusquedaId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && manejarBusqueda()}
                placeholder="Ingrese VendorID (ej. 640525, 637917) y presione Enter..." 
                className="flex-1 bg-[#0f111a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-pink-500 font-mono" 
              />
              <button 
                onClick={manejarBusqueda} 
                disabled={cargandoBusqueda} 
                className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-8 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>🔍</span>
                <span>{cargandoBusqueda ? 'Buscando...' : 'Consultar Historial'}</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* HISTORIAL PREVIO */}
              <div className="xl:col-span-1 bg-[#1a1d27] p-6 rounded-xl border border-gray-800 max-h-[850px] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-gray-700 pb-2 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Historial Previo</h3>
                    <p className="text-[11px] text-gray-400">Click en cualquier tarjeta para abrir la vista flotante</p>
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-800 px-2.5 py-1 rounded font-mono border border-gray-700">
                    {historialBusqueda.length} encontrados
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {historialBusqueda.length === 0 ? (
                    <div className="text-sm text-gray-500 py-10 text-center bg-[#0f111a] rounded-xl border border-dashed border-gray-800 p-6">
                      <div className="text-2xl mb-2">🔍</div>
                      <p className="font-semibold text-gray-400">Sin registros previos consultados</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Ingresa un VendorID en el buscador superior para ver antecedentes de la tienda o crear un nuevo caso.
                      </p>
                    </div>
                  ) : (
                    historialBusqueda.map((caso) => (
                      <div 
                        key={caso.id || caso.casoOp} 
                        onClick={() => setCasoSeleccionadoModal(caso)}
                        className="bg-[#0f111a] hover:bg-[#151824] p-4 rounded-xl border border-gray-800 hover:border-pink-500/60 transition cursor-pointer group shadow-md"
                        title="Haz clic para ver el caso en la vista flotante"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-sm text-pink-400 font-mono group-hover:text-pink-300">
                            OP: {caso.casoOp || caso.id}
                          </p>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-pink-950/60 text-pink-300 border border-pink-800 group-hover:bg-pink-600 group-hover:text-white transition font-medium">
                            🔍 Abrir Detalle
                          </span>
                        </div>
                        
                        <p className="text-sm text-white font-semibold mt-1.5">{caso.tienda || 'Sin especificar'}</p>
                        
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                          <span>Vendor ID: <strong className="text-gray-200 font-mono">{caso.vendor_id || caso.vendorId}</strong></span>
                          <span>•</span>
                          <span>{caso.pais || 'N/A'}</span>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex items-center justify-between text-xs">
                          <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                            String(caso.estado || '').toLowerCase().includes('cerrado') 
                              ? 'bg-emerald-950 text-emerald-300' 
                              : 'bg-cyan-950 text-cyan-300'
                          }`}>
                            {caso.estado || 'En progreso'}
                          </span>
                          <span className="text-gray-400 text-[11px] truncate max-w-[150px]">
                            {caso.etapa || 'Validación'}
                          </span>
                        </div>

                        <div className="mt-2 text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                          <span>KAM: <strong className="text-gray-400">{caso.kam || 'N/A'}</strong></span>
                          <span>Agente: <strong className="text-gray-400">{caso.propietarioOportunidad || caso.agente || 'N/A'}</strong></span>
                        </div>

                        {caso.comentarios && (
                          <div className="mt-2.5 p-2 bg-black/40 rounded border border-gray-800 text-[11px] text-gray-400 italic line-clamp-2">
                            &quot;{caso.comentarios}&quot;
                          </div>
                        )}

                        <div className="mt-3 pt-2 border-t border-gray-800/60 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              alReplicarTienda({
                                vendorId: caso.vendor_id || caso.vendorId,
                                tienda: caso.tienda,
                                pais: caso.pais,
                                kam: caso.kam,
                                integracion: caso.integracion
                              });
                            }}
                            className="text-[11px] text-gray-400 hover:text-pink-400 flex items-center gap-1 transition"
                          >
                            <span>➕</span>
                            <span>Replicar Tienda a Formulario</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* FORMULARIO NUEVO CASO (Campos 1.a a 1.p exactos) */}
              <div className="xl:col-span-2 bg-[#1a1d27] p-6 rounded-xl border border-pink-900/50 shadow-xl">
                <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">Crear / Registrar Caso Onboarding</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Completa los datos maestros según el formato estándar (a - p).
                    </p>
                  </div>
                  <span className="text-xs bg-pink-950/80 text-pink-300 border border-pink-800 px-3 py-1 rounded-full font-medium">
                    Campos a - p
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  
                  {/* a. N° Caso OP */}
                  <div>
                    <label className="text-gray-300 mb-1 block font-medium">a. N° Caso OP *</label>
                    <input 
                      name="casoOp" 
                      value={formulario.casoOp} 
                      onChange={manejarCambioFormulario} 
                      placeholder="Ej. 17627448"
                      type="text" 
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 font-mono text-sm font-semibold" 
                    />
                  </div>

                  {/* b. ID (Vendor ID) */}
                  <div>
                    <label className="text-gray-300 mb-1 block font-medium">b. ID (Vendor ID) *</label>
                    <input 
                      name="vendorId" 
                      value={formulario.vendorId} 
                      onChange={manejarCambioFormulario} 
                      placeholder="Ej. 640525"
                      type="text" 
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white font-mono text-sm" 
                    />
                  </div>

                  {/* c. Tienda */}
                  <div className="sm:col-span-2">
                    <label className="text-gray-300 mb-1 block font-medium">c. Tienda *</label>
                    <input 
                      name="tienda" 
                      value={formulario.tienda} 
                      onChange={manejarCambioFormulario} 
                      placeholder="Nombre del local o cadena"
                      type="text" 
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 font-medium" 
                    />
                  </div>
                  
                  {/* d. País */}
                  <div>
                    <label className="text-gray-300 mb-1 block font-medium">d. País *</label>
                    <select 
                      name="pais" 
                      value={formulario.pais} 
                      onChange={manejarCambioFormulario} 
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500"
                    >
                      <option value="">Seleccione país...</option>
                      {LISTA_PAISES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* e. KAM */}
                  <div>
                    <label className="text-gray-300 mb-1 block font-medium">e. KAM</label>
                    <input 
                      name="kam" 
                      value={formulario.kam} 
                      onChange={manejarCambioFormulario} 
                      placeholder="Nombre del KAM asignado"
                      type="text" 
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500" 
                    />
                  </div>
                  
                  {/* f. Integración */}
                  <div>
                    <label className="text-gray-300 mb-1 block font-medium">f. Integración *</label>
                    <select 
                      name="integracion" 
                      value={formulario.integracion} 
                      onChange={manejarCambioFormulario} 
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500"
                    >
                      <option value="">Seleccione integración...</option>
                      {LISTA_INTEGRACIONES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>

                  {/* g. Oportunidad */}
                  <div>
                    <label className="text-gray-300 mb-1 block font-medium">g. Oportunidad</label>
                    <select 
                      name="oportunidad" 
                      value={formulario.oportunidad} 
                      onChange={manejarCambioFormulario} 
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500"
                    >
                      {LISTA_OPORTUNIDADES.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </div>

                  {/* Panel informativo de contactos del cuadro */}
                  {detallesIntegracionSeleccionada && (
                    <div className="sm:col-span-2 bg-[#0f111a] border border-gray-800 p-3 rounded-lg text-xs">
                      <p className="text-pink-400 font-semibold mb-1">
                        Contactos del cuadro para {detallesIntegracionSeleccionada.integracion}:
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {detallesIntegracionSeleccionada.contactos.map((ct, idx) => (
                          <span key={idx} className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-700 font-mono text-[11px]">
                            {ct}
                          </span>
                        ))}
                      </div>
                      {detallesIntegracionSeleccionada.correoAgente && (
                        <p className="text-gray-400 mt-2 text-[11px]">
                          Responsable sugerido: <span className="text-cyan-400">{detallesIntegracionSeleccionada.correoAgente}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* h. Asset */}
                  <div>
                    <label className="text-gray-300 mb-1 block font-medium">h. Asset *</label>
                    <select 
                      name="asset" 
                      value={formulario.asset} 
                      onChange={manejarCambioFormulario} 
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500"
                    >
                      {LISTA_ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>

                  {/* i. Propietario Oportunidad */}
                  <div>
                    <label className="text-pink-400 mb-1 block font-semibold flex items-center justify-between">
                      <span>i. Propietario Oportunidad</span>
                      <span className="text-[10px] text-gray-400 font-normal">Editable por otro agente</span>
                    </label>
                    <select 
                      name="propietarioOportunidad" 
                      value={formulario.propietarioOportunidad} 
                      onChange={manejarCambioFormulario} 
                      className="w-full bg-[#0f111a] border border-pink-700/60 rounded-lg p-2.5 text-white font-medium focus:border-pink-500"
                    >
                      {LISTA_AGENTES.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                    </select>
                  </div>

                  {/* j. Propietario Ticket HeroCare */}
                  <div>
                    <label className="text-gray-400 mb-1 block font-medium">j. Propietario Ticket HeroCare (Fijo)</label>
                    <input 
                      value={formulario.propietarioTicket} 
                      disabled 
                      type="text" 
                      className="w-full bg-[#0f111a] border border-gray-800 text-gray-400 rounded-lg p-2.5 cursor-not-allowed font-medium" 
                    />
                  </div>

                  {/* k. N° Caso Seguimiento */}
                  <div>
                    <label className="text-gray-300 mb-1 block font-medium">k. N° Caso Seguimiento</label>
                    <input 
                      name="casoSeguimiento" 
                      value={formulario.casoSeguimiento} 
                      onChange={manejarCambioFormulario} 
                      placeholder="Ej. 17627449"
                      type="text" 
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 font-mono" 
                    />
                  </div>

                  {/* l. ¿Tiene caso de onboarding en el inicio? */}
                  <div>
                    <label className="text-gray-300 mb-1 block font-medium">l. ¿Tiene caso de onboarding en inicio?</label>
                    <select 
                      name="tieneCasoInicio" 
                      value={formulario.tieneCasoInicio} 
                      onChange={manejarCambioFormulario} 
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white"
                    >
                      <option value="Si">Si</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  {/* p. Fecha de creación de la OP */}
                  <div>
                    <label className="text-gray-300 mb-1 block font-medium">p. Fecha de creación de la OP</label>
                    <input 
                      name="fechaCreacion" 
                      type="date" 
                      value={formulario.fechaCreacion} 
                      onChange={manejarCambioFormulario} 
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white" 
                    />
                  </div>

                  {/* n. Estado del caso */}
                  <div>
                    <label className="text-cyan-400 mb-1 block font-semibold">n. Estado del caso</label>
                    <select 
                      name="estado" 
                      value={formulario.estado} 
                      onChange={manejarCambioFormulario} 
                      className="w-full bg-[#0f111a] border border-cyan-700 rounded-lg p-2.5 text-cyan-300 font-bold"
                    >
                      {LISTA_ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>

                  {/* o. Etapa del onboarding */}
                  <div>
                    <label className="text-cyan-400 mb-1 block font-semibold">o. Etapa del onboarding</label>
                    <select 
                      name="etapa" 
                      value={formulario.etapa} 
                      onChange={manejarCambioFormulario} 
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white"
                    >
                      {LISTA_ETAPAS.map(et => <option key={et} value={et}>{et}</option>)}
                    </select>
                  </div>
                  
                  {/* m. Comentarios del Onboarding */}
                  <div className="sm:col-span-2">
                    <label className="text-gray-300 mb-1 block font-medium">m. Comentarios del Onboarding</label>
                    <textarea 
                      name="comentarios" 
                      value={formulario.comentarios} 
                      onChange={manejarCambioFormulario} 
                      rows={3} 
                      placeholder="Notas de avance, comentarios del agente..."
                      className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 text-xs"
                    ></textarea>
                  </div>
                </div>

                {!puedeRegistrar && (
                  <div className="bg-amber-950/40 border border-amber-500/50 text-amber-300 p-3.5 rounded-xl text-xs mt-6 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>Modo Supervisión: El registro de nuevos casos está reservado para usuarios con rol <strong>Agente</strong> o <strong>Agente / Supervisor</strong>. Como Supervisor puedes consultar el historial y monitorear escalamientos desde HeroCare TL.</span>
                  </div>
                )}

                <button 
                  onClick={guardarNuevoCaso} 
                  disabled={!puedeRegistrar}
                  className={`w-full font-bold py-3.5 rounded-lg mt-4 transition shadow-lg text-sm flex items-center justify-center gap-2 ${
                    puedeRegistrar 
                      ? 'bg-pink-600 hover:bg-pink-700 text-white shadow-pink-900/20' 
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                  }`}
                >
                  <span>💾</span>
                  <span>{puedeRegistrar ? 'Guardar Caso en Google Sheets y Base de Datos' : 'Registro de Casos reservado para Agentes'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VISTA FLOTANTE (MODAL DETALLE DE CASO PARA CONSULTA Y ACTUALIZACIÓN EN GOOGLE SHEETS) */}
      {casoSeleccionadoModal && (
        <ModalDetalleCaso 
          caso={casoSeleccionadoModal}
          alCerrar={() => setCasoSeleccionadoModal(null)}
          alActualizar={manejarActualizarCasoDesdeModal}
          alReplicarTienda={alReplicarTienda}
          nombreUsuarioAutenticado={nombreUsuarioAutenticado}
        />
      )}
    </div>
  );
}
