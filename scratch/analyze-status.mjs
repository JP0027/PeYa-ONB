import { sheetsBackendService } from '../src/services/sheetsBackendService.js';
import { db } from '../src/firebase.js';
import { collection, getDocs } from 'firebase/firestore';

async function main() {
  console.log('--- 1. CONSULTANDO GOOGLE SHEETS EN VIVO ---');
  const casosSheets = await sheetsBackendService.obtenerTodasLasFilas();
  console.log('Total casos recuperados de Sheets:', casosSheets.length);

  const conteoEstadosSheets = {};
  casosSheets.forEach(c => {
    const est = String(c.estado || '(VACIO)').trim();
    conteoEstadosSheets[est] = (conteoEstadosSheets[est] || 0) + 1;
  });
  console.log('Estados en Google Sheets:', JSON.stringify(conteoEstadosSheets, null, 2));

  const enProgresoSheets = casosSheets.filter(c => {
    const est = String(c.estado || '').toLowerCase().trim();
    return est.includes('progreso');
  });
  console.log('En progreso en Sheets (total):', enProgresoSheets.length);
  const sinOpSheets = enProgresoSheets.filter(c => String(c.estado || '').toLowerCase().includes('sin oportunidad'));
  const normalSheets = enProgresoSheets.filter(c => !String(c.estado || '').toLowerCase().includes('sin oportunidad'));
  console.log('  -> En progreso normal en Sheets:', normalSheets.length);
  console.log('  -> En progreso (sin oportunidad) en Sheets:', sinOpSheets.length);

  console.log('\n--- 2. CONSULTANDO FIRESTORE EN VIVO ---');
  const snap = await getDocs(collection(db, 'casos'));
  console.log('Total documentos en Firestore (colección "casos"):', snap.docs.length);
  const casosFirestore = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const conteoEstadosFirestore = {};
  casosFirestore.forEach(c => {
    const est = String(c.estado || '(VACIO)').trim();
    conteoEstadosFirestore[est] = (conteoEstadosFirestore[est] || 0) + 1;
  });
  console.log('Estados en Firestore:', JSON.stringify(conteoEstadosFirestore, null, 2));

  console.log('\n--- 3. REPRODUCIENDO LOGICA DEL DASHBOARD ---');
  // Como en Dashboard/index.jsx:
  const mapaCasos = new Map();
  casosSheets.forEach(c => {
    const key = String(c.casoOp || c.id || c.vendorId || '').trim();
    if (key) mapaCasos.set(key, c);
  });
  casosFirestore.forEach(c => {
    const key = String(c.casoOp || c.id || c.vendorId || '').trim();
    if (key) {
      const prev = mapaCasos.get(key) || {};
      mapaCasos.set(key, { ...prev, ...c });
    }
  });
  const casosTotales = Array.from(mapaCasos.values());
  console.log('Total casos fusionados (casosTotales):', casosTotales.length);

  // esCasoActivo
  const esCasoActivo = (c) => {
    if (!c) return false;
    const est = String(c.estado || '').toLowerCase().trim();
    if (est.includes('cerrad') || est.includes('fallid') || est.includes('cancel')) return false;
    if (!est || est.includes('progreso') || est === 'nuevo' || est === 'abierto' || est === 'activo') return true;
    if (c.esActivo === true) return true;
    return false;
  };

  const activos = casosTotales.filter(esCasoActivo);
  console.log('Total casos que pasan esCasoActivo:', activos.length);

  // Comparar: qué casos pasan esCasoActivo que NO son "En progreso" estricto
  const activosNoProgreso = activos.filter(c => {
    const est = String(c.estado || '').toLowerCase().trim();
    return !est.includes('progreso');
  });
  console.log('Casos activos cuyo estado NO incluye "progreso":', activosNoProgreso.length);
  if (activosNoProgreso.length > 0) {
    console.log('Muestra de estos casos:', activosNoProgreso.slice(0, 5).map(c => ({
      casoOp: c.casoOp,
      estado: c.estado,
      esActivo: c.esActivo,
      tienda: c.tienda
    })));
  }

  // Ver si Firestore sobrescribe algún caso que en Sheets está cerrado pero en Firestore está en progreso
  let cambiadosPorFirestore = 0;
  casosFirestore.forEach(cf => {
    const key = String(cf.casoOp || cf.id || '').trim();
    const cs = casosSheets.find(s => String(s.casoOp || s.id).trim() === key);
    if (cs && cs.estado !== cf.estado) {
      console.log(`Discrepancia para ${key}: Sheets="${cs.estado}" vs Firestore="${cf.estado}"`);
      cambiadosPorFirestore++;
    }
  });
  console.log('Total casos con estado diferente entre Sheets y Firestore:', cambiadosPorFirestore);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
