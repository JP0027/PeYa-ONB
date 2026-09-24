/**
 * Catálogo Oficial de Opciones y Reglas de Negocio - PeYa ONB
 * Basado estrictamente en la estructura oficial de la hoja ONB 2026.
 */

// 1. Países oficiales
export const LISTA_PAISES = [
  'Bolivia',
  'Chile',
  'Ecuador',
  'El Salvador',
  'Perú',
  'Uruguay',
  'Argentina',
  'otros'
];

// 2. Oportunidad oficial
export const LISTA_OPORTUNIDADES = [
  'New Business',
  'Upgrade/Upsell Alta Integración',
  'Upgrade/Upsell Baja Integración',
  'Franchise Extensión',
  'Win Back',
  'Otros',
  'Owner Change',
  'Upgrade/Upsell Cambio de comisión',
  'Legal Form Change',
  'Switch',
  'Sin oportunidad'
];

// 3. Asset oficial
export const LISTA_ASSETS = [
  'Integración',
  'Admin',
  'POS',
  'Sin oportunidad'
];

// 4. ¿Tiene caso de onboarding en el inicio de seguimiento?
export const LISTA_TIENE_INICIO = [
  'Si',
  'No'
];

// 5. Estado del caso oficial
export const LISTA_ESTADOS = [
  'Cerrado por ONB (Fallido)',
  'Cerrado por ONB (Satisfactorio)',
  'Cerrado por KAM (Satisfactorio)',
  'Cerrado por KAM (Fallido)',
  'Cerrado por API Vendor',
  'En progreso (Sin oportunidad)',
  'En progreso'
];

// 6. Etapa del onboarding oficial
export const LISTA_ETAPAS = [
  'Sin integración confirmada',
  'En proceso de seteo',
  'en proceso de verificación de catálogo',
  'Validación del Onboarding',
  'En proceso para pruebas',
  'Pedido de prueba realizado'
];

// 7. Agentes conocidos
export const LISTA_AGENTES = [
  'Jean Palomino',
  'Prisila Leon',
  'Joel Tocas',
  'Yadira Flores',
  'Guillermo Gonzales',
  'Jean Changanaqui',
  'Henry Serrato',
  'Joseline Yactayo',
  'Comercial',
  'Sin asignación'
];

