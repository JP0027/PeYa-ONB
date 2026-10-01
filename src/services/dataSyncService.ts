// dataSyncService.ts - Centralized sync between Firebase and Google Sheets
// 
// Architecture:
// - Firebase Firestore = real-time cache (onSnapshot for live updates)
// - Google Sheets = source of truth for metrics (via backend API)
// - Writes go to BOTH (Firebase first for speed, then Sheets in background)

import { collection, doc, setDoc, onSnapshot, query, where, getDocs, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import { procesarActualizacionCaso } from '../utils/onboardingRules';
import { analizarTiemposCaso } from '../utils/tiempoLaboral';

const COLLECTION_NAME = 'casos';
const BACKEND_URL = ''; // Uses same origin (Express serves both API and frontend)

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
  public casosCache: Map<string, Caso>; // casoOp -> caso object
  private unsubscribeFirestore: Unsubscribe | null;
  private syncInterval: any | null;
  private ultimaSync: Date | null;
  private isConnected: boolean;

  constructor() {
    this.listeners = new Set();
    this.casosCache = new Map();
    this.unsubscribeFirestore = null;
    this.syncInterval = null;
    this.ultimaSync = null;
    this.isConnected = false;
  }

  // Subscribe to real-time Firestore updates
  public suscribirCasos(callback: (casos: Caso[]) => void): () => void {
    this.listeners.add(callback);

    if (!this.unsubscribeFirestore) {
      const q = collection(db, COLLECTION_NAME);
      this.unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          this.isConnected = true;
          this.ultimaSync = new Date();
          
          snapshot.docs.forEach(docSnap => {
            const data = docSnap.data() as Caso;
            this.casosCache.set(docSnap.id, data);
          });
          
          this._notificarListeners();
        },
        (error) => {
          console.error("Firestore subscription error:", error);
          this.isConnected = false;
          this._notificarListeners();
        }
      );
    }

    // Call immediately with current cache
    callback(Array.from(this.casosCache.values()));

    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.unsubscribeFirestore) {
        this.unsubscribeFirestore();
        this.unsubscribeFirestore = null;
      }
    };
  }

  private _notificarListeners(): void {
    const casosList = Array.from(this.casosCache.values());
    this.listeners.forEach(cb => cb(casosList));
  }

  // Save a case to BOTH Firebase and Sheets
  public async guardarCaso(caso: Caso): Promise<Caso> {
    if (!caso || !caso.casoOp) {
      throw new Error("casoOp is required");
    }

    try {
      // 1. Validar y procesar con reglas de negocio
      const casoProcesado = procesarActualizacionCaso(
        this.casosCache.get(caso.casoOp) || {},
        caso
      );

      // 1. Actualizar Sheets (fuente de verdad)
      this._guardarEnSheets(casoProcesado).catch(err => {
        console.warn("Notice saving to Sheets:", err);
      });

      // 2. Guardar en Firebase en background (no bloquea si hay backoff delay)
      try {
        const docRef = doc(db, COLLECTION_NAME, casoProcesado.casoOp);
        setDoc(docRef, casoProcesado, { merge: true }).catch(() => {});
      } catch (_) {}

      return casoProcesado;
    } catch (error) {
      console.error("Error in guardarCaso:", error);
      throw error;
    }
  }

  private async _guardarEnSheets(caso: Caso): Promise<void> {
    const isNetlify = typeof window !== 'undefined' && (window.location.hostname.includes('netlify') || window.location.hostname.includes('app'));
    const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

    const urls = isNetlify && !isVercel
      ? ['https://pe-ya-onb.vercel.app/api/sheets/actualizar-caso', '/api/sheets/actualizar-caso']
      : ['/api/sheets/actualizar-caso', 'https://pe-ya-onb.vercel.app/api/sheets/actualizar-caso'];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
          body: JSON.stringify(caso)
        });
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json') && response.ok) {
          return;
        }
      } catch (error) {
        console.warn(`[dataSyncService] Error guardando en Sheets (${url}):`, error);
      }
    }
  }

  // Update an existing case
  public async actualizarCaso(casoOp: string, cambios: Partial<Caso>): Promise<Caso> {
    if (!casoOp) throw new Error("casoOp required for update");
    const casoActual = this.casosCache.get(casoOp) || {};
    const nuevoCaso = { ...casoActual, ...cambios, casoOp };
    return await this.guardarCaso(nuevoCaso);
  }

  // Search by vendor ID
  public async buscarPorVendorId(vendorId: string): Promise<Caso[]> {
    if (!vendorId) return [];

    // 1. Search in local cache first
    const results: Caso[] = [];
    for (const caso of this.casosCache.values()) {
      if (String(caso.vendorId) === String(vendorId)) {
        results.push(caso);
      }
    }
    
    if (results.length > 0) return results;

    // 2. Fallback to Firestore query
    try {
      const q = query(collection(db, COLLECTION_NAME), where("vendorId", "==", vendorId));
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(docSnap => docSnap.data() as Caso);
      return docs;
    } catch (error) {
      console.error("Error searching by vendorId:", error);
      return [];
    }
  }

  // Register a push/contact
  public async registrarPush(casoOp: string, tipoPush: string, agente: string): Promise<Caso> {
    const casoActual = this.casosCache.get(casoOp);
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

  // Load integrations from Sheets tab
  public async cargarIntegraciones(): Promise<Integracion[]> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/sheets/integraciones`);
      if (response.ok) {
        const data = await response.json();
        return data as Integracion[];
      }
      return [];
    } catch (error) {
      console.error("Error loading integrations:", error);
      return [];
    }
  }

  // Get all cases from cache
  public obtenerTodosCasos(): Caso[] {
    return Array.from(this.casosCache.values());
  }

  // Get sync status
  public obtenerEstadoSync(): SyncStatus {
    return { 
      isConnected: this.isConnected, 
      ultimaSync: this.ultimaSync, 
      totalCasos: this.casosCache.size 
    };
  }

  // Force sync from Sheets
  public async forzarSincronizacion(): Promise<void> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/sheets/casos`);
      if (response.ok) {
        const casos: Caso[] = await response.json();
        for (const caso of casos) {
          if (caso.casoOp) {
            const docRef = doc(db, COLLECTION_NAME, caso.casoOp);
            await setDoc(docRef, caso, { merge: true });
          }
        }
        this.ultimaSync = new Date();
      }
    } catch (error) {
      console.error("Error forzando sincronización:", error);
    }
  }

  // Cleanup
  public destruir(): void {
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.listeners.clear();
  }
}

export const dataSync = new DataSyncService();
