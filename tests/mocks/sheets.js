export const mockSystemInfo = {
  nombre_empresa: 'Farmacia Americana',
  empresa: 'Farmacia Americana',
  telefono: '595981234567',
  direccion: 'Av. España c/ Brasil, Asunción',
  horario: 'Lunes a Viernes 07:00 a 22:00, Sábados 08:00 a 18:00',
  informacion_extra: 'Aceptamos todas las tarjetas de crédito, débito y transferencias bancarias.'
};

export const mockProducts = [
  {
    sku: 'P-001',
    nombre: 'Paracetamol 500mg',
    presentacion: 'Caja de 10 comprimidos',
    precio_pyg: 5000,
    precio_brl: 5.00,
    requiere_receta: 'N',
    categoria: 'analgésico',
    disponible: 'S',
    notas: 'Tomar cada 6 u 8 horas.'
  },
  {
    sku: 'P-002',
    nombre: 'Amoxicilina 500mg',
    presentacion: 'Caja de 16 cápsulas',
    precio_pyg: 25000,
    precio_brl: 25.00,
    requiere_receta: 'S',
    categoria: 'antibiótico',
    disponible: 'S',
    notas: 'Requiere receta médica obligatoria.'
  },
  {
    sku: 'P-003',
    nombre: 'Ibuprofeno 400mg',
    presentacion: 'Caja de 10 comprimidos',
    precio_pyg: 8000,
    precio_brl: 8.00,
    requiere_receta: 'N',
    categoria: 'analgésico',
    disponible: 'N',
    notas: 'Sin stock temporal.'
  }
];

export const mockFAQs = [
  {
    id: 1,
    pregunta: '¿Aceptan tarjeta?',
    respuesta: 'Sí, aceptamos todas las tarjetas de crédito, débito, transferencias y efectivo.',
    tags: 'pagos, tarjeta, transferencias'
  },
  {
    id: 2,
    pregunta: '¿Hacen delivery?',
    respuesta: 'Sí, realizamos delivery a toda la ciudad de Asunción y Gran Asunción con costo adicional según zona.',
    tags: 'delivery, envios, entrega'
  }
];

export const mockBranches = [
  {
    id: 1,
    nombre_ubicacion: 'Sucursal Central',
    direccion: 'Av. España c/ Brasil, Asunción',
    horario: 'Lunes a Sábado 07:00 a 23:00',
    telefono: '595981234567',
    acepta_whatsapp: 'S',
    notas: 'Cuenta con estacionamiento propio.'
  }
];

export const mockServices = [
  {
    id: 1,
    servicio: 'Toma de presión y test de glicemia',
    descripcion: 'Control rápido de presión arterial y nivel de azúcar en sangre.',
    precio_pyg: 10000,
    precio_brl: 10.00,
    requisitos: 'Estar en ayunas preferiblemente para el test de glicemia.',
    duracion_modalidad: '10 minutos presencial'
  }
];

export const mockLeads = [];
export const mockHistory = [];

export async function getSystemInfo() {
  return mockSystemInfo;
}

export async function getProducts() {
  return mockProducts;
}

export async function getFAQs() {
  return mockFAQs;
}

export async function getBranches() {
  return mockBranches;
}

export async function getServices() {
  return mockServices;
}

export async function appendLead(lead) {
  mockLeads.push(lead);
  return { sucesso: true, protocolo: lead.notes?.match(/Protocolo:\s*(\d+)/)?.[1] || '123456' };
}

export async function appendHistory(historyItem) {
  mockHistory.push(historyItem);
  return { sucesso: true };
}

export function onCacheRefresh(sheetName, callback) {
  // Simular atualização de cache imediata nos testes
  if (sheetName === 'productos') callback(mockProducts);
  if (sheetName === 'faqs') callback(mockFAQs);
  if (sheetName === 'sucursales') callback(mockBranches);
  if (sheetName === 'serviços') callback(mockServices);
}
