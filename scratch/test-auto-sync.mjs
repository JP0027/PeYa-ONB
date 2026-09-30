import { sheetsBackendService } from '../src/services/sheetsBackendService.js';
import { db } from '../src/firebase.js';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

async function testAutoSync() {
  console.log('--- Probando sincronizador automático ---');
  const t0 = Date.now();
  const filas = await sheetsBackendService.obtenerTodasLasFilas();
  console.log(`Obtenidas ${filas.length} filas de Sheets en ${Date.now() - t0}ms`);

  // Traer estados actuales de Firestore
  const snap = await getDocs(collection(db, 'casos'));
  const firestoreMap = new Map();
  snap.docs.forEach(d => firestoreMap.set(d.id, d.data()));

  let cambiosDetectados = 0;
  for (const cs of filas) {
    const key = String(cs.casoOp || cs.id || '').trim();
    if (!key) continue;

    const cf = firestoreMap.get(key);
    if (!cf) {
      cambiosDetectados++;
    } else {
      // Comparar campos clave
      const cambioEstado = String(cf.estado || '').trim() !== String(cs.estado || '').trim();
      const cambioEtapa = String(cf.etapa || '').trim() !== String(cs.etapa || '').trim();
      const cambioTienda = String(cf.tienda || '').trim() !== String(cs.tienda || '').trim();
      if (cambioEstado || cambioEtapa || cambioTienda) {
        cambiosDetectados++;
      }
    }
  }

  console.log(`Cambios detectados que requieren actualización en Firestore: ${cambiosDetectados}`);
  console.log('Tiempo total de verificación:', Date.now() - t0, 'ms');
}

testAutoSync().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
