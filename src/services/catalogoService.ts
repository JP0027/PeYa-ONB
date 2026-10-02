/**
 * catalogoService.ts
 * Servicio centralizado para gestionar y sincronizar los catálogos de opciones
 * (Países, Oportunidades, Assets, Estados, Etapas, Integraciones)
 * Permite que los administradores editen los valores en tiempo real vía Firebase Firestore
 * sin tener que modificar el código fuente.
 */

import { doc, getDoc, setDoc, onSnapshot, Unsubscribe, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import {
  LISTA_PAISES,
  LISTA_OPORTUNIDADES,
  LISTA_ASSETS,
  LISTA_ESTADOS,
  LISTA_ETAPAS,
  MAPA_INTEGRACIONES_SPONSORSHIP
} from '../data/catalogoOnboarding';
import CATALOGOS_CACHE from '../../data_cached_catalogos.json';

const STORAGE_KEY = 'peya_catalogos_personalizados';
const FIRESTORE_DOC_PATH = ['configuracion', 'catalogos'];

export interface IntegracionSponsorship {
  nombre: string;
  sponsorship: string;
}

export interface CatalogosPorDefecto {
  paises: string[];
  oportunidades: string[];
  assets: string[];
  estados: string[];
  etapas: string[];
  integraciones: IntegracionSponsorship[];
  agentes?: string[];
  roles?: string[];
}

export const CATALOGOS_POR_DEFECTO: CatalogosPorDefecto = {
  paises: CATALOGOS_CACHE?.paises || [...LISTA_PAISES],
  oportunidades: CATALOGOS_CACHE?.oportunidades || [...LISTA_OPORTUNIDADES],
  assets: CATALOGOS_CACHE?.assets || [...LISTA_ASSETS],
  estados: CATALOGOS_CACHE?.estados || [...LISTA_ESTADOS],
  etapas: CATALOGOS_CACHE?.etapas || [...LISTA_ETAPAS],
  roles: ['Agente', 'Supervisor', 'Supervisor / TL'],
  agentes: (CATALOGOS_CACHE?.agentes && CATALOGOS_CACHE.agentes.length > 0) ? CATALOGOS_CACHE.agentes : [
    'Prisila Leon',
    'Joel Tocas',
    'Yadira Flores',
    'Comercial',
    'Sin asignación',
    'Jean Palomino',
    'Jean Changanaqui',
    'Guillermo Gonzales'
  ],
  integraciones: (CATALOGOS_CACHE?.integraciones as any) || Object.entries(MAPA_INTEGRACIONES_SPONSORSHIP).map(([nombre, sponsorship]) => ({
    nombre,
    sponsorship: String(sponsorship).toUpperCase() === 'SI' ? 'SI' : 'NO'
  }))
};

/**
 * Obtiene los catálogos en caché local o por defecto
 */
export function obtenerCatalogosLocales(): CatalogosPorDefecto {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Si la caché local tiene menos integraciones que los datos actualizados embebidos, actualizarla
      const integracionesLocales = (parsed.integraciones?.length && parsed.integraciones.length >= CATALOGOS_POR_DEFECTO.integraciones.length)
        ? parsed.integraciones
        : CATALOGOS_POR_DEFECTO.integraciones;

      return {
        paises: parsed.paises?.length ? parsed.paises : CATALOGOS_POR_DEFECTO.paises,
        oportunidades: parsed.oportunidades?.length ? parsed.oportunidades : CATALOGOS_POR_DEFECTO.oportunidades,
        assets: parsed.assets?.length ? parsed.assets : CATALOGOS_POR_DEFECTO.assets,
        estados: parsed.estados?.length ? parsed.estados : CATALOGOS_POR_DEFECTO.estados,
        etapas: parsed.etapas?.length ? parsed.etapas : CATALOGOS_POR_DEFECTO.etapas,
        integraciones: integracionesLocales,
        agentes: (Array.isArray(parsed.agentes) && parsed.agentes.length > 0) ? parsed.agentes : (CATALOGOS_POR_DEFECTO.agentes || []),
        roles: (Array.isArray(parsed.roles) && parsed.roles.length > 0) ? parsed.roles : (CATALOGOS_POR_DEFECTO.roles || [])
      };
    }
  } catch (err) {
    console.warn('[catalogoService] Error leyendo localStorage:', err);
  }
  return { ...CATALOGOS_POR_DEFECTO };
}

/**
 * Consulta los catálogos en vivo directamente desde la hoja Integraciones_Sponsorship
 */
