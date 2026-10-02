import React, { useState, useRef, useEffect, useMemo } from 'react';

export interface OptionItem {
  label: string;
  value: string;
  extra?: string;
  badge?: string;
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
  disabled = false
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
      {label && <label className="text-gray-400 block mb-1 font-medium text-xs sm:text-sm">{label}</label>}

      {/* Botón visual que simula el selector */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setAbierto(!abierto);
        }}
        className={`w-full bg-[#0f111a] border ${
          abierto ? 'border-pink-500 ring-1 ring-pink-500/50' : 'border-gray-700 hover:border-gray-600'
        } rounded-lg p-2.5 text-left text-sm flex items-center justify-between transition-all focus:outline-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span className={`truncate ${value ? 'text-white font-medium' : 'text-gray-500'}`}>
          {etiquetaSeleccionada || placeholder}
        </span>
        <span className="ml-2 text-gray-400 text-xs shrink-0 transition-transform duration-200">
          {abierto ? '▲' : '▼'}
        </span>
      </button>

      {/* Menú desplegable flotante con buscador */}
      {abierto && (
        <div className="absolute z-50 mt-1 w-full bg-[#161925] border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fadeIn">
          {/* Campo buscador */}
          <div className="p-2 border-b border-gray-800 bg-[#12141e] flex items-center gap-2">
            <span className="text-gray-400 text-xs">🔍</span>
            <input
              ref={inputBusquedaRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-white text-xs placeholder-gray-500 focus:outline-none"
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
                className="text-gray-500 hover:text-gray-300 text-xs px-1"
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          {/* Lista de opciones filtradas */}
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-800/40 text-xs custom-scrollbar">
            {opcionesFiltradas.length === 0 ? (
              <div className="p-3 text-center text-gray-500 italic">
                No se encontraron coincidencias para &quot;{busqueda}&quot;
              </div>
            ) : (
              opcionesFiltradas.map((op, idx) => {
                const esSeleccionado = (value || '').toLowerCase().trim() === op.value.toLowerCase().trim();
                return (
                  <button
                    key={`${op.value}-${idx}`}
                    type="button"
                    onClick={() => seleccionarOpcion(op.value)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors ${
                      esSeleccionado
                        ? 'bg-pink-600/20 text-pink-300 font-semibold'
                        : 'text-gray-300 hover:bg-gray-800/70 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{op.label}</span>
                    {op.badge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        op.badge === 'SI' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {op.badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer de ayuda rápida */}
          <div className="px-3 py-1.5 bg-[#0e1017] border-t border-gray-800 text-[10px] text-gray-500 flex justify-between items-center">
            <span>{opcionesFiltradas.length} opciones disponibles</span>
            <span>Esc para cerrar</span>
          </div>
        </div>
      )}
    </div>
  );
}