// 8. Mapa de Integraciones y descuentos bajo estructura sponsorship (SI / NO)
export const MAPA_INTEGRACIONES_SPONSORSHIP = {
  'Estudio MQ': 'NO',
  'RedCumbre SPA': 'NO',
  'Kitchenita 2.0': 'NO',
  'Kaotai': 'NO',
  'Guacamole': 'NO',
  'Trade': 'NO',
  'BeQuick': 'NO',
  'Innovaside EIRL': 'NO',
  'Evyta Sushi': 'NO',
  'Morphi': 'NO',
  "Integración Papa John's (Costa Rica)": 'NO',
  'Waitry': 'NO',
  'KFC Venezuela': 'NO',
  'Grupo Hasar': 'NO',
  'Integración Popapp': 'NO',
  'WOLOP': 'NO',
  'Dominos Pizza RD': 'NO',
  'Mercat CL': 'NO',
  'LS - Sistemas': 'NO',
  'Mercat BO': 'NO',
  'Justo POS': 'NO',
  'MoonIdeas': 'NO',
  'Manso Dev Shop': 'NO',
  'JoinPoster.com': 'NO',
  'Arzion': 'NO',
  'InvuPos': 'SI',
  'GDPSistemas': 'NO',
  'Ordatic': 'NO',
  'Ofisistemas': 'NO',
  'Fork': 'NO',
  'Linisco': 'NO',
  'Niufoods / Coco thai': 'NO',
  'Norkys': 'NO',
  "Lucciano's": 'NO',
  "Dean & Denny's": 'NO',
  'Delicheck': 'NO',
  'Datalive': 'NO',
  'Rapimesas': 'NO',
  'Planeta Empanada': 'NO',
  'Qikserve': 'SI',
  'Cinet UY/BO': 'NO',
  'FUDO': 'NO',
  'Dominos Chile': 'NO',
  'Vinson': 'NO',
  'Janaq (Roky´s)': 'NO',
  'GNBrands': 'NO',
  'Smartfran': 'NO',
  'Meltpizzas Chile': 'NO',
  'Proyectiva': 'NO',
  'Ayres IT': 'NO',
  'Toptech - Restotech': 'NO',
  'Cinet Mostaza AR': 'NO',
  'Grupo Comidas': 'NO',
  'PcNub - Aloha': 'SI',
  'Pizza Hut - Jedisoft': 'NO',
  'Arcoprime': 'NO',
  'Taco Bell': 'NO',
  'Delosi': 'NO',
  'Cinet Milanga & Co': 'NO',
  'Tango Resto - Axoft': 'NO',
  'Alturisa': 'SI',
  'Deliverect': 'SI',
  'Pixel Point': 'NO',
  'Macrosoft': 'NO',
  'Bistrosoft': 'NO',
  'Nubing': 'NO',
  'Pedidos NGR': 'SI',
  'Pixo Gestión': 'NO',
  'Iungo - Sarlatam': 'NO',
  'Integración Cinet General': 'NO',
  'Heladería Paris': 'NO',
  'Maxirest': 'NO',
  'Burger King Guatemala': 'NO',
  'RestaurantSoft | Emestudio Ltda.': 'NO',
  'Taco Bell HN/SV (Belluno)': 'NO',
  'Delysoft': 'NO',
  'Mayflower': 'NO',
  'Sushi Pop - Poke Pop - Franui Che Sushi - Bunka Sushi La Causa Nikkei Atteliersoftware': 'NO',
  'Tedepsa - Mostaza PY': 'NO',
  'Papa Johns CL': 'NO',
  'Toteat': 'NO',
  'Merchise': 'SI',
  'Live POS - Johnny Rockets': 'NO',
  'Thinkion': 'NO',
  'Núcleo IT Núcleo Check': 'NO',
  'ICG IT': 'NO',
  'Panda Express': 'NO',
  'Burger King Paraguay': 'NO',
  'Grupo KFC (ecuador)': 'SI',
  'Grupo KFC': 'NO',
  'Applebees': 'NO',
  'Flex': 'NO',
  'Metre': 'NO',
  'Hiopos': 'NO',
  'Rapanui': 'NO',
  'Alsea AR': 'NO',
  'Alsea CL': 'NO',
  'Quinube - Quinoa': 'NO',
  'Wide': 'NO',
  'Grupo Jade': 'NO',
  'RestoExpress - GSOFT': 'NO',
  'PideDirecto - Ambit': 'NO',
  'Bona': 'NO',
  'Restaurant.Pe': 'NO',
  'Wakanda Forever': 'NO',
  'Buffalo Wings El Salvador': 'NO',
  'EstudioResto': 'NO',
  'Tori': 'NO',
  'Slabcode': 'NO',
  'Ingefactura': 'NO',
  'Gestionar Gastronomía': 'NO',
  'Foodology': 'NO',
  'Nubecenter': 'NO',
  'Donkin Donuts Ecuador': 'NO',
  'MIl Sabores': 'NO',
  'Grido Automatizado - I+DIoT': 'NO',
  'ConectorPlus': 'NO',
  'masDelivery': 'NO',
  'Cinet - Freddo': 'NO',
  'Enmarsi Cia. Ltda.': 'NO',
  'Papa Johns El Salvador': 'NO',
  'Cravel': 'NO',
  'Power Chicken': 'NO',
  'Bruler Software': 'NO',
  'Retail S.A': 'NO',
  'Infomatica (Inforest)': 'NO',
  'QSR S.A.': 'NO',
  'Innovasys': 'NO',
  "Domino's Guatemala": 'NO',
  'Aisushi': 'NO',
  'Halloween 2': 'NO',
  "Alsea - Domino's UY": 'NO',
  'Complementagestion': 'NO',
  'Odoo AR': 'NO',
  'Aloha - Starbucks Panama': 'NO',
  'Tabletech SRL - SnowEats - TOi': 'NO',
  'Influye': 'NO',
  'Comidas Centroamericanas S.A. (Pizza Hut Costa Rica)': 'NO',
  'Anfora': 'NO',
  'ID Business Intelligence': 'NO',
  'Bianca': 'NO',
  'MasterSolutions': 'NO',
  'Medio Punto': 'NO',
  'Appgrade': 'NO',
  'Tillster': 'NO',
  'Smartpay': 'NO',
  'Xperto Cya': 'NO',
  "Domino's Pizza Panamá": 'NO',
  'Integración Paradise Venture / Bacon Burger': 'NO',
  'Bacon Burgers': 'SI',
  'HDP Burgers': 'NO',
  'Pertutti': 'NO',
  'MENU Technologies': 'NO',
  'Nori Sushi': 'NO',
  'Neola': 'NO',
  'QRmenu': 'NO',
  'Shipeo': 'NO',
  'Rctech': 'NO',
  'Proper Business Solutions': 'NO',
  'Chancho Gusto RD': 'NO',
  'ADA POS': 'NO',
  'UrbanPiper': 'NO',
  'RESTOMETRICS': 'NO',
  'Cucina': 'NO',
  'Mediterraneo': 'NO',
  'abaPOS': 'NO',
  'Napse': 'NO',
  'Integrasoft': 'NO',
  'Agil': 'NO',
  'SOLUSYSTEMS': 'NO',
  'Integracion Republica Dominicana': 'NO',
  'McDonalds Paraguay': 'NO',
  'Integración San Camilo': 'NO',
  'Café Barista': 'NO',
  'Fornaio': 'NO',
  'Avances_AvantSales': 'NO',
  'La Fábrica de Bianca Flor': 'NO',
  'Kuup': 'NO',
  'Control Facilito': 'NO',
  'Sweet Coffee': 'NO',
  'Smarty': 'NO',
  'Codicia': 'NO',
  'Movi.Shop': 'SI',
  'ApiWorking': 'NO',
  'Pollo Campestre': 'SI',
  'GianelliYa': 'NO',
  'Pinulito Guatemala': 'SI',
  'Orgiuto SA': 'NO',
  'BoomBurger01': 'NO',
  'Teknisa': 'NO',
  'Pulse': 'SI',
  'MammaTomato': 'NO',
  'Plaglabs': 'NO',
  'Pedix': 'NO',
  'Sinqro': 'NO',
  'Alberdin': 'NO',
  'Santa Burguesa': 'NO',
  'Alpharest': 'NO',
  'Comanda Central / Menu Fast': 'NO',
  'Danos.Click': 'NO',
  'DeliveryOne / RetailOne / SoluOne': 'NO',
  'Grupo Madero': 'NO',
  'Gedis / Update': 'NO',
  'Spleat': 'NO',
  'POSBerry': 'NO',
  'Appex': 'NO',
  'Kumba (Pronto Copec)': 'SI',
  'Gcoderd': 'NO',
  'Cactus': 'NO',
  'La Cocina': 'NO',
  'Rentcoffit': 'NO',
  'Brodevo / Bocatti': 'NO',
  'OrderAR': 'NO',
  'Wantan': 'NO',
  'La Vene': 'NO',
  'Tatú': 'NO',
  'Coci.pro': 'NO',
  'Pegasus_GodsPan': 'NO',
  'Flama Hub': 'NO',
  'Menufast': 'NO',
  'Morsis / Synergy Shock': 'NO',
  'OlaClick': 'SI',
  'Arturos (Odoo)': 'NO',
  'Operance (El Club de la Milanesa)': 'SI',
  'Globonet Soluciones (Pollos Stav)': 'SI',
  'RankOS': 'NO',
  'Bites': 'NO',
  'Restolia': 'NO',
  'JBSoft': 'NO',
  'WeMenú': 'NO',
  'Biaqsr': 'NO',
  'Ambrosia': 'NO',
  'Optimus': 'NO',
  'Sertech': 'NO',
  'PostApp': 'SI',
  'Jedisoft': 'SI',
  'Lithospos': 'NO',
  'Delivery Hub': 'NO',
  'Ecuaviche': 'NO',
  'San Martin': 'NO',
  'KiwyPOS': 'NO',
  'GeSuite': 'NO',
  'Hoppiness': 'NO',
  'Cucinago': 'NO',
  'Teriyaki Madness': 'NO',
  'Boton': 'NO',
  'SistemaX': 'NO',
  'SiiPi': 'NO',
  'Raven (El Desembarco)': 'NO',
  'Voucheroo': 'NO',
  'Ludwing POS': 'NO',
  'OrdenApp': 'NO',
  'lrdWeb': 'NO',
  'Franquify': 'NO',
  'MPM - Market': 'NO',
  'El Patron IA': 'NO',
  'Pampa Enterprise Solutions': 'NO',
  'Subway Transformapp': 'NO',
  'SOUS': 'NO',
  'Heniasoft': 'NO',
  'RunFood App': 'NO',
  'Pendiente': 'NO'
};

