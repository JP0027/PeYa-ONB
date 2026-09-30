import { useState, useEffect, useMemo, useCallback } from 'react';
import { dataSync } from '../services/dataSyncService';

export function useCasos(filtroEmail: string | null = null) {
  const [casos, setCasos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let montado = true;
    
    const unsubscribe = dataSync.suscribirCasos((nuevosCasos: any[]) => {
      if (montado) {
        setCasos([...nuevosCasos]); // ensure new reference
        setCargando(false);
      }
    });

    return () => {
      montado = false;
      unsubscribe();
    };
  }, []);

  const casosFiltrados = useMemo(() => {
    let lista = casos;
    if (filtroEmail) {
      lista = lista.filter(c => c.kamAsignado === filtroEmail || c.onbAsignado === filtroEmail);
    }
    return lista;
  }, [casos, filtroEmail]);

  const casosActivos = useMemo(() => {
    return casosFiltrados.filter(c => c.esActivo !== false && !String(c.estado || '').toLowerCase().includes('cerrad'));
  }, [casosFiltrados]);

  const buscarPorId = useCallback((id: string) => {
    return casos.find(c => c.casoOp === id || c.vendorId === id);
  }, [casos]);

  const guardarCaso = useCallback(async (caso: any) => {
    return await dataSync.guardarCaso(caso);
  }, []);

  const actualizarCaso = useCallback(async (casoOp: string, cambios: any) => {
    return await dataSync.actualizarCaso(casoOp, cambios);
  }, []);

  const registrarPush = useCallback(async (casoOp: string, tipoPush: string, agente: string) => {
    return await dataSync.registrarPush(casoOp, tipoPush, agente);
  }, []);

  return {
    casos: casosFiltrados,
    casosActivos,
    cargando,
    error,
    buscarPorId,
    guardarCaso,
    actualizarCaso,
    registrarPush
  };
}