export async function consultarCatalogosGoogleSheets(): Promise<CatalogosPorDefecto | null> {
  const isNetlify = typeof window !== 'undefined' && window.location.hostname.includes('netlify');

  const urlsAIntentar = isNetlify
    ? ['https://pe-ya-onb.vercel.app/api/sheets/catalogos', '/api/sheets/catalogos']
    : ['/api/sheets/catalogos', 'https://pe-ya-onb.vercel.app/api/sheets/catalogos'];

  for (const baseUrl of urlsAIntentar) {
    try {
      const separator = baseUrl.includes('?') ? '&' : '?';
      const url = `${baseUrl}${separator}_t=${Date.now()}`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        continue;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.catalogos) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.catalogos));
          } catch (_) {}
          guardarCatalogosEnFirestore(data.catalogos).catch(() => {});
          return data.catalogos;
        }
      }
    } catch (err) {
      console.warn(`[catalogoService] Error consultando ${baseUrl}:`, err);
    }
  }
  return { ...CATALOGOS_POR_DEFECTO };
}

/**
 * Guarda una sección específica del catálogo impactando directamente en la hoja Integraciones_Sponsorship
 */
export async function guardarSeccionEnGoogleSheets(seccion: string, items: any[]): Promise<any> {
  const isNetlify = typeof window !== 'undefined' && window.location.hostname.includes('netlify');

  const urlsAIntentar = isNetlify
    ? [
        'https://pe-ya-onb.vercel.app/api/sheets/catalogos/guardar-seccion',
        '/api/sheets/catalogos/guardar-seccion',
        'https://pe-ya-onb.vercel.app/api/sheets/catalogos',
        '/api/sheets/catalogos'
      ]
    : [
        '/api/sheets/catalogos/guardar-seccion',
        '/api/sheets/catalogos',
        'https://pe-ya-onb.vercel.app/api/sheets/catalogos/guardar-seccion',
        'https://pe-ya-onb.vercel.app/api/sheets/catalogos'
      ];

  let ultimoError: any = null;

  for (const url of urlsAIntentar) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ seccion, items })
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        continue;
      }
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.catalogos) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.catalogos));
          } catch (_) {}
        }
        return data;
      } else {
        ultimoError = new Error(data.error || data.message || 'Error guardando en Google Sheets');
      }
    } catch (err) {
      ultimoError = err;
      console.warn(`[catalogoService] Intento en ${url} falló:`, err);
    }
  }

  throw ultimoError || new Error('No se pudo guardar la sección en Google Sheets');
}

/**
 * Se suscribe a los cambios del catálogo en Firestore y Google Sheets
 */
export function suscribirCatalogos(callback: (catalogos: CatalogosPorDefecto) => void): Unsubscribe {
  // 1. Entregar inmediatamente lo que haya en caché local
  callback(obtenerCatalogosLocales());

  // 2. Consultar Google Sheets (hoja Integraciones_Sponsorship)
  consultarCatalogosGoogleSheets().then(sheetsCat => {
    if (sheetsCat) {
      callback(sheetsCat);
    }
  });

  try {
    const docRef = doc(db, FIRESTORE_DOC_PATH[0], FIRESTORE_DOC_PATH[1]);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as DocumentData;
        const combinados: CatalogosPorDefecto = {
          paises: Array.isArray(data.paises) && data.paises.length ? data.paises : CATALOGOS_POR_DEFECTO.paises,
          oportunidades: Array.isArray(data.oportunidades) && data.oportunidades.length ? data.oportunidades : CATALOGOS_POR_DEFECTO.oportunidades,
          assets: Array.isArray(data.assets) && data.assets.length ? data.assets : CATALOGOS_POR_DEFECTO.assets,
          agentes: Array.isArray(data.agentes) && data.agentes.length ? data.agentes : (CATALOGOS_POR_DEFECTO.agentes || []),
          estados: Array.isArray(data.estados) && data.estados.length ? data.estados : CATALOGOS_POR_DEFECTO.estados,
          etapas: Array.isArray(data.etapas) && data.etapas.length ? data.etapas : CATALOGOS_POR_DEFECTO.etapas,
          roles: Array.isArray(data.roles) && data.roles.length ? data.roles : (CATALOGOS_POR_DEFECTO.roles || []),
          integraciones: Array.isArray(data.integraciones) && data.integraciones.length ? data.integraciones : CATALOGOS_POR_DEFECTO.integraciones
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(combinados));
        } catch (_) {}
        callback(combinados);
      }
    }, (error) => {
      console.warn('[catalogoService] Error en suscripción Firestore:', error);
    });

    return unsubscribe;
  } catch (err) {
    console.warn('[catalogoService] No se pudo inicializar listener Firestore:', err);
    return () => {};
  }
}

/**
 * Guarda los catálogos en Firestore y en localStorage
 */
