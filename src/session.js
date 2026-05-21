/**
 * Gerenciamento de Sessões WhatsApp
 *
 * Rastreia estado de cada conversa ativa:
 * - Se foi assumida por humano (human takeover)
 * - Último idioma detectado
 * - Timestamp da primeira e última mensagem
 * - Número de turnos da conversa
 */

import logger from './logger.js';

// Map<phone, SessionState>
const sessionMap = new Map();

/**
 * @typedef {Object} SessionState
 * @property {boolean} humanTakeover — humano assumiu o atendimento
 * @property {string} language — último idioma detectado ('es' | 'pt' | 'en')
 * @property {number} startedAt — timestamp do início da conversa
 * @property {number} lastMessageAt — timestamp da última mensagem
 * @property {number} turns — número de turnos (pares user/assistant)
 * @property {string[]} topics — tópicos abordados na conversa
 */

/**
 * Obter ou criar estado de sessão para um número.
 * @param {string} phone
 * @returns {SessionState}
 */
export function getSession(phone) {
  if (!sessionMap.has(phone)) {
    sessionMap.set(phone, {
      humanTakeover: false,
      language: 'es',
      startedAt: Date.now(),
      lastMessageAt: Date.now(),
      turns: 0,
      topics: []
    });
  }
  return sessionMap.get(phone);
}

/**
 * Verificar se um humano assumiu o atendimento.
 * @param {string} phone
 * @returns {boolean}
 */
export function isHumanTakeover(phone) {
  return sessionMap.get(phone)?.humanTakeover === true;
}

/**
 * Marcar conversa como assumida por humano.
 * @param {string} phone
 */
export function setHumanTakeover(phone, active = true) {
  const session = getSession(phone);
  session.humanTakeover = active;
  logger.info(`Human takeover: ${active ? 'ativado' : 'desativado'}`, { phone });
}

/**
 * Incrementar contador de turnos e atualizar timestamp.
 * @param {string} phone
 */
export function incrementTurn(phone) {
  const session = getSession(phone);
  session.turns++;
  session.lastMessageAt = Date.now();
}

/**
 * Adicionar tópico à lista de tópicos da sessão.
 * @param {string} phone
 * @param {string} topic
 */
export function addTopic(phone, topic) {
  const session = getSession(phone);
  if (!session.topics.includes(topic)) {
    session.topics.push(topic);
  }
}

/**
 * Obter resumo da sessão para registrar no histórico.
 * @param {string} phone
 * @returns {object}
 */
export function getSessionSummary(phone) {
  const session = sessionMap.get(phone);
  if (!session) return null;
  return {
    phone,
    startedAt: new Date(session.startedAt).toISOString(),
    language: session.language,
    topics: session.topics.join(', '),
    turns: session.turns,
    outcome: session.humanTakeover ? 'humano' : 'bot'
  };
}

/**
 * Encerrar sessão e retornar resumo (para salvar no Sheets).
 * @param {string} phone
 * @returns {object|null}
 */
export function closeSession(phone) {
  const summary = getSessionSummary(phone);
  sessionMap.delete(phone);
  logger.info('Sessão encerrada', { phone, summary });
  return summary;
}
