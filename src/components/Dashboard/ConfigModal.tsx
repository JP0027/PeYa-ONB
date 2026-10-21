import React, { useState } from 'react';
import { 
  generarScriptAppsScriptParaFirebase 
} from '../../services/firebaseCasosService';
import { 
  guardarCuentaServicio,
  obtenerGasUrl,
  guardarGasUrl,
  probarConexionGas,
  importarCasosCSV
} from '../../services/googleSheetsService';

export interface ConfigModalProps {
  visible: boolean;
  onCerrar: () => void;
  onSincronizar: () => void;
  casosCount: number;
  temaClaro?: boolean;
}

interface NotificacionState {
  texto: string;
  tipo: 'success' | 'error';
}

export default function ConfigModal({ visible, onCerrar, onSincronizar, casosCount }: ConfigModalProps) {
  const [tipoConexionModal, setTipoConexionModal] = useState<'firebase' | 'csv' | 'gas' | 'sa'>('firebase');
  const [gasUrlInput, setGasUrlInput] = useState<string>(obtenerGasUrl() || "");
  const [probandoGas, setProbandoGas] = useState<boolean>(false);
  const [csvTextInput, setCsvTextInput] = useState<string>('');
  const [procesandoCsv, setProcesandoCsv] = useState<boolean>(false);
  const [codigoFirebaseCopiado, setCodigoFirebaseCopiado] = useState<boolean>(false);
  const [jsonCredsInput, setJsonCredsInput] = useState<string>("");
  const [guardandoCreds, setGuardandoCreds] = useState<boolean>(false);
  const [notificacion, setNotificacion] = useState<NotificacionState | null>(null);

  if (!visible) return null;

  const mostrarNotificacion = (texto: string, tipo: 'success' | 'error' = "success") => {
    setNotificacion({ texto, tipo });
    setTimeout(() => setNotificacion(null), 5000);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event: ProgressEvent<FileReader>) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setCsvTextInput(content);
        await manejarImportarCsv(content);
      }
    };
    reader.readAsText(file);
  };

  const manejarImportarCsv = async (textoCSV: string) => {
    if (!textoCSV.trim()) {
      mostrarNotificacion("Selecciona un archivo CSV o pega el contenido de la hoja.", "error");
      return;
    }
    setProcesandoCsv(true);
    try {
      const res = await importarCasosCSV(textoCSV, 'Archivo CSV');
      mostrarNotificacion(`¡Éxito! Se importaron ${res.total} casos.`, "success");
      onSincronizar();
      onCerrar();
    } catch (err: any) {
      mostrarNotificacion(`Error importando CSV: ${err.message}`, "error");
    } finally {
      setProcesandoCsv(false);
    }
  };

  const manejarTestGas = async () => {
    if (!gasUrlInput.trim()) {
      mostrarNotificacion("Ingresa la URL de tu Google Apps Script.", "error");
      return;
    }
    setProbandoGas(true);
    try {
      const data = await probarConexionGas(gasUrlInput.trim());
      guardarGasUrl(gasUrlInput.trim());
      const totalFilas = data.total || data.casos?.length || 0;
      mostrarNotificacion(`¡Conexión exitosa! Se detectaron ${totalFilas} casos.`, "success");
      onSincronizar();
    } catch (err: any) {
      mostrarNotificacion(`Error: ${err.message}`, "error");
    } finally {
      setProbandoGas(false);
    }
  };

  const manejarGuardarCredenciales = async () => {
    if (!jsonCredsInput.trim()) return;
    setGuardandoCreds(true);
    try {
      const parsed = JSON.parse(jsonCredsInput);
      const res = await guardarCuentaServicio(parsed);
      mostrarNotificacion(res.message || "service-account.json guardado con éxito.", "success");
      onSincronizar();
      onCerrar();
    } catch (err: any) {
      mostrarNotificacion(`Error en credenciales: ${err.message}`, "error");
    } finally {
      setGuardandoCreds(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      setJsonCredsInput(typeof event.target?.result === 'string' ? event.target.result : "");
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#1A1A1C] border border-slate-200 dark:border-[#3A3A3E] rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col text-slate-900 dark:text-gray-100 transition-colors">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#3A3A3E] pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-100 dark:bg-pink-950/40 text-[#E85A80] dark:text-[#F46C8E] rounded-xl flex items-center justify-center font-bold text-xl border border-pink-300 dark:border-pink-800/60 shadow-sm">📊</div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sincronización con Google Sheets</h3>
              <p className="text-xs text-slate-600 dark:text-gray-400">Hoja: Onboarding_New (PedidosYa) • Casos: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{casosCount}</span></p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onCerrar} 
            className="text-slate-400 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#2C2C32] p-1.5 rounded-lg font-bold text-base cursor-pointer transition"
          >
            ✕
          </button>
        </div>

        {notificacion && (
          <div className={`p-3 mb-4 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            notificacion.tipo === 'error' 
              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800' 
              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
          }`}>
            <span>{notificacion.tipo === 'error' ? '🚨' : '✅'}</span>
            <span>{notificacion.texto}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-[#3A3A3E] mb-4 pb-2.5 shrink-0">
          <button 
            type="button"
            onClick={() => setTipoConexionModal('firebase')} 
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
              tipoConexionModal === 'firebase' 
                ? 'bg-[#E85A80] text-white shadow-md shadow-pink-900/30' 
                : 'bg-slate-100 dark:bg-[#2C2C32] text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-[#3A3A3E] border border-slate-300 dark:border-[#3A3A3E]'
            }`}
          >
            🔥 1. Sheets ➔ Firebase
          </button>
          <button 
            type="button"
            onClick={() => setTipoConexionModal('csv')} 
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
              tipoConexionModal === 'csv' 
                ? 'bg-[#E85A80] text-white shadow-md shadow-pink-900/30' 
                : 'bg-slate-100 dark:bg-[#2C2C32] text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-[#3A3A3E] border border-slate-300 dark:border-[#3A3A3E]'
            }`}
          >
            📥 2. Cargar CSV
          </button>
          <button 
            type="button"
            onClick={() => setTipoConexionModal('gas')} 
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
              tipoConexionModal === 'gas' 
                ? 'bg-[#E85A80] text-white shadow-md shadow-pink-900/30' 
                : 'bg-slate-100 dark:bg-[#2C2C32] text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-[#3A3A3E] border border-slate-300 dark:border-[#3A3A3E]'
            }`}
          >
            🔗 3. Enlace Web App
          </button>
          <button 
            type="button"
            onClick={() => setTipoConexionModal('sa')} 
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
              tipoConexionModal === 'sa' 
                ? 'bg-[#E85A80] text-white shadow-md shadow-pink-900/30' 
                : 'bg-slate-100 dark:bg-[#2C2C32] text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-[#3A3A3E] border border-slate-300 dark:border-[#3A3A3E]'
            }`}
          >
            ⚙️ 4. Google Cloud JSON
          </button>
        </div>

        <div className="overflow-y-auto pr-1 flex-1 text-sm text-slate-800 dark:text-gray-200">
          {tipoConexionModal === 'firebase' && (
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-gray-300">Pega el siguiente código en Extensiones &gt; Apps Script de tu Google Sheet:</p>
              <div className="flex justify-end mb-2">
                <button 
                  type="button"
                  onClick={() => { 
                    navigator.clipboard.writeText(generarScriptAppsScriptParaFirebase()); 
                    setCodigoFirebaseCopiado(true); 
                    setTimeout(() => setCodigoFirebaseCopiado(false), 3000); 
                  }} 
                  className="bg-[#E85A80] hover:bg-pink-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer shadow-md shadow-pink-900/20"
                >
                  {codigoFirebaseCopiado ? '✅ Copiado' : '📋 Copiar Script'}
                </button>
              </div>
              <pre className="bg-slate-100 dark:bg-[#121212] border border-slate-300 dark:border-[#3A3A3E] p-3 rounded-xl text-[10px] font-mono h-48 overflow-y-auto text-slate-900 dark:text-gray-200 font-medium select-all">
                {generarScriptAppsScriptParaFirebase()}
              </pre>
            </div>
          )}
          {tipoConexionModal === 'csv' && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-700 dark:text-gray-300">Sube un archivo CSV exportado desde Google Sheets (Onboarding_New).</p>
              <input 
                type="file" 
                accept=".csv,.tsv" 
                onChange={handleCsvFileUpload} 
                className="block w-full text-xs text-slate-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#E85A80] file:text-white hover:file:bg-pink-700 min-h-[44px] cursor-pointer" 
              />
              <textarea 
                value={csvTextInput} 
                onChange={(e) => setCsvTextInput(e.target.value)} 
                className="w-full h-32 bg-slate-50 dark:bg-[#121212] border border-slate-300 dark:border-[#3A3A3E] rounded-xl p-2.5 text-xs text-slate-900 dark:text-gray-200 font-medium placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#E85A80]" 
                placeholder="O pega el contenido aquí..." 
              />
              <button 
                type="button"
                onClick={() => manejarImportarCsv(csvTextInput)} 
                disabled={procesandoCsv} 
                className="bg-[#E85A80] hover:bg-pink-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-pink-900/20"
              >
                {procesandoCsv ? 'Procesando...' : 'Importar a Firebase'}
              </button>
            </div>
          )}
          {tipoConexionModal === 'gas' && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-700 dark:text-gray-300">Ingresa la URL de tu Web App de Google Apps Script.</p>
              <input 
                type="text" 
                value={gasUrlInput} 
                onChange={(e) => setGasUrlInput(e.target.value)} 
                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-300 dark:border-[#3A3A3E] rounded-xl p-2.5 text-xs text-slate-900 dark:text-gray-200 font-semibold placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#E85A80]" 
                placeholder="https://script.google.com/macros/s/.../exec" 
              />
              <button 
                type="button"
                onClick={manejarTestGas} 
                disabled={probandoGas} 
                className="bg-[#E85A80] hover:bg-pink-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 min-h-[44px] cursor-pointer shadow-md shadow-pink-900/20"
              >
                {probandoGas ? 'Probando...' : 'Probar y Guardar URL'}
              </button>
            </div>
          )}
          {tipoConexionModal === 'sa' && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-700 dark:text-gray-300">Sube el archivo service-account.json de Google Cloud.</p>
              <input 
                type="file" 
                accept=".json" 
                onChange={handleFileUpload} 
                className="block w-full text-xs text-slate-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#E85A80] file:text-white hover:file:bg-pink-700 min-h-[44px] cursor-pointer" 
              />
              <textarea 
                value={jsonCredsInput} 
                onChange={(e) => setJsonCredsInput(e.target.value)} 
                className="w-full h-32 bg-slate-50 dark:bg-[#121212] border border-slate-300 dark:border-[#3A3A3E] rounded-xl p-2.5 text-xs font-mono text-slate-900 dark:text-gray-200 font-medium placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#E85A80]" 
                placeholder='{ "type": "service_account", ... }' 
              />
              <button 
                type="button"
                onClick={manejarGuardarCredenciales} 
                disabled={guardandoCreds} 
                className="bg-[#E85A80] hover:bg-pink-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 min-h-[44px] cursor-pointer shadow-md shadow-pink-900/20"
              >
                {guardandoCreds ? 'Guardando...' : 'Guardar Credenciales'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