export const LISTA_INTEGRACIONES_OFICIALES = Object.keys(MAPA_INTEGRACIONES_SPONSORSHIP).sort((a, b) => a.localeCompare(b));

export function obtenerSponsorship(integracionNombre) {
  if (!integracionNombre) return 'NO';
  const nombreLimpio = String(integracionNombre).trim();
  if (MAPA_INTEGRACIONES_SPONSORSHIP[nombreLimpio]) {
    return MAPA_INTEGRACIONES_SPONSORSHIP[nombreLimpio];
  }
  // Coincidencia flexible si contiene el nombre
  const encontrada = Object.keys(MAPA_INTEGRACIONES_SPONSORSHIP).find(
    k => k.toLowerCase() === nombreLimpio.toLowerCase()
  );
  return encontrada ? MAPA_INTEGRACIONES_SPONSORSHIP[encontrada] : 'NO';
}

/**
 * Determina si el estado corresponde a un caso activo en progreso
 */
export function esEstadoActivoOficial(estado) {
  if (!estado) return false;
  const est = String(estado).trim().toLowerCase();
  if (est.includes('cerrado') || est.includes('fallido')) return false;
  return est === 'en progreso' || est === 'en progreso (sin oportunidad)' || est.includes('progreso');
}

/**
 * Determina si el estado corresponde a un caso cerrado
 */
