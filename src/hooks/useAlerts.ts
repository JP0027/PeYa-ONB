import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { analizarAlertasCaso } from '../utils/onboardingRules';

const AUDIO_PATH = '/ding.mp3';
const SILENCIADOS_KEY = 'peya_onb_alertas_silenciadas';

export function useAlerts(casos: any[] = []) {
  const [alertasSilenciadas, setAlertasSilenciadas] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(SILENCIADOS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(AUDIO_PATH);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const silenciarAlerta = useCallback((casoOp: string) => {
    setAlertasSilenciadas(prev => {
      const newState = { ...prev, [casoOp]: Date.now() };
      localStorage.setItem(SILENCIADOS_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  const { casosConAlertas, alertasPendientes } = useMemo(() => {
    const list = casos.map(caso => {
      const analisis = analizarAlertasCaso(caso);
      return { ...caso, ...analisis };
    });

    // Filtramos casos activos que necesiten atención
    const filtrados = list.filter(c => c.esActivo && (c.requierePushPos || c.requierePushCat || c.horasTranscurridas >= 4));

    // Ordenamiento por gravedad SLA:
    // 96h+ primero, luego 24-96h, luego 4-6h, luego 0-4h
    filtrados.sort((a, b) => {
      if (a.esCritico && !b.esCritico) return -1;
      if (!a.esCritico && b.esCritico) return 1;
      if (a.esProximoVencer && !b.esProximoVencer) return -1;
      if (!a.esProximoVencer && b.esProximoVencer) return 1;
      if (a.esAtencion && !b.esAtencion) return -1;
      if (!a.esAtencion && b.esAtencion) return 1;
      return b.horasTranscurridas - a.horasTranscurridas; // Mayor horas primero si misma categoría
    });

    const pendientes = filtrados.filter(c => !alertasSilenciadas[c.casoOp]);

    return { casosConAlertas: filtrados, alertasPendientes: pendientes };
  }, [casos, alertasSilenciadas]);

  useEffect(() => {
    if (alertasPendientes.length > 0) {
      // Reproducir sonido para el de mayor prioridad
      const topAlert = alertasPendientes[0] as any;
      if (audioRef.current) {
        // Sonido urgente si es crítico (>=96h)
        audioRef.current.playbackRate = topAlert.esCritico ? 1.5 : 1.0;
        audioRef.current.play().catch(e => console.log('Audio autoplay blocked:', e));
      }

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Alerta de Onboarding', {
          body: `El caso ${topAlert.casoOp} (${topAlert.nombreRestaurante}) requiere atención (${topAlert.tiempoTexto}).`,
          icon: '/favicon.ico'
        });
      }
    }
  }, [alertasPendientes]);

  return {
    casosConAlertas,
    alertasPendientes,
    silenciarAlerta
  };
}
