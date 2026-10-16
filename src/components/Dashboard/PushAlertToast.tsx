import React, { useEffect, useState } from 'react';

export interface AlertaPush {
  id: string | number;
  titulo: string;
  hora: string;
  mensaje: string;
  casoId?: string;
  casoOp?: string;
  vendorId?: string;
  [key: string]: any;
}

export interface PushAlertItemProps {
  alerta: AlertaPush;
  onCerrar: (id: string | number) => void;
  onClic: (alerta: AlertaPush) => void;
}

/**
 * Toast individual de alerta Push
 * Fondo: #E8E8E8 con letras negras
 * Duración total: 30 segundos en pantalla
 */
export function PushAlertItem({ alerta, onCerrar, onClic }: PushAlertItemProps) {
  const [tiempoMs, setTiempoMs] = useState(0);
  const [hovered, setHovered] = useState(false);

  const duracionTotal = 30000; // 30 segundos totales
  const inicioDesvanecer = 25000; // Inicia a los 25 segundos
  const intervaloMs = 50;

  useEffect(() => {
    const timer = setInterval(() => {
      setTiempoMs((prev) => {
        if (hovered) return prev; // Pausa mientras el cursor esté encima
        const siguiente = prev + intervaloMs;
        if (siguiente >= duracionTotal) {
          clearInterval(timer);
          return duracionTotal;
        }
        return siguiente;
      });
    }, intervaloMs);

    return () => clearInterval(timer);
  }, [hovered, duracionTotal]);

  useEffect(() => {
    if (tiempoMs >= duracionTotal) {
      onCerrar(alerta.id);
    }
  }, [tiempoMs, duracionTotal, onCerrar, alerta.id]);

  const progreso = Math.max(0, 100 - (tiempoMs / duracionTotal) * 100);

  let opacidad = 1;
  let desplazamientoX = 0;
  if (!hovered && tiempoMs >= inicioDesvanecer) {
    const fraccion = Math.min(1, (tiempoMs - inicioDesvanecer) / (duracionTotal - inicioDesvanecer));
    opacidad = Math.max(0, 1 - fraccion);
    desplazamientoX = fraccion * 30;
  }

  return (
    <div
      onClick={() => onClic(alerta)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="bg-[#FFFBEB] dark:bg-[#202024]/95 border-2 border-amber-400 dark:border-amber-500/70 rounded-xl p-3.5 shadow-xl shadow-amber-900/10 dark:shadow-black/80 cursor-pointer relative overflow-hidden group select-none shrink-0 text-slate-900 dark:text-white"
      style={{
        minWidth: '320px',
        maxWidth: '380px',
        opacity: opacidad,
        transform: `translateX(${desplazamientoX}px)`,
        transition: hovered
          ? 'transform 0.15s ease, opacity 0.15s ease'
          : 'opacity 0.05s linear, transform 0.05s linear'
      }}
    >
      {/* Barra de progreso de 30 segundos */}
      <div
        className="absolute bottom-0 left-0 h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-pink-500 transition-all duration-75"
        style={{ width: `${progreso}%` }}
      />

      <div className="flex items-start justify-between gap-3">
        {/* Ícono circular amarillo con signo de exclamación */}
        <div className="w-5.5 h-5.5 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-sm border border-amber-500">
          !
        </div>

        {/* Textos del toast */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-amber-900 dark:text-amber-300 transition tracking-wide flex items-center gap-1.5">
              <span>{alerta.titulo}</span>
            </h4>
          </div>
          <p className="text-[11px] text-slate-800 dark:text-white font-extrabold mt-1 leading-snug">
            <span className="font-mono text-amber-800 dark:text-amber-300 font-black">{alerta.hora}</span> - <span className="text-slate-800 dark:text-gray-100 font-bold">{alerta.mensaje}</span>
          </p>
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-800 dark:text-amber-300 font-black">
            <span>👇 Clic para ubicar y sombrear en la lista</span>
          </div>
        </div>

        {/* Botón de cierre manual */}
        <button
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onCerrar(alerta.id);
          }}
          className="text-slate-500 hover:text-black dark:text-[#B3B3B3] dark:hover:text-white hover:bg-amber-200/80 dark:hover:bg-[#2C2C32] p-1 rounded transition text-xs shrink-0 cursor-pointer font-bold"
          title="Cerrar notificación"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export interface PushAlertContainerProps {
  alertas: AlertaPush[];
  onCerrarAlerta: (id: string | number) => void;
  onCerrarTodas?: () => void;
  onClicAlerta: (alerta: AlertaPush) => void;
}

/**
 * Contenedor flotante superior derecho para las alertas tipo modal/toast
 */
export default function PushAlertContainer({ alertas, onCerrarAlerta, onCerrarTodas, onClicAlerta }: PushAlertContainerProps) {
  if (!alertas || alertas.length === 0) return null;

  return (
    <div
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-auto max-h-[88vh] overflow-y-auto overflow-x-hidden pr-1 select-none no-scrollbar"
      style={{
        maxWidth: '400px',
        overflowX: 'hidden',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
    >
      {alertas.length > 2 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#FEF3C7] dark:bg-[#202024]/95 border-2 border-amber-400 dark:border-amber-500/70 rounded-xl text-xs text-amber-900 dark:text-amber-300 shadow-xl shrink-0 font-bold">
          <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
            <span>{alertas.length} alertas push pendientes</span>
          </div>
          {onCerrarTodas && (
            <button
              onClick={onCerrarTodas}
              className="text-[11px] text-slate-800 hover:text-black dark:text-[#B3B3B3] dark:hover:text-white bg-amber-200/80 hover:bg-amber-300 dark:bg-[#2C2C32] dark:hover:bg-[#3A3A3E] px-2 py-0.5 rounded transition cursor-pointer font-bold"
            >
              Cerrar todas
            </button>
          )}
        </div>
      )}
      {alertas.map((alerta) => (
        <PushAlertItem
          key={alerta.id}
          alerta={alerta}
          onCerrar={onCerrarAlerta}
          onClic={onClicAlerta}
        />
      ))}
    </div>
  );
}
