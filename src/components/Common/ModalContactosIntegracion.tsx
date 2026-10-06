import React, { useState, useMemo } from 'react';

export interface ContactoParsed {
  original: string;
  email: string;
  etiqueta: string | null;
  esEmergencia: boolean;
}

/**
 * Extrae limpiamente la dirección de correo y separa cualquier etiqueta o rol asociado
 * (ej: "flex-dlv@fktech.net (Emergencia)" -> email: "flex-dlv@fktech.net", etiqueta: "Emergencia")
 * (ej: "Onboarding Argentina: Sofia.rodriguez1@ar.mcd.com" -> email: "Sofia.rodriguez1@ar.mcd.com", etiqueta: "Onboarding Argentina")
 */
export function parsearContacto(itemRaw: string): ContactoParsed {
  const original = String(itemRaw || '').trim();
  if (!original) {
    return { original: '', email: '', etiqueta: null, esEmergencia: false };
  }

  // Regex para detectar dirección de correo electrónico
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  const match = original.match(emailRegex);

  if (!match) {
    const esEmergencia = /emergenc/i.test(original);
    return {
      original,
      email: original,
      etiqueta: null,
      esEmergencia
    };
  }

  const email = match[1].trim();

  // Quitar el email del texto original para extraer la etiqueta limpia
  let resto = original.replace(match[0], '').replace(/[<>]/g, '').trim();

  // Limpiar caracteres de puntuación circundantes (dos puntos, guiones, paréntesis, corchetes, comillas)
  resto = resto
    .replace(/^[:\-\u2013\u2014\s\(\[\{"]+/, '')
    .replace(/[:\-\u2013\u2014\s\)\]\}"]+$/, '')
    .trim();

  const etiqueta = resto.length > 0 ? resto : null;
  const esEmergencia = Boolean(
    (etiqueta && /emergenc/i.test(etiqueta)) ||
    /emergenc/i.test(original)
  );

  return {
    original,
    email,
    etiqueta,
    esEmergencia
  };
}

export interface ModalContactosIntegracionProps {
  integracionNombre: string;
  contactosRaw?: string;
  sponsorship?: string;
  onCerrar: () => void;
  correosOnboarding?: string[];
  kamEmail?: string;
  onCopiarTexto?: (txt: string, mensaje?: string) => void;
}

export default function ModalContactosIntegracion({
  integracionNombre,
  contactosRaw = '',
  sponsorship = 'NO',
  onCerrar,
  correosOnboarding = [],
  kamEmail,
  onCopiarTexto
}: ModalContactosIntegracionProps) {
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  const esPendiente = String(integracionNombre || '').toLowerCase().trim().includes('pendiente');

  // Separar y parsear contactos de la integración por coma, punto y coma o salto de línea
  const listaContactos = useMemo(() => {
    return (contactosRaw || '')
      .split(/[,;\n\r]+/)
      .map(c => c.trim())
      .filter(c => c.length > 0)
      .map(parsearContacto)
      .filter(c => c.email.length > 0);
  }, [contactosRaw]);

  // Parsear correo del KAM si existe
  const kamParsed = useMemo(() => {
    return kamEmail ? parsearContacto(kamEmail) : null;
  }, [kamEmail]);

  // Parsear correos de Onboarding
  const listaOnboarding = useMemo(() => {
    return correosOnboarding.map(parsearContacto);
  }, [correosOnboarding]);

  const copiar = (texto: string, id: string, msg: string = 'Copiado al portapapeles') => {
    if (!texto) return;
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    if (onCopiarTexto) {
      onCopiarTexto(texto, msg);
    }
    setTimeout(() => {
      setCopiadoId(null);
    }, 2000);
  };

  const copiarTodosContactos = () => {
    const emailsLimpios = listaContactos
      .map(c => c.email)
      .filter(Boolean);
    if (emailsLimpios.length === 0) return;
    copiar(emailsLimpios.join(', '), 'todos_contactos', 'Todos los correos copiados al portapapeles (sin etiquetas)');
  };

  const copiarTodosOnboarding = () => {
    const emailsLimpios = listaOnboarding
      .map(c => c.email)
      .filter(Boolean);
    if (emailsLimpios.length === 0) return;
    copiar(emailsLimpios.join(', '), 'todos_onb', 'Todos los correos de Onboarding copiados');
  };

  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onCerrar}
    >
      <div 
        className="bg-[#202024] border border-[#3A3A3E] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#3A3A3E] bg-[#161618] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E85A80]/20 border border-[#E85A80]/40 flex items-center justify-center text-[#F46C8E] font-bold text-sm">
              ✉️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-mono truncate max-w-[260px]" title={integracionNombre}>
                  {integracionNombre || 'Sin Integración'}
                </h3>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  sponsorship === 'SI' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-[#2C2C32] text-[#B3B3B3]'
                }`}>
                  Sponsorship: {sponsorship}
                </span>
              </div>
              <p className="text-[11px] text-[#B3B3B3]">Contactos para ticket de seguimiento</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            className="text-[#B3B3B3] hover:text-white p-1.5 rounded-lg hover:bg-[#2C2C32] text-base transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          
          {/* Caso Pendiente: Advertencia oficial */}
          {esPendiente ? (
            <div className="bg-amber-950/40 border border-amber-700/70 rounded-xl p-3 text-amber-300 flex items-start gap-2.5">
              <span className="text-base mt-0.5">⚠️</span>
              <div className="space-y-1">
                <p className="font-bold text-xs">Integración en estado Pendiente</p>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Para esta opción <strong>solo deben copiar los correos del equipo de onboarding</strong> para el envío del ticket de seguimiento.
                </p>
              </div>
            </div>
          ) : (
            /* Contactos de la Integración (Columna C de Integraciones_Sponsorship) */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white flex items-center gap-1.5">
                  <span>🔌</span>
                  <span>Contactos de la Integración ({listaContactos.length})</span>
                </h4>
                {listaContactos.length > 1 && (
                  <button
                    type="button"
                    onClick={copiarTodosContactos}
                    className="text-[10px] bg-pink-950 hover:bg-pink-900 text-pink-300 border border-pink-700/60 px-2 py-0.5 rounded font-semibold cursor-pointer transition active:scale-95"
                  >
                    {copiadoId === 'todos_contactos' ? '✅ ¡Copiados todos!' : '📋 Copiar todos'}
                  </button>
                )}
              </div>

              {listaContactos.length === 0 ? (
                <div className="bg-[#121212] border border-[#3A3A3E] rounded-xl p-3.5 text-center text-[#B3B3B3] italic">
                  ℹ️ No hay contactos registrados para esta integración en la hoja oficial.
                </div>
              ) : (
                <div className="space-y-2">
                  {listaContactos.map((contacto, idx) => {
                    const idItem = `cont_${idx}`;
                    const esCopiado = copiadoId === idItem;
                    return (
                      <div 
                        key={idx}
                        className={`bg-[#121212] border rounded-xl p-2.5 transition flex items-center justify-between gap-3 ${
                          contacto.esEmergencia 
                            ? 'border-rose-800/80 bg-rose-950/20 hover:border-rose-600' 
                            : 'border-[#3A3A3E] hover:border-[#3A3A3E]'
                        }`}
                      >
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          {/* Etiqueta arriba del correo (no se copia al hacer click) */}
                          {contacto.etiqueta && (
                            <div className="mb-1 flex items-center gap-1.5 flex-wrap select-none">
                              {contacto.esEmergencia ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-950/90 text-rose-300 border border-rose-700/80 shadow-sm shadow-rose-950/60 select-none">
                                  <span className="animate-pulse">🚨</span>
                                  <span>{contacto.etiqueta}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-700/70 shadow-sm select-none">
                                  <span>🏷️</span>
                                  <span>{contacto.etiqueta}</span>
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => copiar(contacto.email, idItem, `Correo copiado: ${contacto.email}`)}
                              className="font-mono text-cyan-300 hover:text-cyan-100 font-medium select-all truncate text-[11px] text-left cursor-pointer transition"
                              title={`Clic para copiar únicamente ${contacto.email}`}
                            >
                              <span>{contacto.email}</span>
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => copiar(contacto.email, idItem, `Correo copiado: ${contacto.email}`)}
                          className={`text-[10px] px-2.5 py-1.5 rounded-lg font-semibold transition shrink-0 cursor-pointer flex items-center gap-1 shadow-sm ${
                            esCopiado 
                              ? 'bg-emerald-600 text-white shadow' 
                              : contacto.esEmergencia
                                ? 'bg-rose-900/70 hover:bg-rose-800 text-rose-200 border border-rose-700/80 hover:text-white'
                                : 'bg-[#2C2C32] hover:bg-[#3A3A3E] text-gray-200 border border-[#3A3A3E] hover:border-[#E85A80]/50'
                          }`}
                          title={`Copiar correo: ${contacto.email}`}
                        >
                          <span>{esCopiado ? '✅' : '📋'}</span>
                          <span>{esCopiado ? '¡Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Contacto del KAM si está disponible */}
          {kamParsed && kamParsed.email && (
            <div className="space-y-1.5 pt-2 border-t border-[#3A3A3E]">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white flex items-center gap-1.5">
                  <span>💼</span>
                  <span>Ejecutivo Comercial / KAM del Local</span>
                </h4>
              </div>
              <div className="bg-[#121212] border border-[#3A3A3E] rounded-xl p-2.5 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  {kamParsed.etiqueta && (
                    <div className="mb-1 flex items-center gap-1.5 select-none">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-700/70 shadow-sm select-none">
                        <span>🏷️</span>
                        <span>{kamParsed.etiqueta}</span>
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => copiar(kamParsed.email, 'kam_email', `Correo KAM copiado: ${kamParsed.email}`)}
                    className="font-mono text-amber-300 hover:text-amber-200 select-all truncate text-[11px] text-left cursor-pointer transition"
                    title={`Clic para copiar únicamente ${kamParsed.email}`}
                  >
                    <span>{kamParsed.email}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => copiar(kamParsed.email, 'kam_email', `Correo KAM copiado: ${kamParsed.email}`)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg font-semibold transition shrink-0 cursor-pointer flex items-center gap-1 ${
                    copiadoId === 'kam_email'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-[#2C2C32] hover:bg-[#3A3A3E] text-gray-200 border border-[#3A3A3E] hover:border-amber-500/50'
                  }`}
                  title={`Copiar correo: ${kamParsed.email}`}
                >
                  <span>{copiadoId === 'kam_email' ? '✅' : '📋'}</span>
                  <span>{copiadoId === 'kam_email' ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Correos del Equipo de Onboarding */}
          {listaOnboarding.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#3A3A3E]">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white flex items-center gap-1.5">
                  <span>👥</span>
                  <span>Equipo de Onboarding (Agentes y TL)</span>
                </h4>
                <button
                  type="button"
                  onClick={copiarTodosOnboarding}
                  className="text-[10px] bg-pink-950 hover:bg-pink-900 text-pink-300 border border-pink-700/60 px-2 py-0.5 rounded font-semibold cursor-pointer transition active:scale-95"
                >
                  {copiadoId === 'todos_onb' ? '✅ ¡Copiados todos!' : '📋 Copiar todos'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {listaOnboarding.map((onb, idx) => {
                  const idOnb = `onb_${idx}`;
                  const esCopiado = copiadoId === idOnb;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => copiar(onb.email, idOnb, `Correo copiado: ${onb.email}`)}
                      className={`text-left p-1.5 rounded-lg border font-mono text-[10px] transition flex items-center justify-between gap-1 cursor-pointer truncate ${
                        esCopiado
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                          : 'bg-[#121212] hover:bg-[#2C2C32] text-[#D1D5DB] hover:text-white border-[#3A3A3E]'
                      }`}
                      title={`Clic para copiar ${onb.email}`}
                    >
                      <span className="truncate">{onb.email}</span>
                      <span className="shrink-0 text-[10px]">{esCopiado ? '✅' : '📋'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#3A3A3E] bg-[#161618] flex justify-end">
          <button
            type="button"
            onClick={onCerrar}
            className="px-4 py-1.5 bg-[#2C2C32] hover:bg-[#3A3A3E] text-[#D1D5DB] text-sm font-semibold rounded-lg cursor-pointer transition min-h-[44px]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
