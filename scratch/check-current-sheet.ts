import { sheetsBackendService } from '../src/services/sheetsBackendService';

async function main() {
  const token = await (sheetsBackendService as any).obtenerAuthToken();
  const spreadsheetId = '1obGQuhQx0FcxdoHNYUMzGqOzLFalhA63W8ze1tygHkk';
  
  // 1. Get sheet properties (rowCount)
  const urlMeta = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title,gridProperties.rowCount)`;
  const resMeta = await fetch(urlMeta, { headers: { Authorization: `Bearer ${token}` } });
  const dataMeta = await resMeta.json();
  const sheetObj = dataMeta.sheets?.find((s: any) => s.properties?.title === 'Onboarding_New');
  console.log('Sheet properties:', JSON.stringify(sheetObj, null, 2));

  // 2. Read rows 1877 to 1885
  const urlRows = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Onboarding_New'!A1877:G1885?valueRenderOption=FORMATTED_VALUE`;
  const resRows = await fetch(urlRows, { headers: { Authorization: `Bearer ${token}` } });
  const dataRows = await resRows.json();
  console.log('Rows 1877 to 1885:');
  (dataRows.values || []).forEach((r: any, idx: number) => {
    console.log(`Row ${1877 + idx}:`, JSON.stringify(r));
  });
}

main().catch(console.error);
