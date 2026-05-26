/**
 * Google Sheets Client via App Script
 *
 * O App Script publicado como Web App expõe um endpoint HTTP que:
 * - GET  ?sheet=<nome>                → retorna array de objetos (linhas da aba)
 * - POST { sheet, action, data }      → insere/atualiza dados
 *
 * Este módulo adiciona cache em memória para dados estáticos (produtos, FAQs, etc.)
 * e mantém escritas (leads, histórico) sem cache.
 */

import logger from './logger.js';

const SCRIPT_URL = process.env.GOOGLE_SHEETS_SCRIPT_URL;
const CACHE_TTL = parseInt(process.env.SHEETS_CACHE_TTL_MS) || 15 * 60_000;       // 15 min
const SYSTEM_CACHE_TTL = parseInt(process.env.SHEETS_SYSTEM_CACHE_TTL_MS) || 60 * 60_000; // 1h

if (!SCRIPT_URL) {
  logger.error('GOOGLE_SHEETS_SCRIPT_URL não definida no .env');
}

// Cache: Map<sheetName, { data: any[], fetchedAt: number, ttl: number }>
const cache = new Map();

// Callbacks para notificar quando cache é renovado (usado por search.js para reindexar)
const onRefreshCallbacks = new Map();

/**
 * Registrar callback para ser chamado quando uma aba específica atualizar o cache.
 * @param {string} sheetName
 * @param {Function} callback — recebe (data: any[])
 */
export function onCacheRefresh(sheetName, callback) {
  onRefreshCallbacks.set(sheetName, callback);
}

/**
 * Buscar dados de uma aba do Sheets (com cache).
 * @param {string} sheetName — nome da aba no Google Sheets
 * @param {number} [ttl] — TTL customizado em ms
 * @returns {Promise<any[]>}
 */
async function getSheet(sheetName, ttl = CACHE_TTL) {
  const cached = cache.get(sheetName);
  if (cached && Date.now() - cached.fetchedAt < cached.ttl) {
    logger.debug(`Cache hit: ${sheetName}`);
    return cached.data;
  }

  logger.info(`Buscando dados: ${sheetName}`);
  const data = await fetchWithRetry(`${SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}`);

  cache.set(sheetName, { data, fetchedAt: Date.now(), ttl });

  // Notificar listeners de refresh
  const cb = onRefreshCallbacks.get(sheetName);
  if (cb) {
    try { cb(data); } catch (e) { logger.warn(`Erro em callback onRefresh(${sheetName})`, { error: e.message }); }
  }

  logger.info(`${sheetName}: ${data.length} registros carregados`);
  return data;
}

/**
 * Fetch com retry (1 tentativa) e timeout de 10s.
 */
async function fetchWithRetry(url, options = {}, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    // App Script pode retornar { data: [] } ou diretamente []
    return Array.isArray(json) ? json : (json.data || json.rows || []);
  } catch (err) {
    clearTimeout(timeout);
    if (attempt < 2) {
      logger.warn(`Retry fetch (tentativa ${attempt + 1})`, { url, error: err.message });
      await sleep(1000);
      return fetchWithRetry(url, options, attempt + 1);
    }
    logger.error(`Falha ao buscar dados do Sheets`, { url, error: err.message });
    throw err;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Escrever dados em uma aba (sem cache — sempre vai ao Sheets).
 * @param {string} sheetName
 * @param {object} data
 */
async function postSheet(sheetName, data) {
  logger.info(`Escrevendo em: ${sheetName}`, { data });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet: sheetName, ...data }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    logger.debug(`Escrita OK: ${sheetName}`, { result });
    return result;
  } catch (err) {
    clearTimeout(timeout);
    logger.error(`Falha ao escrever no Sheets`, { sheetName, error: err.message });
    throw err;
  }
}

// ─── API Pública ─────────────────────────────────────────────────────────────

/** Dados gerais da empresa (cache 1h) */
export const getSystemInfo = () => getSheet('sistema', SYSTEM_CACHE_TTL).then(rows => rows[0] || {});

/** Catálogo de produtos (cache 15min) */
export const getProducts = () => getSheet('productos');

/** Filiais (cache 15min) */
export const getBranches = () => getSheet('sucursales');

/** Serviços (cache 15min) */
export const getServices = () => getSheet('serviços');

/** FAQs (cache 15min) */
export const getFAQs = () => getSheet('faqs');

/** Registrar lead (sem cache) */
export function appendLead(lead) {
  return postSheet('leads', {
    action: 'append',
    data: {
      telefone: lead.phone,
      nome: lead.name || '',
      produto_servico: lead.interest || '',
      data_hora: new Date().toISOString(),
      idioma: lead.language || 'es',
      notas: lead.notes || ''
    }
  });
}

/** Registrar histórico de conversa (sem cache) */
export function appendHistory(history) {
  return postSheet('historico', {
    action: 'append',
    data: {
      telefone: history.phone,
      data_inicio: history.startedAt,
      data_fim: new Date().toISOString(),
      idioma: history.language || 'es',
      topicos: history.topics || '',
      desfecho: history.outcome || 'encerrado',
      turnos: history.turns || 0
    }
  });
}

/** Registrar status do bot para controle de atendimento */
export function updateBotStatusInSheets(phone, status) {
  // Se for 'Pausado (Humano)' ou 'Inativo', gravamos true (marcado). Se for 'Ativo', gravamos false (desmarcado).
  const isPausado = (status === 'Pausado (Humano)' || status === 'Inativo');

  // Invalida cache local imediatamente para que leituras paralelas não vejam dados defasados
  invalidateCache('controle');

  return postSheet('controle', {
    action: 'append',
    data: {
      telefone: phone,
      status: isPausado, // true marca o checkbox, false desmarca
      data_hora: new Date().toISOString()
    }
  }).then(res => {
    // Invalida novamente pós-sucesso para garantir dados frescos
    invalidateCache('controle');
    return res;
  }).catch(err => {
    logger.error('Erro ao atualizar status do bot no Sheets', { phone, status, error: err.message });
  });
}

/** Buscar status atual de controle do bot para um contato no Sheets */
export async function fetchBotControlStatus(phone) {
  try {
    // Ler a aba controle com cache curto de 10 segundos
    const rows = await getSheet('controle', 10_000);
    const userRows = rows.filter(r => {
      const rowPhone = String(r.telefone || '').replace(/\D/g, '');
      const searchPhone = String(phone || '').replace(/\D/g, '');
      return rowPhone === searchPhone;
    });

    if (userRows.length === 0) return null;
    // Retornar o status da última linha registrada para o telefone
    return userRows[userRows.length - 1].status;
  } catch (err) {
    logger.warn('Falha ao obter status de controle do bot do Sheets', { phone, error: err.message });
    return null;
  }
}

/** Invalidar cache de uma aba (força refetch na próxima chamada) */
export function invalidateCache(sheetName) {
  cache.delete(sheetName);
  logger.debug(`Cache invalidado: ${sheetName}`);
}