export function esEstadoCerradoOficial(estado) {
  if (!estado) return false;
  const est = String(estado).trim().toLowerCase();
  return est.includes('cerrado') || est.includes('fallido');
}

/**
 * Determina la Fecha de Inicio de Seguimiento de OP según la Etapa del Onboarding
 * Especificación exacta:
 * - Sin integración confirmada: Fecha de inicio de seguimiento de OP = Fecha de inicio de seguimiento - Datos Faltantes POS API
 * - En proceso de seteo: Fecha de inicio de seguimiento de OP = Fecha de inicio de seguimiento - Datos Faltantes POS API
 * - en proceso de verificación de catálogo: Fecha de inicio de seguimiento de OP = Fecha de inicio de seguimiento - Catálogo (solo si no existe Fecha de inicio de seguimiento - Datos Faltantes POS API)
 * - Validación del Onboarding: Fecha de inicio de seguimiento de OP única, sin fecha de seguimiento ni POS API ni de catálogo
 * - En proceso para pruebas: Fecha de inicio de seguimiento de OP única, sin fecha de seguimiento ni POS API ni de catálogo
 * - Pedido de prueba realizado: Fecha de inicio de seguimiento de OP única, sin fecha de seguimiento ni POS API ni de catálogo
 */
export function calcularFechaInicioSeguimientoOP(caso) {
  if (!caso) return '';
  const etapa = String(caso.etapa || '').trim().toLowerCase();
  const fPos = caso.fechaInicioPos && caso.fechaInicioPos !== 'S/V' ? caso.fechaInicioPos : '';
  const fCat = caso.fechaInicioCat && caso.fechaInicioCat !== 'S/V' ? caso.fechaInicioCat : '';
  const fCreacion = caso.fechaCreacion || '';
  const fSlaOriginal = caso.sla_inicio || '';

  if (etapa.includes('sin integración confirmada') || etapa.includes('sin integracion confirmada') || etapa.includes('en proceso de seteo')) {
    return fPos || fSlaOriginal || fCreacion;
  }

  if (etapa.includes('verificación de catálogo') || etapa.includes('verificacion de catalogo')) {
    if (fPos) return fPos;
    return fCat || fSlaOriginal || fCreacion;
  }

  // Validación del Onboarding, En proceso para pruebas, Pedido de prueba realizado: Fecha única
  return fSlaOriginal || fCreacion;
}
