import fs from 'fs';
import path from 'path';
import { JWT } from 'google-auth-library';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface CasoSheets {
  id: string;
  casoOp: string;
  vendorId: string;
  vendor_id: string;
  tienda: string;
  pais: string;
  kam: string;
  integracion: string;
  oportunidad: string;
  asset: string;
  casoSeguimiento: string;
  propietarioOportunidad: string;
  propietarioTicket: string;
  agente: string;
  tieneCasoInicio: string;
  comentarios: string;
  fechaCreacion: string;
  estado: string;
  etapa: string;
  sla_inicio: string;
  esActivo: boolean;
  origen: string;
  filaNumero: number;
  rangoSlaOp?: string;
  rangoSla?: string;
  tiempoTranscurridoOp?: string;
  tiempoTranscurridoLV?: string;
  pushKamPos?: string | boolean;
  pushKamCat?: string | boolean;
  rangoSlaPos?: string;
  rangoSlaCat?: string;
  horasSLA?: number;
  fechaCierre?: string;
  fechaInicioPos?: string;
  fechaPushPos?: string;
  respuestaPos?: string;
  fechaInicioCat?: string;
  fechaPushCat?: string;
  respuestaCat?: string;
  tiempoTranscurridoPos?: string;
  tiempoTranscurridoCat?: string;
  fechaFreezePos?: string;
  fechaFreezeCat?: string;
  freezePos?: string;
  freezeCat?: string;
}

const SPREADSHEET_ID = process.env.VITE_GOOGLE_SHEET_ID || '1obGQuhQx0FcxdoHNYUMzGqOzLFalhA63W8ze1tygHkk';
const RANGO_HOJA = "'Onboarding_New'!A3:AZ";

const POSIBLES_RUTAS_CREDENTIALS = [
  path.resolve(process.cwd(), 'service-account.json'),
  path.resolve(process.cwd(), 'peyatools2-f50f4f552cca.json'),
  path.resolve(process.cwd(), 'credentials.json'),
  path.resolve(process.cwd(), 'backend/credentials.json')
];

const CACHE_FILE_PATH = path.resolve(process.cwd(), 'data_cached_casos.json');
const CATALOGOS_CACHE_FILE = path.resolve(process.cwd(), 'data_cached_catalogos.json');

export interface CatalogosSheet {
  integraciones: { nombre: string; sponsorship: string }[];
  paises: string[];
  oportunidades: string[];
  assets: string[];
  agentes: string[];
  estados: string[];
  etapas: string[];
}

export class SheetsService {
  private jwtClient: JWT | null = null;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;
  private serviceAccountPath: string | null = null;
  private cachedCredsObj: { client_email: string; private_key: string } | null = null;
  private cachedCasosMemoria: CasoSheets[] = [];
  private ultimoCambioTimestamp: number = Date.now();

  constructor() {
    this.detectarCredenciales();
    this.cargarCasosCache();
  }

  public obtenerUltimoCambio(): number {
    return this.ultimoCambioTimestamp;
  }

  public obtenerTotal(): number {
    return this.cachedCasosMemoria.length;
  }

