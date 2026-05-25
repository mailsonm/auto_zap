import Fuse from 'fuse.js';
import logger from '../logger.js';

// Índices em memória — recriados quando sheets.js atualiza o cache
let productFuse = null;
let faqFuse = null;
let branchFuse = null;
let serviceFuse = null;

// Função auxiliar para normalizar texto de busca (remove acentos, lowercase)
function normalizeText(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Normaliza as chaves do objeto vindas do Sheets para snake_case limpo
function normalizeKeys(obj) {
  const normalized = {};
  for (const key of Object.keys(obj)) {
    const cleanKey = key.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/(^_|_$)/g, '');
    normalized[cleanKey] = obj[key];
  }
  return normalized;
}

// Padroniza o objeto de produto para chaves estáveis
function standardizeProduct(rawProduct) {
  const p = normalizeKeys(rawProduct);
  return {
    sku: p.sku || '',
    nombre: p.nombre_del_producto || p.nombre_producto || p.nombre || '',
    presentacion: p.presentacion || '',
    precio_pyg: p.precio_pyg || 0,
    precio_brl: p.precio_brl || p.precio_r_auto || p.precio_rs_auto || 0,
    requiere_receta: p.requiere_receta === 'TRUE' || p.requiere_receta === true || String(p.requiere_receta).toLowerCase() === 'si' || String(p.requiere_receta).toLowerCase() === 'si',
    categoria: p.categoria || '',
    disponible: p.disponible === 'TRUE' || p.disponible === true || String(p.disponible).toLowerCase() === 'si' || String(p.disponible).toLowerCase() === 'si' || p.disponible === undefined,
    notas: p.notas_restricciones || p.notas || ''
  };
}

// Padroniza o objeto de FAQ para chaves estáveis
function standardizeFAQ(rawFAQ) {
  const f = normalizeKeys(rawFAQ);
  return {
    id: f.id || '',
    pregunta: f.pregunta_frecuente || f.pregunta || '',
    respuesta: f.respuesta_completa || f.respuesta || '',
    tags: f.tags_de_busqueda || f.tags_de_busqueta || f.tags || ''
  };
}

// Padroniza o objeto de filial para chaves estáveis
function standardizeBranch(rawBranch) {
  const b = normalizeKeys(rawBranch);
  return {
    id: b.id || '',
    nombre_ubicacion: b.nombre_ubicacion || b.nombre || b.ubicacion || '',
    direccion: b.direccion || '',
    horario: b.horario || '',
    telefono: b.telefono || '',
    acepta_whatsapp: b.acepta_whatsapp === 'SÍ' || b.acepta_whatsapp === 'SI' || b.acepta_whatsapp === true || String(b.acepta_whatsapp).toLowerCase() === 'si' || String(b.acepta_whatsapp).toLowerCase() === 'yes' || String(b.acepta_whatsapp).toLowerCase() === 'true',
    notas: b.notas || ''
  };
}

// Padroniza o objeto de serviço para chaves estáveis
function standardizeService(rawService) {
  const s = normalizeKeys(rawService);
  return {
    id: s.id || '',
    servicio: s.servicio || '',
    descripcion: s.descripcion || '',
    precio_pyg: s.precio_pyg || 0,
    precio_brl: s.precio_brl || s.precio_r_auto || s.precio_rs_auto || 0,
    requisitos: s.requisitos || '',
    duracion_modalidad: s.duracion_modalidad || s.duracion || s.modalidad || ''
  };
}


/**
 * Constroi o índice Fuse.js para produtos.
 * @param {Array} products 
 */
export function buildProductIndex(products) {
  if (!Array.isArray(products)) {
    logger.warn('Dados de produtos inválidos para indexação.');
    return;
  }

  const standardized = products.map(p => {
    const std = standardizeProduct(p);
    return {
      ...std,
      _nombre: normalizeText(std.nombre),
      _sku: normalizeText(std.sku),
      _categoria: normalizeText(std.categoria)
    };
  });

  productFuse = new Fuse(standardized, {
    keys: [
      { name: '_nombre', weight: 0.5 },
      { name: '_sku', weight: 0.3 },
      { name: '_categoria', weight: 0.15 },
      { name: 'presentacion', weight: 0.05 }
    ],
    threshold: 0.5,
    includeScore: true,
    minMatchCharLength: 3,
    ignoreLocation: true
  });

  logger.info(`Índice de produtos reconstruído com ${standardized.length} itens.`);
}

/**
 * Constroi o índice Fuse.js para FAQs.
 * @param {Array} faqs 
 */
export function buildFAQIndex(faqs) {
  if (!Array.isArray(faqs)) {
    logger.warn('Dados de FAQ inválidos para indexação.');
    return;
  }

  const standardized = faqs.map(f => {
    const std = standardizeFAQ(f);
    return {
      ...std,
      _pregunta: normalizeText(std.pregunta),
      _tags: normalizeText(Array.isArray(std.tags) ? std.tags.join(' ') : std.tags)
    };
  });

  faqFuse = new Fuse(standardized, {
    keys: [
      { name: '_pregunta', weight: 0.6 },
      { name: '_tags', weight: 0.4 }
    ],
    threshold: 0.6,
    includeScore: true,
    ignoreLocation: true
  });

  logger.info(`Índice de FAQ reconstruído com ${standardized.length} itens.`);
}

/**
 * Constroi o índice Fuse.js para filiais (sucursales).
 * @param {Array} branches 
 */
