import React, { useState, useMemo } from 'react';
import { 
  LISTA_PAISES,
  LISTA_OPORTUNIDADES,
  LISTA_ASSETS,
  LISTA_ESTADOS,
  LISTA_ETAPAS,
  LISTA_TIENE_INICIO,
  LISTA_AGENTES,
  obtenerSponsorship
} from '../../data/catalogoOnboarding';
import { formatearFechaHora, resolverOportunidad } from '../../utils/onboardingRules';
import SearchableSelect, { OptionItem } from '../Common/SearchableSelect';
import ModalContactosIntegracion from '../Common/ModalContactosIntegracion';

export interface CasoFormProps {
  formulario: {
    casoOp?: string;
    vendorId?: string;
    tienda?: string;
    pais?: string;
    kam?: string;
    integracion?: string;
    oportunidad?: string;
    asset?: string;
    propietarioOportunidad?: string;
    propietarioTicket?: string;
    casoSeguimiento?: string;
    tieneCasoInicio?: string;
    fechaCreacion?: string;
    sla_inicio?: string;
    estado?: string;
    etapa?: string;
    comentarios?: string;
    [key: string]: any;
  };
  onChange: (e: any) => void;
  onGuardar: () => void;
  onLimpiar?: () => void;
  onError?: (msg: string) => void;
  nombreUsuario?: string;
  puedeRegistrar?: boolean;
  integraciones?: string[];
  integracionesDetalle?: Array<{ nombre: string; sponsorship: string; contactos?: string }>;
  correosOnboarding?: string[];
  paises?: string[];
  oportunidades?: string[];
  assets?: string[];
  estados?: string[];
  etapas?: string[];
  agentes?: string[];
}