  private cargarCasosCache(): void {
    try {
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.cachedCasosMemoria = parsed;
          console.log(`[SheetsService] Cargados ${parsed.length} casos desde cache local.`);
        }
      }
    } catch (e) {
      console.warn('[SheetsService] Error leyendo cache local:', e);
    }
  }

  public guardarCasosCache(casos: CasoSheets[]): void {
    try {
      this.cachedCasosMemoria = casos;
      this.ultimoCambioTimestamp = Date.now();
      const targetPath = process.env.VERCEL ? path.join('/tmp', 'data_cached_casos.json') : CACHE_FILE_PATH;
      fs.writeFileSync(targetPath, JSON.stringify(casos, null, 2), 'utf-8');
      console.log(`[SheetsService] Guardados ${casos.length} casos en cache (${targetPath})`);
    } catch (e) {
      console.warn('[SheetsService] Error guardando cache local (ignorado en serverless):', e);
    }
  }

  public getCasosEnMemoria(): CasoSheets[] {
    return this.cachedCasosMemoria;
  }

  public detectarCredenciales(): string | null {
    for (const ruta of POSIBLES_RUTAS_CREDENTIALS) {
      if (fs.existsSync(ruta)) {
        try {
          const raw = fs.readFileSync(ruta, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed.client_email && (parsed.private_key || parsed.privateKey)) {
            this.serviceAccountPath = ruta;
            this.jwtClient = null; // Reiniciar para recargar
            console.log(`[SheetsService] Credenciales válidas encontradas en: ${ruta}`);
            return ruta;
          }
        } catch (e) {
          console.warn(`[SheetsService] Error leyendo archivo en ${ruta}:`, e);
        }
      }
    }
    return null;
  }

  public guardarCredenciales(jsonContent: string | object): { success: boolean; message: string } {
    try {
      let parsed: any;
      if (typeof jsonContent === 'string') {
        parsed = JSON.parse(jsonContent);
      } else {
        parsed = jsonContent;
      }

      if (!parsed.client_email || !parsed.private_key) {
        return { success: false, message: 'El JSON debe contener "client_email" y "private_key".' };
      }

      // Normalizar saltos de línea de la clave RSA para prevenir error:1E08010C:DECODER routines::unsupported
      if (typeof parsed.private_key === 'string' && parsed.private_key.includes('\\n')) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }

      const targetPath = path.resolve(process.cwd(), 'service-account.json');
      fs.writeFileSync(targetPath, JSON.stringify(parsed, null, 2), 'utf-8');
      this.serviceAccountPath = targetPath;
      this.jwtClient = null;
      this.cachedToken = null;
      this.tokenExpiry = 0;

      console.log(`[SheetsService] service-account.json guardado y verificado en ${targetPath}`);
      return { success: true, message: `service-account.json guardado con éxito (${parsed.client_email}).` };
    } catch (err: any) {
      return { success: false, message: `Error procesando JSON: ${err.message}` };
    }
  }

  public async obtenerCredenciales(): Promise<{ client_email: string; private_key: string } | null> {
    if (this.cachedCredsObj) {
      return this.cachedCredsObj;
    }

    // 1. Variable de entorno (Vercel / Netlify / Cloud)
    const envJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.SERVICE_ACCOUNT_JSON || process.env.VITE_SERVICE_ACCOUNT_JSON;
    if (envJson) {
      try {
        const parsed = JSON.parse(envJson);
        if (parsed.client_email && (parsed.private_key || parsed.privateKey)) {
          let pk = parsed.private_key || parsed.privateKey;
          if (typeof pk === 'string' && pk.includes('\\n')) pk = pk.replace(/\\n/g, '\n');
          this.cachedCredsObj = { client_email: parsed.client_email, private_key: pk };
          console.log(`[SheetsService] Credenciales cargadas desde variable de entorno`);
          return this.cachedCredsObj;
        }
      } catch (_) {}
    }

    const envB64 = process.env.SERVICE_ACCOUNT_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
    if (envB64) {
      try {
        const decoded = Buffer.from(envB64, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        if (parsed.client_email && (parsed.private_key || parsed.privateKey)) {
          let pk = parsed.private_key || parsed.privateKey;
          if (typeof pk === 'string' && pk.includes('\\n')) pk = pk.replace(/\\n/g, '\n');
          this.cachedCredsObj = { client_email: parsed.client_email, private_key: pk };
          console.log(`[SheetsService] Credenciales cargadas desde variable base64`);
          return this.cachedCredsObj;
        }
      } catch (_) {}
    }

    // 2. Archivo en disco (desarrollo local)
    for (const ruta of POSIBLES_RUTAS_CREDENTIALS) {
      if (fs.existsSync(ruta)) {
        try {
          const raw = fs.readFileSync(ruta, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed.client_email && (parsed.private_key || parsed.privateKey)) {
            let pk = parsed.private_key || parsed.privateKey;
            if (typeof pk === 'string' && pk.includes('\\n')) pk = pk.replace(/\\n/g, '\n');
            this.serviceAccountPath = ruta;
            this.cachedCredsObj = { client_email: parsed.client_email, private_key: pk };
            console.log(`[SheetsService] Credenciales válidas encontradas en disco: ${ruta}`);
            return this.cachedCredsObj;
          }
        } catch (_) {}
      }
    }

    // 3. Firebase Firestore (producción en la nube: Vercel / Netlify sin necesidad de configurar env vars manuales)
    try {
      const docSnap = await getDoc(doc(db, 'configuracion', 'service_account'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.client_email && data.private_key) {
          let pk = data.private_key;
          if (typeof pk === 'string' && pk.includes('\\n')) pk = pk.replace(/\\n/g, '\n');
          this.cachedCredsObj = { client_email: data.client_email, private_key: pk };
          console.log(`[SheetsService] Credenciales cargadas exitosamente desde Firestore (configuracion/service_account)`);
          return this.cachedCredsObj;
        }
      }
    } catch (fsErr) {
      console.warn('[SheetsService] No se pudo leer credenciales de Firestore:', fsErr);
    }

    return null;
  }

  public tieneCredenciales(): boolean {
    return !!(
      this.cachedCredsObj ||
      this.detectarCredenciales() ||
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
      process.env.SERVICE_ACCOUNT_JSON ||
      process.env.SERVICE_ACCOUNT_BASE64 ||
      process.env.GOOGLE_SERVICE_ACCOUNT_BASE64
    );
  }

  public getDetallesCredenciales(): { activa: boolean; email?: string; path?: string } {
    if (this.cachedCredsObj) {
      return { activa: true, email: this.cachedCredsObj.client_email, path: 'Firestore / Variable de Entorno' };
    }
    const ruta = this.detectarCredenciales();
    if (!ruta) {
      return { activa: false };
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
      return { activa: true, email: parsed.client_email, path: path.basename(ruta) };
    } catch {
      return { activa: false };
    }
  }

  public async obtenerAuthToken(): Promise<string> {
    const ahora = Date.now();
    if (this.cachedToken && this.tokenExpiry > ahora + 60000) {
      return this.cachedToken;
    }

    const creds = await this.obtenerCredenciales();
    if (!creds || !creds.client_email || !creds.private_key) {
      throw new Error('No se encontraron credenciales de Google Service Account (disco, variables de entorno o Firebase Firestore).');
    }

    this.jwtClient = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/spreadsheets'
      ]
    });

    const tokenResponse = await this.jwtClient.authorize();
    if (!tokenResponse.access_token) {
      throw new Error('No se pudo obtener el Access Token de Google Cloud.');
    }

    this.cachedToken = tokenResponse.access_token;
    this.tokenExpiry = (tokenResponse.expiry_date as number) || (Date.now() + 3500000);
    return this.cachedToken;
  }

  /**
   * Mapeo dinámico e inteligente de columnas por nombre
   */
  public parsearFilasDinamicas(matriz: any[][], origenDesc = 'Google Sheets'): CasoSheets[] {
    if (!matriz || matriz.length < 2) return [];

    // Encontrar la fila del encabezado
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(6, matriz.length); i++) {
      const rowText = (matriz[i] || []).map(v => String(v || '').toLowerCase()).join(' ');
      if (rowText.includes('caso op') || (rowText.includes('tienda') && rowText.includes('integrac'))) {
        headerRowIdx = i;
        break;
      }
    }

    const headers = (matriz[headerRowIdx] || []).map(h => String(h || '').trim());
    
    // Mapear índices
    const findCol = (predicate: (h: string) => boolean): number => {
      return headers.findIndex(h => predicate(h.toLowerCase()));
    };

    const colCasoOp = findCol(h => (h.includes('caso') && h.includes('op')) || h === 'n° caso op');
    const colVendorId = findCol(h => h === 'id' || h.includes('vendor'));
    const colTienda = findCol(h => h.includes('tienda'));
    const colPais = findCol(h => h.includes('país') || h.includes('pais'));
    const colKam = findCol(h => h.includes('kam'));
    const colIntegracion = findCol(h => h.includes('integrac'));
    const colOportunidad = findCol(h => h.includes('oportunidad') && !h.includes('propietario'));
    const colAsset = findCol(h => h.includes('asset'));
    const colPropOp = findCol(h => h.includes('propietario') && h.includes('oportunidad'));
    const colPropTicket = findCol(h => h.includes('herocare') || (h.includes('propietario') && h.includes('ticket')));
    const colSeguimiento = findCol(h => h.includes('caso seguimiento') || (h.includes('caso') && h.includes('seguimiento')));
    const colTieneInicio = findCol(h => h.includes('onboarding') && h.includes('inicio') && h.includes('?'));
    const colComentarios = findCol(h => h.includes('comentario'));
    const colEstado = findCol(h => (h.includes('estado') && !h.includes('onboarding')) || h === 'estado del caso' || h === 'estado caso');
    const colEtapa = findCol(h => h.includes('etapa') || (h.includes('estado') && h.includes('onboarding')));
    const colFechaCreacion = findCol(h => h.includes('creación') || h.includes('creacion'));
    const colSlaInicio = findCol(h => h.includes('inicio de seguimiento de op'));
    const colFechaCierre = findCol(h => h.includes('cierre de op') || h.includes('cierre op'));

    // POS API
    const colFechaInicioPos = findCol(h => h.includes('inicio') && h.includes('pos'));
    const colFechaPushPos = findCol(h => h.includes('push') && h.includes('pos') && !h.includes('push kam'));
    const colRespPos = findCol(h => h.includes('respuesta') && h.includes('roadmap') && h.includes('pos') && !h.includes('fecha'));
    const colPushKamPos = findCol(h => h.includes('push kam') && h.includes('pos'));

    // Catálogo
    const colFechaInicioCat = findCol(h => h.includes('inicio') && (h.includes('catálogo') || h.includes('catalogo')));
    const colFechaPushCat = findCol(h => h.includes('push') && (h.includes('catálogo') || h.includes('catalogo')) && !h.includes('push kam'));
    const colRespCat = findCol(h => h.includes('respuesta') && h.includes('roadmap') && (h.includes('catálogo') || h.includes('catalogo')) && !h.includes('fecha'));
    const colPushKamCat = findCol(h => h.includes('push kam') && (h.includes('catálogo') || h.includes('catalogo')));

    // Tiempos y Rangos
    const colTiempoLV = findCol(h => h.includes('tiempo transcurrido') && (h.includes('op') || h.includes('l-v') || h.includes('l v')));
    const colTiempoPos = findCol(h => h.includes('tiempo transcurrido') && h.includes('pos'));
    const colTiempoCat = findCol(h => h.includes('tiempo transcurrido') && (h.includes('catálogo') || h.includes('catalogo')));
    const colRangoSlaOP = findCol(h => (h.includes('rango sla') && (h.includes('op') || h.includes('horas'))) || h === 'rango sla op');
    const colRangoPos = findCol(h => h.includes('rango sla') && h.includes('pos'));
    const colRangoCat = findCol(h => h.includes('rango sla') && (h.includes('catálogo') || h.includes('catalogo')));

    // Respuestas Freeze Roadmap
    const colFreezePos = findCol(h => h.includes('fecha de respuesta') && h.includes('pos'));
    const colFreezeCat = findCol(h => h.includes('fecha de respuesta') && (h.includes('catálogo') || h.includes('catalogo')));

    const rows = matriz.slice(headerRowIdx + 1);
    const casos: CasoSheets[] = [];

    // Muestreo para detectar por valores si las cabeceras fallan
    const etapasConocidas = [
      'sin integración confirmada', 'sin integracion confirmada',
      'en proceso de seteo',
      'en proceso de verificación de catálogo', 'en proceso de verificacion de catalogo', 'en proceso de carga de catálogo',
      'validación del onboarding', 'validacion del onboarding',
      'en proceso para pruebas',
      'pedido de prueba realizado',
      'en proceso para pruebas (baja de integración)', 'en proceso para pruebas (baja de integracion)',
      'pedido de prueba realizado (baja de integración)', 'pedido de prueba realizado (baja de integracion)',
      'solicitud de creación de oportunidad admin (sin go)', 'solicitud de creacion de oportunidad admin (sin go)',
      'sin configuraciones a nivel integración', 'sin configuraciones a nivel integracion'
    ];
    const estadosConocidos = [
      'en progreso', 'nuevo', 'ticket hc', 'abierto',
      'cerrado por oportunidad satisfactoria', 
      'cerrado por kam', 'cerrado por api vendor', 'fallido', 'cerrado'
    ];

    let bestColEstado = colEstado >= 0 ? colEstado : 14;
    let bestColEtapa = colEtapa >= 0 ? colEtapa : 15;

    let maxEstadoHits = 0;
    let maxEtapaHits = 0;

    for (let c = 12; c < Math.min(headers.length, 26); c++) {
      let estadoHits = 0;
      let etapaHits = 0;
      for (let r = 0; r < Math.min(30, rows.length); r++) {
        const v = String((rows[r] && rows[r][c]) || '').toLowerCase().trim();
        if (estadosConocidos.some(est => v === est || v.includes(est))) estadoHits++;
        if (etapasConocidas.some(et => v === et || v.includes(et))) etapaHits++;
      }
      if (estadoHits > maxEstadoHits) {
        maxEstadoHits = estadoHits;
        bestColEstado = c;
      }
      if (etapaHits > maxEtapaHits) {
        maxEtapaHits = etapaHits;
        bestColEtapa = c;
      }
    }

    rows.forEach((row, idx) => {
      const getVal = (colIdx: number, fallback = ''): string => {
        if (colIdx >= 0 && row[colIdx] !== undefined && row[colIdx] !== null) {
          return String(row[colIdx]).trim();
        }
        return fallback;
      };

      const casoOp = getVal(colCasoOp >= 0 ? colCasoOp : 0);
      const vendorId = getVal(colVendorId >= 0 ? colVendorId : 1);
      const tienda = getVal(colTienda >= 0 ? colTienda : 2);

      // Si no tiene casoOp ni vendorId ni tienda, ignorar fila vacía
      if (!casoOp && !vendorId && !tienda) return;

      const pais = getVal(colPais >= 0 ? colPais : 3);
      const kam = getVal(colKam >= 0 ? colKam : 4);
      const integracion = getVal(colIntegracion >= 0 ? colIntegracion : 5);
      const oportunidad = getVal(colOportunidad >= 0 ? colOportunidad : 7);
      const asset = getVal(colAsset >= 0 ? colAsset : 8);
      const propietarioOportunidad = getVal(colPropOp >= 0 ? colPropOp : 9);
      const propietarioTicket = getVal(colPropTicket >= 0 ? colPropTicket : 10);
      const casoSeguimiento = getVal(colSeguimiento >= 0 ? colSeguimiento : 11);
      const tieneCasoInicio = getVal(colTieneInicio >= 0 ? colTieneInicio : 12, 'Si');
      const comentarios = getVal(colComentarios >= 0 ? colComentarios : 13);
      let estado = getVal(bestColEstado >= 0 ? bestColEstado : 14, 'Cerrado por oportunidad satisfactoria');
      let etapa = getVal(bestColEtapa >= 0 ? bestColEtapa : 15, 'Validación del Onboarding');
      const fechaCreacion = getVal(colFechaCreacion >= 0 ? colFechaCreacion : 16);
      const sla_inicio = getVal(colSlaInicio >= 0 ? colSlaInicio : 17, fechaCreacion || new Date().toISOString());

      // Saneamiento si vino con fecha
      if (estado.includes('GMT') || estado.includes('00:00:00') || !estado) {
        for (let c = 12; c < Math.min(row.length, 25); c++) {
          const val = String(row[c] || '').trim();
          const vLower = val.toLowerCase();
          if (vLower.includes('cerrad') || vLower.includes('fallid') || vLower === 'en progreso' || vLower === 'nuevo' || vLower.includes('ticket hc') || vLower.includes('sin oportunidad')) {
            estado = val;
            break;
          }
        }
      }

      if (estado.includes('GMT') || !estado) {
        estado = 'Cerrado por oportunidad satisfactoria';
      }
      if (etapa.includes('GMT') || !etapa) {
        etapa = 'Validación del Onboarding';
      }

      // Fechas y Campos de Push
      const fechaCierre = getVal(colFechaCierre >= 0 ? colFechaCierre : 18);
      const fechaInicioPos = getVal(colFechaInicioPos >= 0 ? colFechaInicioPos : 19);
      const fechaPushPos = getVal(colFechaPushPos >= 0 ? colFechaPushPos : 20);
      const rawRespPos = getVal(colRespPos >= 0 ? colRespPos : 21);
      const respuestaPos = (rawRespPos.toLowerCase() === 'si' || rawRespPos.toLowerCase() === 'sí') ? 'Si' : (rawRespPos.toLowerCase() === 'no' ? 'No' : (rawRespPos.toUpperCase() === 'S/V' || rawRespPos.toUpperCase() === 'SV' ? 'S/V' : rawRespPos));
      const pushKamPos = getVal(colPushKamPos >= 0 ? colPushKamPos : 22);
      const fechaInicioCat = getVal(colFechaInicioCat >= 0 ? colFechaInicioCat : 23);
      const fechaPushCat = getVal(colFechaPushCat >= 0 ? colFechaPushCat : 24);
      const rawRespCat = getVal(colRespCat >= 0 ? colRespCat : 25);
      const respuestaCat = (rawRespCat.toLowerCase() === 'si' || rawRespCat.toLowerCase() === 'sí') ? 'Si' : (rawRespCat.toLowerCase() === 'no' ? 'No' : (rawRespCat.toUpperCase() === 'S/V' || rawRespCat.toUpperCase() === 'SV' ? 'S/V' : rawRespCat));
      const pushKamCat = getVal(colPushKamCat >= 0 ? colPushKamCat : 26);

      const tiempoTranscurridoOp = getVal(colTiempoLV >= 0 ? colTiempoLV : 30);
      const tiempoTranscurridoPos = getVal(colTiempoPos >= 0 ? colTiempoPos : 31);
      const tiempoTranscurridoCat = getVal(colTiempoCat >= 0 ? colTiempoCat : 32);

      const rangoSlaOp = getVal(colRangoSlaOP >= 0 ? colRangoSlaOP : 34);
      const rangoSlaPos = getVal(colRangoPos >= 0 ? colRangoPos : 35);
      const rangoSlaCat = getVal(colRangoCat >= 0 ? colRangoCat : 36);

      const fechaFreezePos = getVal(colFreezePos >= 0 ? colFreezePos : 39);
      const fechaFreezeCat = getVal(colFreezeCat >= 0 ? colFreezeCat : 40);

      let horasSLA = 0;
      if (tiempoTranscurridoOp) {
        const s = tiempoTranscurridoOp.toLowerCase();
        const mDias = s.match(/(\d+)\s*d[ií]as?/);
        const mHoras = s.match(/(\d+)\s*h/);
        const mMin = s.match(/(\d+)\s*m/);
        if (mDias) horasSLA += parseInt(mDias[1], 10) * 24;
        if (mHoras) horasSLA += parseInt(mHoras[1], 10);
        if (mMin) horasSLA += Math.round(parseInt(mMin[1], 10) / 60);
      }

      const es96 = rangoSlaOp.includes('≥96') || rangoSlaOp.includes('>=96') || (rangoSlaOp.includes('96') && !rangoSlaOp.includes('<96'));
      const es72 = !es96 && (rangoSlaOp.includes('>72') || (rangoSlaOp.includes('72') && !rangoSlaOp.includes('<72')));
      const es24 = !es96 && !es72 && (rangoSlaOp.includes('≥24') || rangoSlaOp.includes('>=24') || (rangoSlaOp.includes('24') && !rangoSlaOp.includes('<24')));
      const es6 = !es96 && !es72 && !es24 && (rangoSlaOp.includes('>6') || (rangoSlaOp.includes('6h') && !rangoSlaOp.includes('<6')));

      if (es96) {
        horasSLA = Math.max(horasSLA, 96);
      } else if (es72) {
        horasSLA = Math.max(horasSLA, 73);
      } else if (es24) {
        horasSLA = Math.max(horasSLA, 24);
      } else if (es6) {
        horasSLA = Math.max(horasSLA, 7);
      }

      const estadoLower = estado.toLowerCase();
      const etapaLower = etapa.toLowerCase();
      const esCerrado = estadoLower.includes('cerrad') || estadoLower.includes('fallid') || estadoLower.includes('cancel') || etapaLower.includes('pedido de prueba realizado');
      const esActivo = !esCerrado && (estadoLower.includes('en progreso') || estadoLower.includes('nuevo') || estadoLower.includes('ticket hc') || estadoLower === 'abierto' || estadoLower.includes('sin oportunidad'));

      const filaNum = headerRowIdx + 2 + idx;
      const uniqueId = casoOp && vendorId ? `${casoOp}_${vendorId}_r${filaNum}` : (casoOp ? `${casoOp}_r${filaNum}` : (vendorId ? `${vendorId}_r${filaNum}` : `CASO-${filaNum}`));

      casos.push({
        id: uniqueId,
        casoOp: casoOp || '',
        vendorId: vendorId || '',
        vendor_id: vendorId || '',
        tienda: tienda || '',
        pais: pais || '',
        kam: kam || '',
        integracion: integracion || '',
        oportunidad: oportunidad || '',
        asset: asset || '',
        casoSeguimiento: casoSeguimiento || '',
        propietarioOportunidad: propietarioOportunidad || '',
        propietarioTicket: propietarioTicket || '',
        agente: propietarioTicket || propietarioOportunidad || 'Sin asignación',
        tieneCasoInicio: tieneCasoInicio || 'Si',
        comentarios: comentarios || '',
        fechaCreacion: fechaCreacion || '',
        estado: estado || 'En progreso',
        etapa: etapa || 'Validación del Onboarding',
        sla_inicio: sla_inicio || new Date().toISOString(),
        rangoSlaOp: rangoSlaOp || '',
        rangoSla: rangoSlaOp || '',
        tiempoTranscurridoOp: tiempoTranscurridoOp || '',
        tiempoTranscurridoLV: tiempoTranscurridoOp || '',
        pushKamPos: pushKamPos || '',
        pushKamCat: pushKamCat || '',
        rangoSlaPos: rangoSlaPos || '',
        rangoSlaCat: rangoSlaCat || '',
        fechaCierre: fechaCierre || '',
        fechaInicioPos: fechaInicioPos || '',
        fechaPushPos: fechaPushPos || '',
        respuestaPos: respuestaPos || '',
        fechaInicioCat: fechaInicioCat || '',
        fechaPushCat: fechaPushCat || '',
        respuestaCat: respuestaCat || '',
        tiempoTranscurridoPos: tiempoTranscurridoPos || '',
        tiempoTranscurridoCat: tiempoTranscurridoCat || '',
        fechaFreezePos: fechaFreezePos || '',
        fechaFreezeCat: fechaFreezeCat || '',
        freezePos: fechaFreezePos || '',
        freezeCat: fechaFreezeCat || '',
        horasSLA,
        esActivo,
        origen: origenDesc,
        filaNumero: filaNum
      });
    });

    return casos;
  }

  /**
   * Parsea un texto CSV / TSV con soporte para comillas y saltos de línea
   */
  public parsearCSV(csvText: string, origen = 'Archivo CSV'): CasoSheets[] {
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentField = '';
    let inQuotes = false;

    // Detectar si el delimitador es coma o punto y coma o tabulador
    const firstLine = csvText.split('\n')[0] || '';
    const delimiter = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',');

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++; // Saltar comilla escapada
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        currentLine.push(currentField);
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentLine.push(currentField);
        currentField = '';
        if (currentLine.some(c => c.trim().length > 0)) {
          lines.push(currentLine);
        }
        currentLine = [];
      } else {
        currentField += char;
      }
    }

    if (currentField.length > 0 || currentLine.length > 0) {
      currentLine.push(currentField);
      if (currentLine.some(c => c.trim().length > 0)) {
        lines.push(currentLine);
      }
    }

    const casos = this.parsearFilasDinamicas(lines, origen);
    if (casos.length > 0) {
      this.guardarCasosCache(casos);
    }
    return casos;
  }

  /**
   * Actualiza un caso existente en memoria y en disco sin duplicarlo
   */
  public actualizarCaso(casoActualizado: Partial<CasoSheets> & { id: string }): { success: boolean; caso?: CasoSheets; message?: string } {
    const idBusqueda = String(casoActualizado.id || (casoActualizado as any).casoOp || '').trim();
    const idx = this.cachedCasosMemoria.findIndex(c => 
      String(c.id).trim() === idBusqueda || 
      String(c.casoOp).trim() === idBusqueda || 
      (casoActualizado.filaNumero && c.filaNumero === casoActualizado.filaNumero)
    );

    if (idx !== -1) {
      const casoExistente = this.cachedCasosMemoria[idx];

      const respPosRaw = (casoActualizado.respuestaPos !== undefined ? casoActualizado.respuestaPos : casoExistente.respuestaPos) || '';
      const normRespPos = (respPosRaw.toLowerCase() === 'si' || respPosRaw.toLowerCase() === 'sí') ? 'Si' : (respPosRaw.toLowerCase() === 'no' ? 'No' : (respPosRaw.toUpperCase() === 'S/V' || respPosRaw.toUpperCase() === 'SV' ? 'S/V' : respPosRaw));

      let fechaFreezePos = casoActualizado.fechaFreezePos !== undefined ? casoActualizado.fechaFreezePos : (casoActualizado.freezePos !== undefined ? casoActualizado.freezePos : casoExistente.fechaFreezePos);
      if (normRespPos === 'Si') {
        if (!fechaFreezePos) fechaFreezePos = this.formatearFechaSheet(new Date());
      } else {
        fechaFreezePos = '';
      }

      const respCatRaw = (casoActualizado.respuestaCat !== undefined ? casoActualizado.respuestaCat : casoExistente.respuestaCat) || '';
      const normRespCat = (respCatRaw.toLowerCase() === 'si' || respCatRaw.toLowerCase() === 'sí') ? 'Si' : (respCatRaw.toLowerCase() === 'no' ? 'No' : (respCatRaw.toUpperCase() === 'S/V' || respCatRaw.toUpperCase() === 'SV' ? 'S/V' : respCatRaw));

      let fechaFreezeCat = casoActualizado.fechaFreezeCat !== undefined ? casoActualizado.fechaFreezeCat : (casoActualizado.freezeCat !== undefined ? casoActualizado.freezeCat : casoExistente.fechaFreezeCat);
      if (normRespCat === 'Si') {
        if (!fechaFreezeCat) fechaFreezeCat = this.formatearFechaSheet(new Date());
      } else {
        fechaFreezeCat = '';
      }

      const casoMerged: CasoSheets = { 
        ...casoExistente, 
        ...casoActualizado,
        respuestaPos: normRespPos,
        respuestaCat: normRespCat,
        fechaFreezePos: fechaFreezePos || '',
        fechaFreezeCat: fechaFreezeCat || '',
        freezePos: fechaFreezePos || '',
        freezeCat: fechaFreezeCat || '',
        // Garantizar coherencia
        esActivo: !String(casoActualizado.estado || casoExistente.estado).toLowerCase().includes('cerrado') &&
                  !String(casoActualizado.estado || casoExistente.estado).toLowerCase().includes('fallido')
      };
      this.cachedCasosMemoria[idx] = casoMerged;
      this.guardarCasosCache(this.cachedCasosMemoria);
      console.log(`[SheetsService] Caso OP ${idBusqueda} actualizado exitosamente.`);
      return { success: true, caso: casoMerged, message: `Caso ${idBusqueda} actualizado.` };
    } else {
      const nuevo: CasoSheets = {
        ...casoActualizado,
        id: idBusqueda || (casoActualizado as any).id || `OP-${Date.now()}`,
        casoOp: (casoActualizado as any).casoOp || idBusqueda,
        vendorId: (casoActualizado as any).vendorId || '',
        vendor_id: (casoActualizado as any).vendorId || '',
        tienda: casoActualizado.tienda || '',
        pais: casoActualizado.pais || '',
        kam: casoActualizado.kam || '',
        integracion: casoActualizado.integracion || '',
        oportunidad: casoActualizado.oportunidad || '',
        asset: casoActualizado.asset || '',
        casoSeguimiento: (casoActualizado as any).casoSeguimiento || '',
        propietarioOportunidad: casoActualizado.propietarioOportunidad || '',
        propietarioTicket: (casoActualizado as any).propietarioTicket || '',
        agente: casoActualizado.agente || casoActualizado.propietarioOportunidad || '',
        tieneCasoInicio: (casoActualizado as any).tieneCasoInicio || 'Si',
        comentarios: casoActualizado.comentarios || '',
        fechaCreacion: casoActualizado.fechaCreacion || new Date().toISOString().split('T')[0],
        estado: casoActualizado.estado || 'Nuevo',
        etapa: casoActualizado.etapa || 'Validación del Onboarding',
        sla_inicio: (casoActualizado as any).sla_inicio || new Date().toISOString(),
        esActivo: true,
        origen: 'Manual / Actualización',
        filaNumero: this.cachedCasosMemoria.length + 2
      } as CasoSheets;

      this.cachedCasosMemoria.unshift(nuevo);
      this.guardarCasosCache(this.cachedCasosMemoria);
      return { success: true, caso: nuevo, message: `Caso ${idBusqueda} creado.` };
    }
  }

  /**
   * Elimina un caso tanto de Google Sheets (hoja Onboarding_New) como de memoria y caché local
   */
  public async eliminarCaso(casoIdOCasoOp: string): Promise<{ success: boolean; message: string; filaEliminada?: number }> {
    const idStr = String(casoIdOCasoOp || '').trim();
    if (!idStr) {
      return { success: false, message: 'ID o Caso OP requerido.' };
    }

    let filaTarget = 0;
    const casoEnMemoria = this.cachedCasosMemoria.find(c => 
      String(c.id).trim() === idStr || 
      String(c.casoOp).trim() === idStr || 
      String(c.vendorId || c.vendor_id || '').trim() === idStr
    );

    if (casoEnMemoria?.filaNumero) {
      filaTarget = casoEnMemoria.filaNumero;
    }

    // Si tenemos credenciales activas, eliminar la fila en Google Sheets
    if (this.tieneCredenciales()) {
      try {
        const token = await this.obtenerAuthToken();
        const sheetIdOnboardingNew = 104076048; // GID oficial de la hoja Onboarding_New

        // Si no encontramos la fila exacta en memoria, buscar en las columnas B y C de Sheets
        if (!filaTarget || filaTarget < 2) {
          const urlCols = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'Onboarding_New'!B2:C?valueRenderOption=FORMATTED_VALUE`;
          const resCols = await fetch(urlCols, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (resCols.ok) {
            const dataCols = await resCols.json();
            const rows = dataCols.values || [];
            for (let i = 0; i < rows.length; i++) {
              const op = String(rows[i]?.[0] || '').trim();
              const ven = String(rows[i]?.[1] || '').trim();
              if (op === idStr || ven === idStr) {
                filaTarget = i + 2;
                break;
              }
            }
          }
        }

        if (filaTarget >= 2) {
          const urlBatch = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`;
          const resBatch = await fetch(urlBatch, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              requests: [
                {
                  deleteDimension: {
                    range: {
                      sheetId: sheetIdOnboardingNew,
                      dimension: 'ROWS',
                      startIndex: filaTarget - 1, // 0-indexed inclusive
                      endIndex: filaTarget        // 0-indexed exclusive
                    }
                  }
                }
              ]
            })
          });

          if (!resBatch.ok) {
            const errText = await resBatch.text();
            console.warn(`[SheetsService] Error eliminando fila ${filaTarget} en Sheets:`, errText);
          } else {
            console.log(`[SheetsService] Fila ${filaTarget} (caso ${idStr}) eliminada con éxito en Google Sheets.`);
          }
        }
      } catch (err: any) {
        console.error('[SheetsService] Excepción al eliminar fila en Google Sheets:', err);
      }
    }

    // Eliminar de memoria y reajustar los números de fila de los casos posteriores
    this.cachedCasosMemoria = this.cachedCasosMemoria
      .filter(c => 
        String(c.id).trim() !== idStr && 
        String(c.casoOp).trim() !== idStr && 
        (!filaTarget || c.filaNumero !== filaTarget)
      )
      .map(c => {
        if (filaTarget && c.filaNumero && c.filaNumero > filaTarget) {
          return { ...c, filaNumero: c.filaNumero - 1 };
        }
        return c;
      });

    this.guardarCasosCache(this.cachedCasosMemoria);
    return { success: true, message: `Caso ${idStr} eliminado correctamente.`, filaEliminada: filaTarget };
  }

  /**
   * Convierte un objeto CasoSheets en el array de 27 valores de columnas A:AA de Onboarding_New
   */
  public mapearCasoAColumnasSheet(c: any): any[] {
    const pushKamPosStr = c.pushKamPos === true || String(c.pushKamPos).toUpperCase() === 'TRUE' ? 'TRUE' : (c.pushKamPos === false || String(c.pushKamPos).toUpperCase() === 'FALSE' ? 'FALSE' : '');
    const pushKamCatStr = c.pushKamCat === true || String(c.pushKamCat).toUpperCase() === 'TRUE' ? 'TRUE' : (c.pushKamCat === false || String(c.pushKamCat).toUpperCase() === 'FALSE' ? 'FALSE' : '');
    const sponsorship = c.sponsorship || c.descuentosBajoEstructuraSponsorship || 'NO';

    return [
      c.casoOp || '',                                                      // A: N° Caso OP
      c.vendorId || c.vendor_id || '',                                     // B: ID
      c.tienda || '',                                                      // C: Tienda
      c.pais || '',                                                        // D: País
      c.kam || '',                                                         // E: Kam
      c.integracion || '',                                                 // F: Integración
      sponsorship,                                                         // G: Descuentos bajo estructura Sponsorship
      c.oportunidad || '',                                                 // H: Oportunidad
      c.asset || '',                                                       // I: Asset
      c.propietarioOportunidad || '',                                      // J: Propietario Oportunidad
      c.propietarioTicket || c.agente || '',                               // K: Propietario de Ticket HeroCare
      c.casoSeguimiento || '',                                             // L: N° Caso Seguimiento
      c.tieneCasoInicio || 'Si',                                           // M: ¿Tiene caso de onboarding en el inicio de seguimiento?
      c.comentarios || '',                                                 // N: Comentarios del Onboarding
      c.estado || 'En progreso',                                           // O: Estado del caso
      c.etapa || 'Validación del Onboarding',                              // P: Etapa del onboarding
      c.fechaCreacion || '',                                               // Q: Fecha de creación de la OP
      c.sla_inicio || c.fechaCreacion || '',                               // R: Fecha de inicio de seguimiento de OP
      c.fechaCierre || '',                                                 // S: Fecha de cierre de OP
      c.fechaInicioPos || '',                                              // T: Fecha de inicio de seguimiento - Datos Faltantes POS API
      c.fechaPushPos || '',                                                // U: Fecha de push de seguimiento - Datos Faltantes POS API
      c.respuestaPos || '',                                                // V: ¿Existe respuesta en el roadmap de Datos Faltantes POS API?
      pushKamPosStr,                                                       // W: Push KAM - Datos Faltantes POS API
      c.fechaInicioCat || '',                                              // X: Fecha de inicio de seguimiento - Catálogo
      c.fechaPushCat || '',                                                // Y: Fecha de push de seguimiento - Catálogo
      c.respuestaCat || '',                                                // Z: ¿Existe respuesta en el roadmap de Catálogo?
      pushKamCatStr                                                        // AA: Push KAM - Catálogo
    ];
  }

  /**
   * Guarda o actualiza un caso directamente en el Google Sheet oficial vía API
   */
  public async sincronizarCasoConGoogleSheets(caso: CasoSheets): Promise<{ success: boolean; filaNumero?: number; error?: string }> {
    const creds = await this.obtenerCredenciales();
    if (!creds) {
      return { success: false, error: 'Sin credenciales de Google Sheets' };
    }

    try {
      const token = await this.obtenerAuthToken();
      const filaValores = this.mapearCasoAColumnasSheet(caso);

      // Si el caso ya tiene un número de fila en Sheets, actualizar la fila existente (PUT)
      if (caso.filaNumero && caso.filaNumero > 1) {
        const rango = `'Onboarding_New'!A${caso.filaNumero}:AA${caso.filaNumero}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(rango)}?valueInputOption=USER_ENTERED`;
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: rango,
            values: [filaValores]
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`[SheetsService] Error al actualizar fila ${caso.filaNumero} en Sheets:`, errText);
          return { success: false, error: errText };
        }

        // Sincronizar también las columnas AN y AO (Fecha de respuesta en roadmap POS y Catálogo)
        const rangoFreeze = `'Onboarding_New'!AN${caso.filaNumero}:AO${caso.filaNumero}`;
        const urlFreeze = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(rangoFreeze)}?valueInputOption=USER_ENTERED`;
        const valFreezePos = caso.fechaFreezePos || caso.freezePos || '';
        const valFreezeCat = caso.fechaFreezeCat || caso.freezeCat || '';
        await fetch(urlFreeze, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: rangoFreeze,
            values: [[valFreezePos, valFreezeCat]]
          })
        }).catch(e => console.warn('[SheetsService] Error sincronizando AN:AO freeze:', e));

        console.log(`[SheetsService] Fila ${caso.filaNumero} (OP ${caso.casoOp}) actualizada en Google Sheets (A:AA y AN:AO).`);
        return { success: true, filaNumero: caso.filaNumero };
      }

      // Si es un nuevo caso o no tiene filaNumero, agregar al final de la hoja (APPEND)
      const urlAppend = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent("'Onboarding_New'!A:AA")}:append?valueInputOption=USER_ENTERED`;
      const res = await fetch(urlAppend, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [filaValores]
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[SheetsService] Error al insertar nuevo caso en Sheets:`, errText);
        return { success: false, error: errText };
      }

      const data = await res.json();
      let nuevaFila = caso.filaNumero || this.cachedCasosMemoria.length + 2;
      if (data?.updates?.updatedRange) {
        const match = data.updates.updatedRange.match(/A(\d+):/);
        if (match) {
          nuevaFila = parseInt(match[1], 10);
        }
      }

      caso.filaNumero = nuevaFila;
      this.guardarCasosCache(this.cachedCasosMemoria);

      // Si es nueva fila y tiene fecha freeze, actualizar AN:AO
      const valFreezePos = caso.fechaFreezePos || caso.freezePos || '';
      const valFreezeCat = caso.fechaFreezeCat || caso.freezeCat || '';
      if (valFreezePos || valFreezeCat) {
        const rangoFreeze = `'Onboarding_New'!AN${nuevaFila}:AO${nuevaFila}`;
        const urlFreeze = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(rangoFreeze)}?valueInputOption=USER_ENTERED`;
        await fetch(urlFreeze, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ range: rangoFreeze, values: [[valFreezePos, valFreezeCat]] })
        }).catch(e => console.warn('[SheetsService] Error sincronizando AN:AO freeze nueva fila:', e));
      }

      console.log(`[SheetsService] Nuevo caso OP ${caso.casoOp} insertado en Google Sheets (Fila #${nuevaFila}).`);
      return { success: true, filaNumero: nuevaFila };
    } catch (err: any) {
      console.error('[SheetsService] Error sincronizando caso con Google Sheets:', err);
      return { success: false, error: err.message };
    }
  }

  public formatearFechaSheet(d: Date = new Date()): string {
    const dia = d.getDate();
    const mes = d.getMonth() + 1;
    const anio = d.getFullYear();
    const horas = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const seg = String(d.getSeconds()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${horas}:${min}:${seg}`;
  }

  public async registrarPush(
    casoId: string, 
    tipo: 'pos' | 'cat' | 'kam_pos' | 'kam_cat', 
    fechaHora?: string
  ): Promise<{ success: boolean; message: string; caso?: CasoSheets; sheetsActualizado?: boolean }> {
    const ahoraStr = fechaHora || this.formatearFechaSheet(new Date());
    const idLimpio = String(casoId).trim();

    const idx = this.cachedCasosMemoria.findIndex(c => 
      String(c.id).trim() === idLimpio || 
      String(c.casoOp).trim() === idLimpio ||
      (c.casoOp && idLimpio.startsWith(c.casoOp))
    );

    if (idx === -1) {
      return { success: false, message: `Caso ${casoId} no encontrado.` };
    }

    const caso = this.cachedCasosMemoria[idx];
    let colLetra = '';
    let nuevoValor = '';

    if (tipo === 'pos') {
      caso.fechaPushPos = ahoraStr;
      colLetra = 'U';
      nuevoValor = ahoraStr;
    } else if (tipo === 'cat') {
      caso.fechaPushCat = ahoraStr;
      colLetra = 'Y';
      nuevoValor = ahoraStr;
    } else if (tipo === 'kam_pos') {
      caso.pushKamPos = 'TRUE';
      colLetra = 'W';
      nuevoValor = 'TRUE';
    } else if (tipo === 'kam_cat') {
      caso.pushKamCat = 'TRUE';
      colLetra = 'AA';
      nuevoValor = 'TRUE';
    }

    this.cachedCasosMemoria[idx] = { ...caso };
    this.guardarCasosCache(this.cachedCasosMemoria);

    let sheetsActualizado = false;
    if (this.tieneCredenciales() && caso.filaNumero && colLetra) {
      try {
        const token = await this.obtenerAuthToken();
        const celda = `'Onboarding_New'!${colLetra}${caso.filaNumero}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(celda)}?valueInputOption=USER_ENTERED`;
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: celda,
            values: [[nuevoValor]]
          })
        });
        if (res.ok) {
          sheetsActualizado = true;
          console.log(`[SheetsService] Celda ${celda} actualizada en Google Sheets con "${nuevoValor}".`);
        } else {
          const errText = await res.text();
          console.warn(`[SheetsService] Advertencia al actualizar celda ${celda} en Google Sheets:`, errText);
        }
      } catch (err) {
        console.warn(`[SheetsService] Error actualizando celda ${colLetra}${caso.filaNumero} en Google Sheets:`, err);
      }
    }

    return { 
      success: true, 
      message: `Push ${tipo.toUpperCase()} registrado correctamente.`, 
      caso: this.cachedCasosMemoria[idx], 
      sheetsActualizado 
    };
  }

  /**
   * Descarga el rango dinámico Onboarding_New!A3:AZ completo y mapea las 1,760+ filas
   */
  public async obtenerTodasLasFilas(): Promise<CasoSheets[]> {
    // Si tenemos credenciales de servicio, consultar Google Sheets API
    const creds = await this.obtenerCredenciales();
    if (creds) {
      const token = await this.obtenerAuthToken();
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent("'Onboarding_New'!A2:AZ")}?valueRenderOption=FORMATTED_VALUE`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Google Sheets API error [${res.status}]: ${errorBody}`);
      }

      const json = await res.json();
      const rows = json.values || [];
      const casos = this.parsearFilasDinamicas(rows, 'Google Sheets (API)');
      if (casos.length > 0) {
        this.guardarCasosCache(casos);
      }
      return casos;
    }

    // Si no hay cuenta de servicio pero hay casos en cache (por Apps Script o CSV)
    if (this.cachedCasosMemoria.length > 0) {
      return this.cachedCasosMemoria;
    }

    return [];
  }

  /**
   * Obtiene todos los catálogos directamente de la hoja oficial Integraciones_Sponsorship!A:N
   */
  public async obtenerCatalogosSheet(): Promise<CatalogosSheet> {
    const creds = await this.obtenerCredenciales();
    if (creds) {
      try {
        const token = await this.obtenerAuthToken();
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent("'Integraciones_Sponsorship'!A:N")}?valueRenderOption=FORMATTED_VALUE`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const json = await res.json();
          const rows: any[][] = json.values || [];

          const integraciones: { nombre: string; sponsorship: string }[] = [];
          const paises: string[] = [];
          const oportunidades: string[] = [];
          const assets: string[] = [];
          const agentes: string[] = [];
          const estados: string[] = [];
          const etapas: string[] = [];

          // La fila 0 es cabecera; a partir de la fila 1 son datos
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            // Col A (0): Integración & Col B (1): Sponsorship
            const nomInteg = row[0] ? String(row[0]).trim() : '';
            const sponInteg = row[1] ? String(row[1]).trim().toUpperCase() : 'NO';
            if (nomInteg) {
              const existe = integraciones.some(it => it.nombre.toLowerCase() === nomInteg.toLowerCase());
              if (!existe) {
                integraciones.push({
                  nombre: nomInteg,
                  sponsorship: (sponInteg === 'SI' || sponInteg === 'TRUE' || sponInteg === 'VERDADERO') ? 'SI' : 'NO'
                });
              }
            }

            // Col D (3): País
            const p = row[3] ? String(row[3]).trim() : '';
            if (p && !paises.some(x => x.toLowerCase() === p.toLowerCase())) paises.push(p);

            // Col F (5): Oportunidad
            const op = row[5] ? String(row[5]).trim() : '';
            if (op && !oportunidades.some(x => x.toLowerCase() === op.toLowerCase())) oportunidades.push(op);

            // Col H (7): Asset
            const as = row[7] ? String(row[7]).trim() : '';
            if (as && !assets.some(x => x.toLowerCase() === as.toLowerCase())) assets.push(as);

            // Col J (9): Agente
            const ag = row[9] ? String(row[9]).trim() : '';
            if (ag && !agentes.some(x => x.toLowerCase() === ag.toLowerCase())) agentes.push(ag);

            // Col L (11): Estado del caso
            const est = row[11] ? String(row[11]).trim() : '';
            if (est && !estados.some(x => x.toLowerCase() === est.toLowerCase())) estados.push(est);

            // Col N (13): Etapa del onboarding
            const et = row[13] ? String(row[13]).trim() : '';
            if (et && !etapas.some(x => x.toLowerCase() === et.toLowerCase())) etapas.push(et);
          }

          const resultado: CatalogosSheet = {
            integraciones,
            paises,
            oportunidades,
            assets,
            agentes,
            estados,
            etapas
          };

          try {
            const targetPath = process.env.VERCEL ? path.join('/tmp', 'data_cached_catalogos.json') : CATALOGOS_CACHE_FILE;
            fs.writeFileSync(targetPath, JSON.stringify(resultado, null, 2), 'utf-8');
            console.log(`[SheetsService] Catálogos cargados desde hoja Integraciones_Sponsorship (${integraciones.length} integraciones, ${paises.length} países, etc.)`);
          } catch (e) {
            console.warn('[SheetsService] Error guardando cache de catálogos (ignorado en serverless):', e);
          }

          return resultado;
        } else {
          console.warn('[SheetsService] Error al leer Integraciones_Sponsorship:', await res.text());
        }
      } catch (err) {
        console.error('[SheetsService] Error consultando Integraciones_Sponsorship:', err);
      }
    }

    // Fallback a cache local de catálogos si existe
    try {
      if (fs.existsSync(CATALOGOS_CACHE_FILE)) {
        const raw = fs.readFileSync(CATALOGOS_CACHE_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (_) {}

    return {
      integraciones: [],
      paises: [],
      oportunidades: [],
      assets: [],
      agentes: [],
      estados: [],
      etapas: []
    };
  }

  /**
   * Guarda o actualiza una columna/sección específica en la hoja oficial Integraciones_Sponsorship
   */
  public async guardarSeccionCatalogo(seccion: string, items: any[]): Promise<{ success: boolean; message: string }> {
    const creds = await this.obtenerCredenciales();
    if (!creds) {
      return { success: false, message: 'Sin credenciales activas de Google Sheets' };
    }

    try {
      const token = await this.obtenerAuthToken();
      let rangoClear = '';
      let rangoUpdate = '';
      let values: any[][] = [];

      switch (seccion.toLowerCase()) {
        case 'integraciones':
          rangoClear = "Integraciones_Sponsorship!A2:B";
          rangoUpdate = `Integraciones_Sponsorship!A2:B${Math.max(items.length + 1, 2)}`;
          values = items.map(item => {
            const nom = typeof item === 'object' ? item.nombre : String(item);
            const sp = (typeof item === 'object' && (String(item.sponsorship).toUpperCase() === 'SI' || item.sponsorship === true)) ? 'SI' : 'NO';
            return [nom, sp];
          });
          break;

        case 'paises':
          rangoClear = "Integraciones_Sponsorship!D2:D";
          rangoUpdate = `Integraciones_Sponsorship!D2:D${Math.max(items.length + 1, 2)}`;
          values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
          break;

        case 'oportunidades':
          rangoClear = "Integraciones_Sponsorship!F2:F";
          rangoUpdate = `Integraciones_Sponsorship!F2:F${Math.max(items.length + 1, 2)}`;
          values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
          break;

        case 'assets':
          rangoClear = "Integraciones_Sponsorship!H2:H";
          rangoUpdate = `Integraciones_Sponsorship!H2:H${Math.max(items.length + 1, 2)}`;
          values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
          break;

        case 'agentes':
          rangoClear = "Integraciones_Sponsorship!J2:J";
          rangoUpdate = `Integraciones_Sponsorship!J2:J${Math.max(items.length + 1, 2)}`;
          values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
          break;

        case 'estados':
          rangoClear = "Integraciones_Sponsorship!L2:L";
          rangoUpdate = `Integraciones_Sponsorship!L2:L${Math.max(items.length + 1, 2)}`;
          values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
          break;

        case 'etapas':
          rangoClear = "Integraciones_Sponsorship!N2:N";
          rangoUpdate = `Integraciones_Sponsorship!N2:N${Math.max(items.length + 1, 2)}`;
          values = items.map(item => [typeof item === 'object' ? (item.nombre || item.valor) : String(item)]);
          break;

        default:
          return { success: false, message: `Sección no reconocida: ${seccion}` };
      }

      // 1. Limpiar el rango antiguo de la columna en Integraciones_Sponsorship
      const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(rangoClear)}:clear`;
      await fetch(clearUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      // 2. Escribir los nuevos valores
      if (values.length > 0) {
        const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(rangoUpdate)}?valueInputOption=USER_ENTERED`;
        const resUpdate = await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: rangoUpdate,
            values
          })
        });

        if (!resUpdate.ok) {
          const errText = await resUpdate.text();
          throw new Error(`Error en Google Sheets API [${resUpdate.status}]: ${errText}`);
        }
      }

      // 3. Recargar catálogos en memoria y cache
      await this.obtenerCatalogosSheet();

      console.log(`[SheetsService] Sección "${seccion}" actualizada en Google Sheets (hoja Integraciones_Sponsorship).`);
      return { success: true, message: `Columna "${seccion}" sincronizada con éxito en Integraciones_Sponsorship.` };
    } catch (err: any) {
      console.error(`[SheetsService] Error guardando sección ${seccion}:`, err);
      return { success: false, message: err.message };
    }
  }
}

export const sheetsBackendService = new SheetsService();
