import { procesarActualizacionCaso } from '../src/utils/onboardingRules.js';

const etapas = [
  'En proceso para pruebas (baja de integración)',
  'Pedido de prueba realizado (baja de integración)',
  'Solicitud de creación de oportunidad Admin (sin go)',
  'Sin configuraciones a nivel integración'
];

etapas.forEach(etapa => {
  const caso = procesarActualizacionCaso({}, {
    casoOp: '99999999',
    vendorId: '12345',
    tienda: 'Tienda Test',
    etapa: etapa,
    estado: 'En progreso',
    fechaCreacion: '2026-09-29'
  });

  console.log(`\n========================================`);
  console.log(`ETAPA: ${etapa}`);
  console.log(`========================================`);
  console.log(` - POS API  -> Inicio: "${caso.fechaInicioPos}" | Push: "${caso.fechaPushPos}" | Resp: "${caso.respuestaPos}" | Check: ${caso.pushKamPos}`);
  console.log(` - Catálogo -> Inicio: "${caso.fechaInicioCat}" | Push: "${caso.fechaPushCat}" | Resp: "${caso.respuestaCat}" | Check: ${caso.pushKamCat}`);
  console.log(` - OP Sla   -> Fecha Inicio OP: "${caso.fechaInicioSeguimientoOP}" | Activo: ${caso.esActivo}`);
});

console.log(`\n========================================`);
console.log(`TEST CIERRE EN ETAPAS NUEVAS:`);
console.log(`========================================`);

const casoCerrado = procesarActualizacionCaso({}, {
  casoOp: '88888888',
  vendorId: '99999',
  tienda: 'Tienda Baja Cierre',
  etapa: 'Sin configuraciones a nivel integración',
  estado: 'Cerrado por ONB (Satisfactorio)',
  fechaCreacion: '2026-09-29'
});

console.log(` - Estado: "${casoCerrado.estado}" | Fecha Cierre: "${casoCerrado.fechaCierre}" | Es Activo: ${casoCerrado.esActivo}`);
console.log(` - POS: Inicio "${casoCerrado.fechaInicioPos}" | Cat: Inicio "${casoCerrado.fechaInicioCat}"`);
