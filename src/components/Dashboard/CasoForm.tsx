import React, { useState } from 'react';
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
  nombreUsuario?: string;
  puedeRegistrar?: boolean;
  integraciones?: string[];
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
  nombreUsuario, 
  puedeRegistrar = true, 
  integraciones = [],
  paises = LISTA_PAISES,
  oportunidades = LISTA_OPORTUNIDADES,
  assets = LISTA_ASSETS,
  estados = LISTA_ESTADOS,
  etapas = LISTA_ETAPAS,
  agentes = LISTA_AGENTES
}: CasoFormProps) {
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState<boolean>(false);

  if (!puedeRegistrar) {
    return (
      <div className="bg-amber-950/30 border border-amber-800 rounded-xl p-4 text-amber-400 text-sm flex items-center gap-2">
        <span>⚠️</span> No tienes permisos para registrar nuevos casos.
      </div>
    );
  }

  const listaIntegraciones = integraciones.length > 0 ? integraciones : [];
  const sponsorshipActual = obtenerSponsorship(formulario.integracion || '');

  const intentarGuardar = () => {
    if (!formulario.casoOp || !String(formulario.casoOp).trim()) {
      onGuardar();
      return;
    }
    setMostrarConfirmacion(true);
  };

  return (
    <div className="bg-[#161925] border border-gray-800 rounded-xl p-5 shadow-lg relative">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-gray-800 pb-2">
        <h3 className="text-lg font-bold text-white">Registrar Nuevo Caso</h3>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-pink-950/50 border border-pink-800/60 text-pink-300 flex items-center gap-1.5">
          <span>🔥</span>
          <span>Sincronización dual: Firebase Firestore + Google Sheets</span>
        </span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="text-gray-400 block mb-1 font-medium">a. N° Caso OP *</label>
          <input type="text" name="casoOp" value={formulario.casoOp || ''} onChange={onChange} className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-pink-400 font-mono focus:border-pink-500" placeholder="Ej: OP-12345" />
        </div>

        <div>
          <label className="text-gray-400 block mb-1 font-medium">b. Vendor ID</label>
          <input type="text" name="vendorId" value={formulario.vendorId || ''} onChange={onChange} className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white font-mono focus:border-pink-500" />
        </div>

        <div className="sm:col-span-2">
          <label className="text-gray-400 block mb-1 font-medium">c. Tienda</label>
          <input type="text" name="tienda" value={formulario.tienda || ''} onChange={onChange} className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 font-medium" />
        </div>

        <div>
          <label className="text-gray-400 block mb-1 font-medium">d. País *</label>
          <select name="pais" value={formulario.pais} onChange={onChange} className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500">
            {paises.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="text-gray-400 block mb-1 font-medium">e. KAM</label>
          <input type="text" name="kam" value={formulario.kam || ''} onChange={onChange} className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500" />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-gray-400 font-medium">f. Integración *</label>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sponsorshipActual === 'SI' ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300' : 'bg-gray-800/80 border-gray-700 text-gray-400'}`}>
              Sponsorship: {sponsorshipActual}
            </span>
          </div>
          <select name="integracion" value={formulario.integracion} onChange={onChange} className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500">
            {listaIntegraciones.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div>
          <label className="text-gray-400 block mb-1 font-medium">g. Oportunidad</label>
          <select name="oportunidad" value={formulario.oportunidad} onChange={onChange} className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500">
            {oportunidades.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
        </div>

        <div>
          <label className="text-gray-400 block mb-1 font-medium">h. Asset *</label>
          <select name="asset" value={formulario.asset} onChange={onChange} className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500">
            {assets.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div>
          <label className="text-pink-400 block mb-1 font-semibold flex items-center justify-between">
            <span>i. Propietario Oportunidad</span>
            <span className="text-[10px] text-gray-400 font-normal">Auto</span>
          </label>
          <select name="propietarioOportunidad" value={formulario.propietarioOportunidad} onChange={onChange} className="w-full bg-[#0f111a] border border-pink-700/60 rounded-lg p-2.5 text-white focus:border-pink-500 font-medium">
            {agentes.map(ag => <option key={ag} value={ag}>{ag}</option>)}
            {formulario.propietarioOportunidad && !agentes.includes(formulario.propietarioOportunidad) && (
              <option value={formulario.propietarioOportunidad}>{formulario.propietarioOportunidad}</option>
            )}
          </select>
        </div>

        <div>
          <label className="text-gray-400 block mb-1 font-medium">j. Propietario Ticket (Editable)</label>
          <select name="propietarioTicket" value={formulario.propietarioTicket} onChange={onChange} className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 font-medium">
            {agentes.map(ag => <option key={ag} value={ag}>{ag}</option>)}
            {formulario.propietarioTicket && !agentes.includes(formulario.propietarioTicket) && (
              <option value={formulario.propietarioTicket}>{formulario.propietarioTicket}</option>
            )}
          </select>
        </div>

        <div>
          <label className="text-gray-400 block mb-1 font-medium">k. N° Caso Seguimiento</label>
          <input type="text" name="casoSeguimiento" value={formulario.casoSeguimiento || ''} onChange={onChange} className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 font-mono" />
        </div>

        <div>
          <label className="text-gray-400 block mb-1 font-medium">l. ¿Tiene caso en inicio?</label>
          <select name="tieneCasoInicio" value={formulario.tieneCasoInicio} onChange={onChange} className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white">
            {LISTA_TIENE_INICIO.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div>
          <label className="text-gray-400 block mb-1 font-medium">p. Fecha de Creación</label>
          <input type="text" name="fechaCreacion" value={formulario.fechaCreacion || ''} onChange={onChange} placeholder="DD/MM/YYYY HH:mm:ss" className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white font-mono" />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-gray-400 font-medium">r. Inicio de seguimiento OP</label>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                const fechaNow = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
                onChange({ target: { name: 'sla_inicio', value: fechaNow } });
              }}
              className="text-[10px] bg-cyan-900/60 hover:bg-cyan-800 text-cyan-300 px-1.5 py-0.5 rounded cursor-pointer border border-cyan-700/60"
              title="Estampar fecha y hora actual"
            >
              🕒 Ahora
            </button>
          </div>
          <input 
            type="text" 
            name="sla_inicio" 
            value={formulario.sla_inicio || ''} 
            onChange={onChange} 
            placeholder="DD/MM/YYYY HH:mm:ss (Auto por etapa)" 
            className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white font-mono" 
          />
        </div>

        <div>
          <label className="text-cyan-400 block mb-1 font-semibold">n. Estado del caso</label>
          <select name="estado" value={formulario.estado} onChange={onChange} className="w-full bg-[#0f111a] border border-cyan-700 rounded-lg p-2.5 text-cyan-300 font-bold">
            {estados.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="text-cyan-400 block mb-1 font-semibold">o. Etapa del onboarding</label>
          <select name="etapa" value={formulario.etapa} onChange={onChange} className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white">
            {etapas.map(et => <option key={et} value={et}>{et}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="text-gray-400 block mb-1 font-medium">m. Comentarios</label>
          <textarea name="comentarios" value={formulario.comentarios || ''} onChange={onChange} rows={2} className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500" placeholder="Notas..." />
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button onClick={intentarGuardar} className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm shadow-lg shadow-pink-900/30 transition cursor-pointer">
          💾 Guardar Caso
        </button>
      </div>

      {/* Modal de Confirmación antes de Registrar */}
      {mostrarConfirmacion && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161925] border border-gray-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in">
            <div className="flex items-center gap-3 text-pink-400 border-b border-gray-800 pb-3">
              <span className="text-2xl">📋</span>
              <div>
                <h4 className="text-base font-bold text-white">¿Confirmar registro de caso?</h4>
                <p className="text-[11px] text-gray-400">Se registrará en Google Sheets y Firebase</p>
              </div>
            </div>

            <div className="bg-[#0f111a] p-3 rounded-lg border border-gray-800 text-xs space-y-2 font-mono">
              <div><span className="text-gray-500">N° OP:</span> <span className="text-pink-400 font-bold">{formulario.casoOp}</span></div>
              <div><span className="text-gray-500">Tienda:</span> <span className="text-white">{formulario.tienda || '-'}</span> (ID: {formulario.vendorId || '-'})</div>
              <div><span className="text-gray-500">País / KAM:</span> <span className="text-white">{formulario.pais} / {formulario.kam || '-'}</span></div>
              <div><span className="text-gray-500">Integración:</span> <span className="text-cyan-300">{formulario.integracion}</span> (Sponsorship: {sponsorshipActual})</div>
              <div><span className="text-gray-500">Oportunidad:</span> <span className="text-white">{formulario.oportunidad}</span></div>
              <div><span className="text-gray-500">Etapa:</span> <span className="text-amber-300">{formulario.etapa}</span></div>
              <div><span className="text-gray-500">Inicio Seguimiento:</span> <span className="text-emerald-400">{formulario.sla_inicio || formulario.fechaCreacion || 'Automático según etapa'}</span></div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMostrarConfirmacion(false)}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarConfirmacion(false);
                  onGuardar();
                }}
                className="px-5 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-lg shadow-pink-900/40 cursor-pointer"
              >
                ✅ Sí, Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
