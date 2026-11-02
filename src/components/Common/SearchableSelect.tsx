import React, { useState, useRef, useEffect, useMemo } from 'react';

export interface OptionItem {
  label: string;
  value: string;
  extra?: string;
  badge?: string;
  contactos?: string;
}

export interface SearchableSelectProps {
  label?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | OptionItem)[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  onVerContactos?: (opcion: OptionItem) => void;
}

export default function SearchableSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder = 'Seleccione una opción...',
  searchPlaceholder = 'Buscar...',
  className = '',
  disabled = false,
  onVerContactos
}: SearchableSelectProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  // Normalizar opciones
  const opcionesNormalizadas: OptionItem[] = useMemo(() => {
    return options.map(op => {
      if (typeof op === 'string') {
        return { label: op, value: op };
      }
      return op;
    });
  }, [options]);

  // Si el valor actual no está en la lista pero tiene valor, agregarlo al inicio
  const opcionesCompletas = useMemo(() => {
    if (!value || value.trim() === '') return opcionesNormalizadas;
    const existe = opcionesNormalizadas.some(
      o => o.value.toLowerCase().trim() === value.toLowerCase().trim()
    );
    if (!existe) {
      return [{ label: value, value: value }, ...opcionesNormalizadas];
    }
    return opcionesNormalizadas;
  }, [opcionesNormalizadas, value]);

  // Filtrado reactivo en tiempo real
  const opcionesFiltradas = useMemo(() => {
    const term = busqueda.toLowerCase().trim();
    if (!term) return opcionesCompletas;
    return opcionesCompletas.filter(op =>
      op.label.toLowerCase().includes(term) ||
      (op.extra && op.extra.toLowerCase().includes(term))
    );
  }, [opcionesCompletas, busqueda]);

  // Etiqueta del valor seleccionado actualmente
  const etiquetaSeleccionada = useMemo(() => {
    const encontrada = opcionesCompletas.find(
      o => o.value.toLowerCase().trim() === (value || '').toLowerCase().trim()
    );
    return encontrada ? encontrada.label : value;
  }, [opcionesCompletas, value]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setAbierto(false);
        setBusqueda('');
      }
    }
    if (abierto) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [abierto]);

  // Auto-focus en el buscador al abrir
  useEffect(() => {
    if (abierto && inputBusquedaRef.current) {
      inputBusquedaRef.current.focus();
    }
  }, [abierto]);

  const seleccionarOpcion = (val: string) => {
    onChange(val);
    setAbierto(false);
    setBusqueda('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="text-[#B3B3B3] block mb-1 font-medium text-xs sm:text-sm">{label}</label>}

      {/* Botón visual que simula el selector */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setAbierto(!abierto);
        }}
        className={`w-full bg-slate-100 dark:bg-[#121212] border ${
          abierto 
            ? 'border-[#E85A80] ring-1 ring-pink-500/50 bg-white dark:bg-[#1A1A1E]' 
            : 'border-slate-300 dark:border-[#3A3A3E] hover:border-slate-400 dark:hover:border-slate-500'
        } rounded-lg p-2.5 text-left text-sm flex items-center justify-between transition-all focus:outline-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span className={`truncate ${value ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-500 dark:text-gray-400'}`}>
          {etiquetaSeleccionada || placeholder}
        </span>
        <span className="ml-2 text-slate-600 dark:text-gray-400 text-xs shrink-0 transition-transform duration-200">
          {abierto ? '▲' : '▼'}
        </span>
      </button>

      {/* Menú desplegable flotante con buscador */}
      {abierto && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#1A1A1E] border border-slate-300 dark:border-[#3A3A3E] rounded-xl shadow-2xl overflow-hidden animate-fadeIn text-slate-900 dark:text-white">
          {/* Campo buscador */}
          <div className="p-2 border-b border-slate-200 dark:border-[#3A3A3E] bg-slate-100 dark:bg-[#121212] flex items-center gap-2">
            <span className="text-slate-600 dark:text-gray-400 text-xs">🔍</span>
            <input
              ref={inputBusquedaRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent text-slate-900 dark:text-white font-semibold text-xs placeholder-slate-500 dark:placeholder-gray-400 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setAbierto(false);
                  setBusqueda('');
                } else if (e.key === 'Enter' && opcionesFiltradas.length > 0) {
                  e.preventDefault();
                  seleccionarOpcion(opcionesFiltradas[0].value);
                }
              }}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white text-xs px-1 font-bold"
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          {/* Lista de opciones filtradas */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-gray-800 text-xs custom-scrollbar">
            {opcionesFiltradas.length === 0 ? (
              <div className="p-3 text-center text-slate-500 dark:text-gray-400 italic">
                No se encontraron coincidencias para &quot;{busqueda}&quot;
              </div>
            ) : (
              opcionesFiltradas.map((op, idx) => {
                const esSeleccionado = (value || '').toLowerCase().trim() === op.value.toLowerCase().trim();
                return (
                  <div
                    key={`${op.value}-${idx}`}
                    onClick={() => seleccionarOpcion(op.value)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                      esSeleccionado
                        ? 'bg-pink-100 dark:bg-pink-950/80 text-[#db2777] dark:text-[#E85A80] font-bold'
                        : 'text-slate-800 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#2C2C32] hover:text-slate-900 dark:hover:text-white font-medium'
                    }`}
                  >
                    <span className="truncate">{op.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {op.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          op.badge === 'SI' 
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700' 
                            : 'bg-slate-200 dark:bg-[#2C2C32] text-slate-700 dark:text-gray-300'
                        }`}>
                          {op.badge}
                        </span>
                      )}
                      {onVerContactos && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onVerContactos(op);
                          }}
                          className="p-1 hover:bg-pink-100 dark:hover:bg-pink-900/60 text-[#db2777] dark:text-[#F46C8E] rounded transition cursor-pointer text-xs flex items-center justify-center border border-pink-200 dark:border-pink-800"
                          title={`Ver contactos de ${op.label}`}
                        >
                          ↗️
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer de ayuda rápida */}
          <div className="px-3 py-1.5 bg-slate-100 dark:bg-[#121212] border-t border-slate-200 dark:border-[#3A3A3E] text-[10px] text-slate-600 dark:text-[#B3B3B3] flex justify-between items-center font-medium">
            <span>{opcionesFiltradas.length} opciones disponibles</span>
            <span>Esc para cerrar</span>
          </div>
        </div>
      )}
    </div>
  );
}
