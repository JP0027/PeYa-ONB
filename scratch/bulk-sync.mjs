import { sheetsBackendService } from '../src/services/sheetsBackendService.js';
import { db } from '../src/firebase.js';
import { writeBatch, doc } from 'firebase/firestore';

async function bulkSync() {
  console.log('--- Iniciando sincronización masiva Sheets -> Firestore ---');
  const t0 = Date.now();
  const filas = await sheetsBackendService.obtenerTodasLasFilas();
  console.log('Total filas en Sheets:', filas.length);

  const BATCH_SIZE = 400;
  let batch = writeBatch(db);
  let batchCount = 0;
  let totalSaved = 0;

  for (const f of filas) {
    const key = String(f.casoOp || f.id || f.vendorId || '').trim();
    if (!key) continue;

    const ref = doc(db, 'casos', key);
    batch.set(ref, {
      ...f,
      id: key,
      actualizadoEn: new Date().toISOString()
    }, { merge: true });

    batchCount++;
    totalSaved++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log('Lote guardado (' + totalSaved + '/' + filas.length + ')...');
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log('¡Sincronización completa! ' + totalSaved + ' casos sincronizados en ' + (Date.now() - t0) + 'ms');
}

bulkSync().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