export default function CasoForm({ 
  formulario, 
  onChange, 
  onGuardar, 
  onLimpiar,
  onError,
  nombreUsuario, 
  puedeRegistrar = true, 
  integraciones = [],
  integracionesDetalle = [],
  correosOnboarding = [],
  paises = LISTA_PAISES,
  oportunidades = LISTA_OPORTUNIDADES,
  assets = LISTA_ASSETS,
  estados = LISTA_ESTADOS,
  etapas = LISTA_ETAPAS,
  agentes = LISTA_AGENTES
}: CasoFormProps) {
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState<boolean>(false);
  const [modalContactosAbierto, setModalContactosAbierto] = useState<boolean>(false);
  const [integracionParaContactos, setIntegracionParaContactos] = useState<string>('');
  const [kamCopiado, setKamCopiado] = useState<boolean>(false);

  if (!puedeRegistrar) {
    return (
      <div className="bg-amber-950/30 border border-amber-800 rounded-xl p-4 text-amber-400 text-sm flex items-center gap-2">
        <span>⚠️</span> No tienes permisos para registrar nuevos casos.
      </div>
    );
  }

  // Lista de opciones enriquecidas con contactos
  const listaIntegracionesOpciones: OptionItem[] = useMemo(() => {
    if (Array.isArray(integracionesDetalle) && integracionesDetalle.length > 0) {
      return integracionesDetalle.map(i => ({
        label: i.nombre,
        value: i.nombre,
        badge: i.sponsorship,
        contactos: i.contactos || ''
      }));
    }
    return integraciones.map(i => ({
      label: i,
      value: i,
      badge: obtenerSponsorship(i),
      contactos: ''
    }));
  }, [integracionesDetalle, integraciones]);

  const sponsorshipActual = obtenerSponsorship(formulario.integracion || '');

  // Buscar detalle de contactos para la integración seleccionada o abierta
  const integracionObjetivoNombre = integracionParaContactos || formulario.integracion || '';
  const integracionEncontrada = useMemo(() => {
    if (!integracionObjetivoNombre) return null;
    return integracionesDetalle.find(
      i => i.nombre.toLowerCase().trim() === integracionObjetivoNombre.toLowerCase().trim()
    );
  }, [integracionesDetalle, integracionObjetivoNombre]);

  const [alertaFaltantes, setAlertaFaltantes] = useState<string | null>(null);

  const intentarGuardar = () => {
    const faltantes = [];
    if (!formulario.pais) faltantes.push('País');
    if (!formulario.integracion) faltantes.push('Integración');
    if (!formulario.oportunidad) faltantes.push('Oportunidad');
    if (!formulario.asset) faltantes.push('Asset');
    if (!formulario.estado) faltantes.push('Estado del caso');
    if (!formulario.etapa) faltantes.push('Etapa del onboarding');
    if (!formulario.tieneCasoInicio) faltantes.push('¿Tiene caso en inicio?');

    if (faltantes.length > 0) {
      setAlertaFaltantes(`Faltan completar: ${faltantes.join(', ')}`);
      // auto hide after 7 seconds
      setTimeout(() => setAlertaFaltantes(null), 7000);
      return;
    }

    if (!formulario.casoOp || !String(formulario.casoOp).trim()) {
      onGuardar();
      return;
    }
    setMostrarConfirmacion(true);
  };

  return (
    <div className="bg-[#202024] border border-[#3A3A3E] rounded-xl p-5 shadow-lg relative">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-[#3A3A3E] pb-2">
        <h3 className="text-lg font-bold text-white">Registrar Nuevo Caso</h3>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 flex items-center gap-1.5">
          <span>📊</span>
          <span>Google Sheets oficial</span>
        </span>
      </div>

      {alertaFaltantes && (
        <div className="bg-rose-950/90 border-l-4 border-rose-500 p-4 rounded-r-lg shadow-xl mb-4 flex items-start gap-3 animate-slideRight">
          <div className="text-rose-400 text-xl">🚨</div>
          <div>
            <h4 className="text-rose-400 font-bold text-sm">Faltan datos obligatorios</h4>
            <p className="text-rose-200/80 text-xs mt-1">{alertaFaltantes}</p>
          </div>
        </div>
      )}
      
      <form autoComplete="new-password" onSubmit={(e) => { e.preventDefault(); intentarGuardar(); }} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="text-[#B3B3B3] block mb-1 font-medium">a. N° Caso OP *</label>
          <input 
            type="text" 
            name="casoOp" 
            value={formulario.casoOp || ''} 
            onChange={onChange} 
            autoComplete="new-password"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-[#121212] border border-[#3A3A3E] rounded-lg p-2.5 text-[#F46C8E] font-mono focus:border-[#E85A80] min-h-[44px]" 
            placeholder="Ej: OP-12345 (o dejar vacío para Sin OP)" 
          />
        </div>

        <div>
          <label className="text-[#B3B3B3] block mb-1 font-medium">b. Vendor ID</label>
          <input 
            type="text" 
            name="vendorId" 
            value={formulario.vendorId || ''} 
            onChange={onChange} 
            autoComplete="new-password"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-[#121212] border border-[#3A3A3E] rounded-lg p-2.5 text-white font-mono focus:border-[#E85A80] min-h-[44px]" 
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-[#B3B3B3] block mb-1 font-medium">c. Tienda</label>
          <input 
            type="text" 
            name="tienda" 
            value={formulario.tienda || ''} 
            onChange={onChange} 
            autoComplete="new-password"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-[#121212] border border-[#3A3A3E] rounded-lg p-2.5 text-white focus:border-[#E85A80] font-medium min-h-[44px]" 
          />
        </div>

        <div>
          <label className="text-[#B3B3B3] block mb-1 font-medium">d. País *</label>
          <select name="pais" value={formulario.pais || ''} onChange={onChange} className="w-full bg-[#121212] border border-[#3A3A3E] rounded-lg p-2.5 text-white focus:border-[#E85A80] min-h-[44px]">
            <option value="" disabled>Seleccione país...</option>
            {paises.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[#B3B3B3] font-medium">e. KAM</label>
            {formulario.kam && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(formulario.kam || '');
                  setKamCopiado(true);
                  setTimeout(() => setKamCopiado(false), 2000);
                }}
                className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer flex items-center gap-1 border transition ${
                  kamCopiado ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-[#2C2C32] hover:bg-[#3A3A3E] text-cyan-300 border-cyan-800'
                }`}
                title="Copiar contacto del KAM"
              >
                <span>{kamCopiado ? '✅' : '📋'}</span>
                <span>{kamCopiado ? '¡Copiado!' : 'Copiar KAM'}</span>
              </button>
            )}
          </div>
          <input 
            type="text" 
            name="kam" 
            value={formulario.kam || ''} 
            onChange={onChange} 
            autoComplete="new-password"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ejemplo@pedidosya.com"
            className="w-full bg-[#121212] border border-[#3A3A3E] rounded-lg p-2.5 text-white focus:border-[#E85A80] min-h-[44px]" 
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
              <label className="text-[#B3B3B3] font-medium">f. Integración *</label>
              <button
                type="button"
                onClick={() => {
                  setIntegracionParaContactos(formulario.integracion || '');
                  setModalContactosAbierto(true);
                }}
                className="text-[10px] bg-pink-950/80 hover:bg-pink-900 text-pink-300 border border-pink-700/60 px-2 py-0.5 rounded flex items-center gap-1 transition cursor-pointer"
                title="Ver contactos de correo de esta integración"
              >
                <span>👥</span>
                <span>Contactos</span>
                <span>↗️</span>
              </button>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sponsorshipActual === 'SI' ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300' : 'bg-[#2C2C32]/80 border-[#3A3A3E] text-[#B3B3B3]'}`}>
              Sponsorship: {sponsorshipActual}
            </span>
          </div>
          <SearchableSelect
            name="integracion"
            value={formulario.integracion || ''}
            onChange={(val) => onChange({ target: { name: 'integracion', value: val } })}
            options={listaIntegracionesOpciones}
            onVerContactos={(op) => {
              setIntegracionParaContactos(op.value);
              setModalContactosAbierto(true);
            }}
            placeholder="Buscar integración..."
            searchPlaceholder="Escribe para buscar integración..."
          />
        </div>

        <div>
          <label className="text-[#B3B3B3] block mb-1 font-medium">g. Oportunidad *</label>
          <SearchableSelect
            name="oportunidad"
            value={formulario.oportunidad ? resolverOportunidad(formulario.oportunidad, oportunidades) : ''}
            onChange={(val) => onChange({ target: { name: 'oportunidad', value: val } })}
            options={oportunidades}
            placeholder="Buscar oportunidad..."
            searchPlaceholder="Filtrar oportunidad..."
          />
        </div>

        <div>
          <label className="text-[#B3B3B3] block mb-1 font-medium">h. Asset *</label>
          <select name="asset" value={formulario.asset || ''} onChange={onChange} className="w-full bg-[#121212] border border-[#3A3A3E] rounded-lg p-2.5 text-white focus:border-[#E85A80] min-h-[44px]">
            <option value="" disabled>Seleccione asset...</option>
            {assets.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[#F46C8E] block mb-1 font-semibold flex items-center justify-between">
            <span>i. Propietario Oportunidad</span>
            <span className="text-[10px] text-[#B3B3B3] font-normal">Auto</span>
          </label>
          <select name="propietarioOportunidad" value={formulario.propietarioOportunidad} onChange={onChange} className="w-full bg-[#121212] border border-pink-700/60 rounded-lg p-2.5 text-white focus:border-[#E85A80] font-medium min-h-[44px]">
            {agentes.map(ag => <option key={ag} value={ag}>{ag}</option>)}
            {formulario.propietarioOportunidad && !agentes.includes(formulario.propietarioOportunidad) && (
              <option value={formulario.propietarioOportunidad}>{formulario.propietarioOportunidad}</option>
            )}
          </select>
        </div>

        <div>
          <label className="text-[#B3B3B3] block mb-1 font-medium">j. Propietario Ticket (Editable)</label>
          <select name="propietarioTicket" value={formulario.propietarioTicket} onChange={onChange} className="w-full bg-[#121212] border border-[#3A3A3E] rounded-lg p-2.5 text-white focus:border-[#E85A80] font-medium min-h-[44px]">
            {agentes.map(ag => <option key={ag} value={ag}>{ag}</option>)}
            {formulario.propietarioTicket && !agentes.includes(formulario.propietarioTicket) && (
              <option value={formulario.propietarioTicket}>{formulario.propietarioTicket}</option>
            )}
          </select>
        </div>

        <div>
          <label className="text-[#B3B3B3] block mb-1 font-medium">k. N° Caso Seguimiento</label>
          <input 
            type="text" 
            name="casoSeguimiento" 
            value={formulario.casoSeguimiento || ''} 
            onChange={onChange} 
            autoComplete="new-password"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-[#121212] border border-[#3A3A3E] rounded-lg p-2.5 text-white focus:border-[#E85A80] font-mono min-h-[44px]" 
          />
        </div>

        <div>
          <label className="text-[#B3B3B3] block mb-1 font-medium">l. ¿Tiene caso en inicio? *</label>
          <select name="tieneCasoInicio" value={formulario.tieneCasoInicio || ''} onChange={onChange} className="w-full bg-[#121212] border border-[#3A3A3E] rounded-lg p-2.5 text-white min-h-[44px]">
            <option value="" disabled>Seleccione...</option>
            {LISTA_TIENE_INICIO.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[#B3B3B3] font-medium">p. Fecha y Hora de Creación</label>
            <div className="flex items-center gap-1">
              {formulario.fechaCreacion && (
                <button
                  type="button"
                  onClick={() => onChange({ target: { name: 'fechaCreacion', value: '' } })}
                  className="text-[10px] bg-[#2C2C32] hover:bg-[#3A3A3E] text-[#B3B3B3] hover:text-white px-1.5 py-0.5 rounded cursor-pointer border border-[#3A3A3E]"
                  title="Borrar fecha de creación"
                >
                  ✕ Borrar
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onChange({ target: { name: 'fechaCreacion', value: formatearFechaHora(new Date()) } });
                }}
                className="text-[10px] bg-pink-900/60 hover:bg-pink-800 text-pink-300 px-1.5 py-0.5 rounded cursor-pointer border border-pink-700/60"
                title="Estampar fecha y hora actual"
              >
                🕒 Ahora
              </button>
            </div>
          </div>
          <input 
            type="text" 
            name="fechaCreacion" 
            value={formulario.fechaCreacion || ''} 
            onChange={onChange} 
            autoComplete="new-password"
            autoCorrect="off"
            spellCheck={false}
            placeholder="DD/MM/YYYY HH:mm (Opcional, dejar vacía si es sin OP)" 
            className="w-full bg-[#121212] border border-[#3A3A3E] rounded-lg p-2.5 text-white font-mono min-h-[44px]" 
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[#B3B3B3] font-medium">r. Inicio de seguimiento OP (Fecha y Hora) *</label>
            <div className="flex items-center gap-1">
              {formulario.sla_inicio && (
                <button
                  type="button"
                  onClick={() => onChange({ target: { name: 'sla_inicio', value: '' } })}
                  className="text-[10px] bg-[#2C2C32] hover:bg-[#3A3A3E] text-[#B3B3B3] hover:text-white px-1.5 py-0.5 rounded cursor-pointer border border-[#3A3A3E]"
                  title="Borrar inicio de seguimiento"
                >
                  ✕ Borrar
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onChange({ target: { name: 'sla_inicio', value: formatearFechaHora(new Date()) } });
                }}
                className="text-[10px] bg-cyan-900/60 hover:bg-cyan-800 text-cyan-300 px-1.5 py-0.5 rounded cursor-pointer border border-cyan-700/60"
                title="Estampar fecha y hora actual"
              >
                🕒 Ahora
              </button>
            </div>
          </div>
          <input 
            type="text" 
            name="sla_inicio" 
            value={formulario.sla_inicio || ''} 
            onChange={onChange} 
            autoComplete="new-password"
            autoCorrect="off"
            spellCheck={false}
            placeholder="DD/MM/YYYY HH:mm (Auto por etapa si se deja vacía)" 
            className="w-full bg-[#121212] border border-[#3A3A3E] rounded-lg p-2.5 text-white font-mono min-h-[44px]" 
          />
        </div>

        <div>
          <label className="text-[#B3B3B3] block mb-1 font-medium">n. Estado del caso *</label>
          <select name="estado" value={formulario.estado || ''} onChange={onChange} className="w-full bg-[#121212] border border-[#3A3A3E] rounded-lg p-2.5 text-white focus:border-[#E85A80] min-h-[44px]">
            <option value="" disabled>Seleccione estado...</option>
            {estados.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="text-[#B3B3B3] block mb-1 font-medium">o. Etapa del onboarding *</label>
          <select name="etapa" value={formulario.etapa || ''} onChange={onChange} className="w-full bg-[#121212] border border-[#3A3A3E] rounded-lg p-2.5 text-white focus:border-[#E85A80] min-h-[44px]">
            <option value="" disabled>Seleccione etapa...</option>
            {etapas.map(et => <option key={et} value={et}>{et}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="text-[#B3B3B3] block mb-1 font-medium">m. Comentarios</label>
          <textarea 
            name="comentarios" 
            value={formulario.comentarios || ''} 
            onChange={onChange} 
            rows={2} 
            autoComplete="new-password"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-[#121212] border border-[#3A3A3E] rounded-lg p-2.5 text-white focus:border-[#E85A80]" 
            placeholder="Notas..." 
          />
        </div>
      </form>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#3A3A3E]/80 pt-4">
        {onLimpiar && (
          <button
            type="button"
            onClick={onLimpiar}
            className="bg-[#2C2C32] hover:bg-[#3A3A3E] text-[#D1D5DB] hover:text-white font-semibold py-2.5 px-4 rounded-lg text-sm border border-[#3A3A3E] transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Limpia los campos del caso manteniendo propietario y fechas"
          >
            <span>🧹</span> Limpiar formulario
          </button>
        )}
        <div className="flex-1" />
        <button onClick={intentarGuardar} className="bg-[#E85A80] hover:bg-[#D94F74] text-white font-bold py-2.5 px-6 rounded-lg text-base shadow-lg shadow-pink-900/30 transition cursor-pointer flex items-center gap-2 min-h-[44px]">
          <span>💾</span> Guardar Caso
        </button>
      </div>

      {/* Modal de Confirmación antes de Registrar */}
      {mostrarConfirmacion && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#202024] border border-[#3A3A3E] rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in">
            <div className="flex items-center gap-3 text-[#F46C8E] border-b border-[#3A3A3E] pb-3">
              <span className="text-2xl">📋</span>
              <div>
                <h4 className="text-base font-bold text-white">¿Confirmar registro de caso?</h4>
                <p className="text-[11px] text-[#B3B3B3]">Se registrará directamente en Google Sheets</p>
              </div>
            </div>

            <div className="bg-[#121212] p-3 rounded-lg border border-[#3A3A3E] text-xs space-y-2 font-mono">
              <div><span className="text-[#9CA3AF]">N° OP:</span> <span className="text-[#F46C8E] font-bold">{formulario.casoOp}</span></div>
              <div><span className="text-[#9CA3AF]">Tienda:</span> <span className="text-white">{formulario.tienda || '-'}</span> (ID: {formulario.vendorId || '-'})</div>
              <div><span className="text-[#9CA3AF]">País / KAM:</span> <span className="text-white">{formulario.pais} / {formulario.kam || '-'}</span></div>
              <div><span className="text-[#9CA3AF]">Integración:</span> <span className="text-cyan-300">{formulario.integracion}</span> (Sponsorship: {sponsorshipActual})</div>
              <div><span className="text-[#9CA3AF]">Oportunidad:</span> <span className="text-white">{formulario.oportunidad}</span></div>
              <div><span className="text-[#9CA3AF]">Etapa:</span> <span className="text-amber-300">{formulario.etapa}</span></div>
              <div><span className="text-[#9CA3AF]">Inicio Seguimiento:</span> <span className="text-emerald-400">{formulario.sla_inicio || formulario.fechaCreacion || 'Automático según etapa'}</span></div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMostrarConfirmacion(false)}
                className="px-4 py-2 rounded-lg bg-[#2C2C32] hover:bg-[#3A3A3E] text-[#D1D5DB] text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarConfirmacion(false);
                  onGuardar();
                }}
                className="px-5 py-2 rounded-lg bg-[#E85A80] hover:bg-[#F46C8E] text-white text-xs font-bold shadow-lg shadow-pink-900/40 cursor-pointer"
              >
                ✅ Sí, Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Contactos de la Integración */}
      {modalContactosAbierto && (
        <ModalContactosIntegracion
          integracionNombre={integracionObjetivoNombre}
          contactosRaw={integracionEncontrada?.contactos || ''}
          sponsorship={integracionEncontrada?.sponsorship || sponsorshipActual}
          onCerrar={() => setModalContactosAbierto(false)}
          correosOnboarding={correosOnboarding}
          kamEmail={formulario.kam || ''}
        />
      )}
    </div>
  );
}
