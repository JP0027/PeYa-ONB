import fs from 'fs';
import { JWT } from 'google-auth-library';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';

async function main() {
  console.log('=== 1. TEST GOOGLE SHEETS API ===');
  const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));
  console.log('Service Account email:', serviceAccount.client_email);

  const jwt = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const tokenResp = await jwt.authorize();
  console.log('Google Auth Token obtenido con exito!');

  const spreadsheetId = '1obGQuhQx0FcxdoHNYUMzGqOzLFalhA63W8ze1tygHkk';
  const metaResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${tokenResp.access_token}` }
  });

  const meta = await metaResp.json();
  if (meta.error) {
    console.error('Error al acceder a Google Sheets:', meta.error);
  } else {
    console.log('Pestañas en el documento:');
    meta.sheets.forEach(s => {
      console.log(` - Title: "${s.properties.title}", gid: ${s.properties.sheetId}`);
    });

    // Buscar la pestaña con gid=104076048 o gid=1579936724
    const onbTab = meta.sheets.find(s => s.properties.sheetId === 104076048 || s.properties.title.toLowerCase().includes('onb'));
    const sponTab = meta.sheets.find(s => s.properties.sheetId === 1579936724 || s.properties.title.toLowerCase().includes('sponsorship'));
    console.log('\nPestaña ONB detectada:', onbTab ? onbTab.properties.title : 'No encontrada');
    console.log('Pestaña Sponsorship detectada:', sponTab ? sponTab.properties.title : 'No encontrada');

    if (onbTab) {
      const escapedTitle = `'${onbTab.properties.title.replace(/'/g, "''")}'!A1:AZ5`;
      const dataResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(escapedTitle)}`, {
        headers: { Authorization: `Bearer ${tokenResp.access_token}` }
      });
      const dataJson = await dataResp.json();
      console.log('Lectura de prueba ONB (primeras 5 filas):', dataJson.values ? `${dataJson.values.length} filas leídas` : dataJson);
    }
  }

  console.log('\n=== 2. TEST FIREBASE FIRESTORE ===');
  // Cargar .env
  const envContent = fs.readFileSync('./.env', 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const k = parts[0].trim();
      const v = parts.slice(1).join('=').trim();
      if (k) env[k] = v;
    }
  });

  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
  };
  console.log('Firebase Project ID:', firebaseConfig.projectId);

  const fbApp = initializeApp(firebaseConfig);
  const db = getFirestore(fbApp);

  try {
    const casosRef = collection(db, 'casos');
    const q = query(casosRef, limit(5));
    const snap = await getDocs(q);
    console.log(`Firestore conexion exitosa! Documentos leidos de coleccion "casos": ${snap.size}`);
    snap.docs.forEach((d, idx) => {
      const data = d.data();
      console.log(` [Doc ${idx + 1}] ID: ${d.id}, Caso OP: ${data.casoOp || 'N/A'}, Tienda: ${data.tienda || 'N/A'}`);
    });
  } catch (err) {
    console.error('Error al conectar a Firestore:', err.message);
  }
}

main().catch(console.error);
