import { useState, useEffect, useCallback } from 'react';
import { dataSync } from '../services/dataSyncService';

export function useSync() {
  const [syncState, setSyncState] = useState(() => dataSync.obtenerEstadoSync());
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSyncState(dataSync.obtenerEstadoSync());
    }, 5000); // Poll status every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const forzarSync = useCallback(async () => {
    setSincronizando(true);
    try {
      await dataSync.forzarSincronizacion();
      setSyncState(dataSync.obtenerEstadoSync());
    } finally {
      setSincronizando(false);
    }
  }, []);

  return {
    isConnected: syncState.isConnected,
    ultimaSync: syncState.ultimaSync,
    sincronizando,
    forzarSync
  };
}
