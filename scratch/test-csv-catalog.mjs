import { parsearCSVCatalogo, exportarCatalogoCSV } from '../src/services/catalogoService.js';

console.log('=== TEST 1: CSV Simple (Etapas) ===');
const csvEtapas = `valor
Sin integración confirmada
En proceso de seteo
En proceso para pruebas (baja de integración)
Nueva Etapa Especial
`;
const parsedEtapas = parsearCSVCatalogo(csvEtapas, 'etapas');
console.log('Parsed etapas:', parsedEtapas);

console.log('\n=== TEST 2: CSV Integraciones (2 columnas: nombre, sponsorship) ===');
const csvInteg = `nombre,sponsorship
Datalive,NO
Deliverect,SI
InvuPos,SI
TestIntegration,NO
`;
const parsedInteg = parsearCSVCatalogo(csvInteg, 'integraciones');
console.log('Parsed integraciones:', parsedInteg);

console.log('\n=== TEST 3: Exportar CSV ===');
const exp = exportarCatalogoCSV('integraciones', parsedInteg);
console.log('Exported CSV:');
console.log(exp);