export function buildBranchIndex(branches) {
  if (!Array.isArray(branches)) {
    logger.warn('Dados de filiais inválidos para indexação.');
    return;
  }

  const standardized = branches.map(b => {
    const std = standardizeBranch(b);
    return {
      ...std,
      _nombre_ubicacion: normalizeText(std.nombre_ubicacion),
      _direccion: normalizeText(std.direccion),
      _notas: normalizeText(std.notas)
    };
  });

  branchFuse = new Fuse(standardized, {
    keys: [
      { name: '_nombre_ubicacion', weight: 0.5 },
      { name: '_direccion', weight: 0.3 },
      { name: '_notas', weight: 0.2 }
    ],
    threshold: 0.6,
    includeScore: true,
    ignoreLocation: true
  });

  logger.info(`Índice de filiais reconstruído com ${standardized.length} itens.`);
}

/**
 * Constroi o índice Fuse.js para serviços.
 * @param {Array} services 
 */
export function buildServiceIndex(services) {
  if (!Array.isArray(services)) {
    logger.warn('Dados de serviços inválidos para indexação.');
    return;
  }

  const standardized = services.map(s => {
    const std = standardizeService(s);
    return {
      ...std,
      _servicio: normalizeText(std.servicio),
      _descripcion: normalizeText(std.descripcion),
      _requisitos: normalizeText(std.requisitos)
    };
  });

  serviceFuse = new Fuse(standardized, {
    keys: [
      { name: '_servicio', weight: 0.6 },
      { name: '_descripcion', weight: 0.3 },
      { name: '_requisitos', weight: 0.1 }
    ],
    threshold: 0.6,
    includeScore: true,
    ignoreLocation: true
  });

  logger.info(`Índice de serviços reconstruído com ${standardized.length} itens.`);
}


/**
 * Buscar produtos no catálogo por termo de busca fuzzy.
 * @param {string} query 
 * @param {string} [category] 
 * @returns {Array}
 */
export function searchProducts(query, category = null) {
  if (!productFuse) {
    logger.warn('Tentativa de busca mas índice de produtos não está pronto.');
    return [];
  }
  const q = normalizeText(query);
  let results = productFuse.search(q, { limit: 5 });
  
  if (category) {
    const cat = normalizeText(category);
    results = results.filter(r => normalizeText(r.item.categoria).includes(cat));
  }
  
  // Filtrar matches com score razoável (menor score = melhor match)
  return results.filter(r => r.score < 0.5).map(r => r.item);
}

/**
 * Buscar FAQ por pergunta fuzzy.
 * @param {string} query 
 * @returns {object|null}
 */
export function searchFAQ(query) {
  if (!faqFuse) {
    logger.warn('Tentativa de busca mas índice de FAQ não está pronto.');
    return null;
  }
  
  // Limpar pontuação e normalizar
  const cleanQuery = normalizeText(query).replace(/[?.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ").trim();
  
  // 1. Tentar busca da frase inteira
  let results = faqFuse.search(cleanQuery, { limit: 3 });
  let best = results.find(r => r.score < 0.6);
  if (best) return best.item;
  
  // 2. Se falhar, tentar buscar por palavras individuais da query (fallback por palavras-chave)
  const words = cleanQuery.split(/\s+/).filter(w => w.length >= 3);
  for (const word of words) {
    const wordResults = faqFuse.search(word, { limit: 1 });
    const wordBest = wordResults.find(r => r.score < 0.3); // score estrito para palavras isoladas
    if (wordBest) {
      logger.info(`FAQ encontrado via palavra-chave: '${word}' no FAQ: '${wordBest.item.pregunta}'`);
      return wordBest.item;
    }
  }
  
  return null;
}

/**
 * Listar produtos disponíveis por categoria.
 * @param {string} category 
 * @returns {Array}
 */
export function listByCategory(category) {
  if (!productFuse) {
    logger.warn('Tentativa de listagem mas índice de produtos não está pronto.');
    return [];
  }
  const cat = normalizeText(category);
  // Buscar no catálogo original indexado
  return productFuse._docs
    .filter(p => normalizeText(p.categoria).includes(cat))
    .filter(p => p.disponible)
    .slice(0, 8);
}

/**
 * Buscar filiais por termo de busca fuzzy. Se a query for vazia/geral, retorna todas.
 * @param {string} [query] 
 * @returns {Array}
 */
export function searchBranches(query = '') {
  if (!branchFuse) {
    logger.warn('Tentativa de busca mas índice de filiais não está pronto.');
    return [];
  }

  const q = normalizeText(query).trim();
  const isGeneric = !q || q === 'todas' || q === 'sucursales' || q === 'filiales' || q === 'tiendas' || q === 'locales';

  if (isGeneric) {
    return branchFuse._docs;
  }

  const results = branchFuse.search(q, { limit: 5 });
  return results.filter(r => r.score < 0.6).map(r => r.item);
}

/**
 * Buscar serviços por termo de busca fuzzy. Se a query for vazia/geral, retorna todos.
 * @param {string} [query] 
 * @returns {Array}
 */
export function searchServices(query = '') {
  if (!serviceFuse) {
    logger.warn('Tentativa de busca mas índice de serviços não está pronto.');
    return [];
  }

  const q = normalizeText(query).trim();
  const isGeneric = !q || q === 'todos' || q === 'servicios' || q === 'servicos' || q === 'estetica' || q === 'consultas';

  if (isGeneric) {
    return serviceFuse._docs;
  }

  const results = serviceFuse.search(q, { limit: 5 });
  return results.filter(r => r.score < 0.6).map(r => r.item);
}

