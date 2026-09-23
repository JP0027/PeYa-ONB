import fs from 'fs';
import path from 'path';
import { JWT } from 'google-auth-library';

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
}

const SPREADSHEET_ID = process.env.VITE_GOOGLE_SHEET_ID || '1obGQuhQx0FcxdoHNYUMzGqOzLFalhA63W8ze1tygHkk';
const RANGO_HOJA = 'Onboarding_New!A3:AZ';

const POSIBLES_RUTAS_CREDENTIALS = [
  path.resolve(process.cwd(), 'service-account.json'),
  path.resolve(process.cwd(), 'peyatools2-f50f4f552cca.json'),
  path.resolve(process.cwd(), 'credentials.json'),
  path.resolve(process.cwd(), 'backend/credentials.json')
];

const CACHE_FILE_PATH = path.resolve(process.cwd(), 'data_cached_casos.json');

export class SheetsService {
  private jwtClient: JWT | null = null;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;
  private serviceAccountPath: string | null = null;
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
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(casos, null, 2), 'utf-8');
      console.log(`[SheetsService] Guardados ${casos.length} casos en cache local (${CACHE_FILE_PATH})`);
    } catch (e) {
      console.warn('[SheetsService] Error guardando cache local:', e);
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

  public tieneCredenciales(): boolean {
    return !!this.detectarCredenciales();
  }

  public getDetallesCredenciales(): { activa: boolean; email?: string; path?: string } {
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

  private async obtenerAuthToken(): Promise<string> {
    const ahora = Date.now();
    if (this.cachedToken && this.tokenExpiry > ahora + 60000) {
      return this.cachedToken;
    }

    const ruta = this.detectarCredenciales();
    if (!ruta) {
      throw new Error('No se encontró service-account.json ni credenciales de servicio en el servidor.');
    }

    const raw = fs.readFileSync(ruta, 'utf-8');
    const creds = JSON.parse(raw);

    // Limpieza estricta de private_key
    let privateKey = creds.private_key || creds.privateKey;
    if (typeof privateKey === 'string' && privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    this.jwtClient = new JWT({
      email: creds.client_email,
      key: privateKey,
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
    const colSeguimiento = findCol(h => h.includes('seguimiento'));
    const colPropOp = findCol(h => h.includes('propietario') && h.includes('oportunidad'));
    const colPropTicket = findCol(h => h.includes('herocare') || (h.includes('propietario') && h.includes('ticket')));
    const colTieneInicio = findCol(h => h.includes('onboarding inicial') || h.includes('inicio?'));
    const colComentarios = findCol(h => h.includes('comentario'));
    const colFechaCreacion = findCol(h => h.includes('creación') || h.includes('creacion'));
    const colEstado = findCol(h => h.includes('estado'));
    const colEtapa = findCol(h => h.includes('etapa'));
    const colSlaInicio = findCol(h => h.includes('inicio de seguimiento') || h.includes('sla'));

    const rows = matriz.slice(headerRowIdx + 1);
    const casos: CasoSheets[] = [];

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
      const casoSeguimiento = getVal(colSeguimiento >= 0 ? colSeguimiento : -1);
      const propietarioOportunidad = getVal(colPropOp >= 0 ? colPropOp : 9);
      const propietarioTicket = getVal(colPropTicket >= 0 ? colPropTicket : 10);
      const tieneCasoInicio = getVal(colTieneInicio >= 0 ? colTieneInicio : -1, 'Si');
      const comentarios = getVal(colComentarios >= 0 ? colComentarios : -1);
      const fechaCreacion = getVal(colFechaCreacion >= 0 ? colFechaCreacion : -1);
      const estado = getVal(colEstado >= 0 ? colEstado : -1, 'En progreso');
      const etapa = getVal(colEtapa >= 0 ? colEtapa : -1, 'Validación del Onboarding');
      const sla_inicio = getVal(colSlaInicio >= 0 ? colSlaInicio : -1, fechaCreacion || new Date().toISOString());

      const estadoLower = estado.toLowerCase();
      const esCerrado = estadoLower.includes('cerrado') || estadoLower.includes('fallido');
      const esActivo = !esCerrado && (estadoLower.includes('en progreso') || estadoLower.includes('nuevo') || estadoLower.includes('ticket hc'));

      casos.push({
        id: casoOp || vendorId || `CASO-${idx + 1}`,
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
        esActivo,
        origen: origenDesc,
        filaNumero: headerRowIdx + 2 + idx
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
      const casoMerged: CasoSheets = { 
        ...casoExistente, 
        ...casoActualizado,
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
        id: idBusqueda || `OP-${Date.now()}`,
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
        filaNumero: this.cachedCasosMemoria.length + 2,
        ...casoActualizado
      } as CasoSheets;

      this.cachedCasosMemoria.unshift(nuevo);
      this.guardarCasosCache(this.cachedCasosMemoria);
      return { success: true, caso: nuevo, message: `Caso ${idBusqueda} creado.` };
    }
  }

  /**
   * Descarga el rango dinámico Onboarding_New!A3:AZ completo y mapea las 1,760+ filas
   */
  public async obtenerTodasLasFilas(): Promise<CasoSheets[]> {
    // Si tenemos credenciales de servicio, consultar Google Sheets API
    if (this.tieneCredenciales()) {
      const token = await this.obtenerAuthToken();
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent('Onboarding_New!A2:AZ')}?valueRenderOption=FORMATTED_VALUE`;

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
}

export const sheetsBackendService = new SheetsService();
