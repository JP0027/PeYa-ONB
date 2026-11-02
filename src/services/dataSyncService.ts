// dataSyncService.ts - Centralized sync for Google Sheets
//
// Architecture:
// - Google Sheets = single source of truth for cases and catalog (via API /api/sheets/casos)
// - Firebase Firestore = reserved strictly for user authentication & roles (usuarios_permitidos)
// - NO case or catalog data is stored in Firebase.

import { procesarActualizacionCaso } from '../utils/onboardingRules';
import { consultarCasosGoogleSheets, actualizarCasoEnSheets } from './googleSheetsService';

export interface Caso {
  id?: string;
  casoOp?: string;
  vendorId?: string;
  vendor_id?: string;
  [key: string]: any;
}

export interface SyncStatus {
  isConnected: boolean;
  ultimaSync: Date | null;
  totalCasos: number;
}

export interface Integracion {
  nombre: string;
  sponsorship: string;
}

class DataSyncService {
  private listeners: Set<(casos: Caso[]) => void>;
  public casosCache: Map<string, Caso>; // casoOp/id -> caso object
  private syncInterval: any | null;
  private ultimaSync: Date | null;
  private isConnected: boolean;

  constructor() {
    this.listeners = new Set();
    this.casosCache = new Map();
    this.syncInterval = null;
    this.ultimaSync = null;
    this.isConnected = false;
  }

  /**
   * Suscribe componentes a cambios en vivo de casos desde Google Sheets
   */
  public suscribirCasos(callback: (casos: Caso[]) => void): () => void {
    this.listeners.add(callback);

    // Cargar casos inmediatamente desde Google Sheets API
    this.refrescarDesdeSheets();

    // Iniciar intervalo de refresco cada 30 segundos
    if (!this.syncInterval) {
      this.syncInterval = setInterval(() => {
        this.refrescarDesdeSheets();
      }, 30000);
    }

    // Retornar inmediatamente lo que esté en caché local
    callback(Array.from(this.casosCache.values()));

    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
    };
  }

  public async refrescarDesdeSheets(): Promise<Caso[]> {
    try {
      const lista = await consultarCasosGoogleSheets();
      if (Array.isArray(lista) && lista.length > 0) {
        this.casosCache.clear();
        lista.forEach(caso => {
          const key = String(caso.casoOp || caso.id || caso.vendorId || '').trim();
          if (key) {
            this.casosCache.set(key, caso);
          }
        });
        this.isConnected = true;
        this.ultimaSync = new Date();
        this._notificarListeners();
      }
      return Array.from(this.casosCache.values());
    } catch (err) {
      console.warn('[dataSyncService] Error al refrescar desde Sheets:', err);
      this.isConnected = false;
      return Array.from(this.casosCache.values());
    }
  }

  private _notificarListeners(): void {
    const casosList = Array.from(this.casosCache.values());
    this.listeners.forEach(cb => cb(casosList));
  }

  /**
   * Guarda un caso de forma atómica ÚNICAMENTE en Google Sheets
   */
  public async guardarCaso(caso: Caso): Promise<Caso> {
    if (!caso) {
      throw new Error("Se requiere información del caso");
    }

    try {
      const key = String(caso.casoOp || caso.id || caso.vendorId || '').trim();
      const casoExistente = key ? this.casosCache.get(key) || {} : {};

      // 1. Validar y procesar con reglas de negocio
      const casoProcesado = procesarActualizacionCaso(casoExistente, caso);

      // 2. Guardar directamente en Google Sheets API (no guarda NADA en Firebase)
      const resSheets = await actualizarCasoEnSheets(casoProcesado);

      const casoFinal = {
        ...casoProcesado,
        filaNumero: resSheets?.filaNumero || casoProcesado.filaNumero
      };

      if (key) {
        this.casosCache.set(key, casoFinal);
      }
      this._notificarListeners();

      return casoFinal;
    } catch (error) {
      console.error("Error en guardarCaso:", error);
      throw error;
    }
  }

  /**
   * Actualiza un caso existente en Google Sheets
   */
  public async actualizarCaso(casoOp: string, cambios: Partial<Caso>): Promise<Caso> {
    if (!casoOp) throw new Error("Se requiere casoOp para actualizar");
    const key = String(casoOp).trim();
    const casoActual = this.casosCache.get(key) || {};
    const nuevoCaso = { ...casoActual, ...cambios, casoOp };
    return await this.guardarCaso(nuevoCaso);
  }

  /**
   * Busca casos por Vendor ID en la caché
   */
  public async buscarPorVendorId(vendorId: string): Promise<Caso[]> {
    if (!vendorId) return [];
    const results: Caso[] = [];
    for (const caso of this.casosCache.values()) {
      if (String(caso.vendorId || caso.vendor_id) === String(vendorId)) {
        results.push(caso);
      }
    }
    return results;
  }

  /**
   * Registra un push / seguimiento de POS o Catálogo en Google Sheets
   */
  public async registrarPush(casoOp: string, tipoPush: string, agente: string): Promise<Caso> {
    const key = String(casoOp).trim();
    const casoActual = this.casosCache.get(key);
    if (!casoActual) throw new Error("Caso no encontrado");

    const ahora = new Date().toISOString();
    const pushRegistro = {
      fecha: ahora,
      tipo: tipoPush,
      agente: agente || 'Sistema'
    };

    const historialPush = Array.isArray(casoActual.historialPush)
      ? [...casoActual.historialPush, pushRegistro]
      : [pushRegistro];

    const cambios: Partial<Caso> = { historialPush };
    if (tipoPush === 'pos_api') cambios.fechaPushPos = ahora;
    if (tipoPush === 'catalogo') cambios.fechaPushCat = ahora;

    return await this.actualizarCaso(casoOp, cambios);
  }

  /**
   * Carga la lista de integraciones desde Google Sheets
   */
  public async cargarIntegraciones(): Promise<Integracion[]> {
    try {
      const response = await fetch('/api/sheets/integraciones');
      if (response.ok) {
        const data = await response.json();
        return (data.integraciones || []) as Integracion[];
      }
      return [];
    } catch (error) {
      console.error("Error al cargar integraciones desde Sheets:", error);
      return [];
    }
  }

  public obtenerTodosCasos(): Caso[] {
    return Array.from(this.casosCache.values());
  }

  public obtenerEstadoSync(): SyncStatus {
    return {
      isConnected: this.isConnected,
      ultimaSync: this.ultimaSync,
      totalCasos: this.casosCache.size
    };
  }

  public async forzarSincronizacion(): Promise<void> {
    await this.refrescarDesdeSheets();
  }

  public destruir(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.listeners.clear();
  }
}

export const dataSync = new DataSyncService();