export async function guardarCatalogosEnFirestore(nuevosCatalogos: CatalogosPorDefecto): Promise<{ success: boolean }> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevosCatalogos));
  } catch (_) {}

  try {
    const docRef = doc(db, FIRESTORE_DOC_PATH[0], FIRESTORE_DOC_PATH[1]);
    await setDoc(docRef, {
      ...nuevosCatalogos,
      actualizadoEn: new Date().toISOString()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('[catalogoService] Error guardando en Firestore:', error);
    throw error;
  }
}

/**
 * Restaura los catálogos a sus valores por defecto
 */
export async function restaurarCatalogosPorDefecto(): Promise<{ success: boolean }> {
  return await guardarCatalogosEnFirestore(CATALOGOS_POR_DEFECTO);
}

/**
 * Parsea un archivo o texto CSV para una categoría específica con validación de columnas
 */
export function parsearCSVCatalogo(textoCSV: string, categoria: string): any[] {
  if (!textoCSV || !textoCSV.trim()) {
    throw new Error('El archivo o texto CSV está vacío.');
  }

  const lineas = textoCSV
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lineas.length === 0) {
    throw new Error('No se detectaron líneas de datos en el CSV.');
  }

  // Detectar separador (coma o punto y coma)
  const primeraLinea = lineas[0];
  const separador = primeraLinea.includes(';') ? ';' : ',';

  // Si la primera línea es encabezado
  let inicio = 0;
  const encabezados = primeraLinea.split(separador).map(h => h.trim().toLowerCase().replace(/["']/g, ''));
  const esEncabezado = encabezados.some(h => ['nombre', 'valor', 'pais', 'oportunidad', 'asset', 'estado', 'etapa', 'integracion', 'sponsorship'].includes(h));

  if (esEncabezado) {
    inicio = 1;
  }

  if (categoria === 'integraciones') {
    // Validar estructura de integraciones: requiere 2 columnas: nombre, sponsorship
    const colNombreIdx = esEncabezado ? encabezados.findIndex(h => h.includes('nombre') || h.includes('integrac')) : 0;
    const colSponIdx = esEncabezado ? encabezados.findIndex(h => h.includes('sponsorship') || h.includes('descuento')) : 1;

    const items: IntegracionSponsorship[] = [];
    const setNombres = new Set<string>();

    for (let i = inicio; i < lineas.length; i++) {
      const fila = lineas[i].split(separador).map(c => c.trim().replace(/^["']|["']$/g, ''));
      const nombre = fila[colNombreIdx >= 0 ? colNombreIdx : 0];
      const sponRaw = fila[colSponIdx >= 0 ? colSponIdx : 1] || 'NO';

      if (!nombre) continue;

      const sponNormalizado = ['si', 'sí', 'true', 'verdadero', '1'].includes(String(sponRaw).toLowerCase().trim()) ? 'SI' : 'NO';

      if (!setNombres.has(nombre.toLowerCase())) {
        setNombres.add(nombre.toLowerCase());
        items.push({ nombre, sponsorship: sponNormalizado });
      }
    }

    if (items.length === 0) {
      throw new Error('No se encontraron registros válidos de integraciones en el CSV. Recuerda incluir las columnas: nombre, sponsorship');
    }

    return items;
  } else {
    // Categorías de lista simple (paises, oportunidades, assets, estados, etapas)
    const items: string[] = [];
    const setValores = new Set<string>();

    for (let i = inicio; i < lineas.length; i++) {
      const fila = lineas[i].split(separador).map(c => c.trim().replace(/^["']|["']$/g, ''));
      const valor = fila[0];

      if (!valor) continue;

      if (!setValores.has(valor.toLowerCase())) {
        setValores.add(valor.toLowerCase());
        items.push(valor);
      }
    }

    if (items.length === 0) {
      throw new Error(`No se encontraron registros válidos para la categoría ${categoria} en el CSV.`);
    }

    return items;
  }
}

/**
 * Exporta una categoría de catálogo a texto CSV
 */
export function exportarCatalogoCSV(categoria: string, valores: any[]): string {
  if (categoria === 'integraciones') {
    const encabezado = 'nombre,sponsorship\n';
    const filas = (valores || []).map(item => {
      const nombre = typeof item === 'object' ? item.nombre : item;
      const spon = typeof item === 'object' ? item.sponsorship : 'NO';
      const escapeNombre = nombre.includes(',') ? `"${nombre}"` : nombre;
      return `${escapeNombre},${spon}`;
    }).join('\n');
    return encabezado + filas;
  } else {
    const encabezado = 'valor\n';
    const filas = (valores || []).map(val => {
      const str = String(val);
      return str.includes(',') ? `"${str}"` : str;
    }).join('\n');
    return encabezado + filas;
  }
}
