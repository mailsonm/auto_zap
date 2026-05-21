/**
 * Router Principal de Mensagens — ARIA
 *
 * Recebe mensagens do WhatsApp e orquestra:
 * 1. Rate limiting
 * 2. Verificação de human takeover
 * 3. Detecção de pedido de humano
 * 4. Chamada ao Claude (com tools quando disponíveis)
 * 5. Registro de sessão
 */

import logger from '../logger.js';
import { chat } from '../claude.js';
import { checkRateLimit, getRateLimitMessage } from '../middleware/rateLimit.js';
import {
  getSession,
  isHumanTakeover,
  setHumanTakeover,
  incrementTurn,
  addTopic,
  closeSession
} from '../session.js';
import { appendHistory } from '../sheets.js';

// Padrões de pedido de atendimento humano (multilíngue)
const HUMAN_REQUEST_PATTERNS = [
  // Espanhol
  /\b(quiero|necesito|quisiera|hablar|habla|persona|humano|asesor|agente|vendedor|atendente)\b/i,
  /\b(con alguien|con una persona|no (es|eres) robot|ayuda humana)\b/i,
  // Português
  /\b(quero|falar|preciso|pessoa|humano|atendente|operador|gerente)\b/i,
  /\b(falar com (alguém|uma pessoa|um humano|atendente))\b/i,
  // Inglês
  /\b(human|agent|person|representative|speak to|talk to someone)\b/i
];

function isHumanRequest(text) {
  return HUMAN_REQUEST_PATTERNS.some(p => p.test(text));
}

// Mensagens de encaminhamento para humano (por idioma)
const HANDOFF_MESSAGES = {
  es: '¡Entendido! 😊 Voy a avisar a uno de nuestros asesores para que te atienda. Por favor espera un momento.',
  pt: 'Entendido! 😊 Vou chamar um dos nossos atendentes para te ajudar. Por favor, aguarde um momento.',
  en: 'Got it! 😊 I\'ll connect you with one of our team members right away. Please hold on.'
};

/**
 * Processar mensagem recebida do WhatsApp.
 *
 * @param {object} msg — objeto de mensagem do whatsapp-web.js
 * @param {object} [toolOptions] — { tools, executeTool } para Phase 2+
 * @returns {Promise<string|null>} — resposta a enviar, ou null se não responder
 */
export async function handleMessage(msg, toolOptions = {}) {
  const phone = msg.from;
  const text = (msg.body || '').trim();

  // Ignorar mensagens vazias ou de mídia sem legenda
  if (!text) return null;

  // Ignorar mensagens de grupos (só atender 1:1)
  if (msg.isGroupMsg || msg.from.includes('@g.us')) {
    logger.debug('Mensagem de grupo ignorada', { from: phone });
    return null;
  }

  logger.info('Mensagem recebida', { phone, length: text.length });

  // ── Rate Limiting ──────────────────────────────────────────────────────────
  const { allowed, retryAfterMs } = checkRateLimit(phone);
  if (!allowed) {
    return getRateLimitMessage(retryAfterMs);
  }

  // ── Human Takeover Ativo ───────────────────────────────────────────────────
  if (isHumanTakeover(phone)) {
    logger.info('Mensagem ignorada — human takeover ativo', { phone });
    return null; // Humano está atendendo — ARIA não interfere
  }

  const session = getSession(phone);
  incrementTurn(phone);

  // ── Pedido de Atendimento Humano ───────────────────────────────────────────
  if (isHumanRequest(text)) {
    setHumanTakeover(phone, true);
    addTopic(phone, 'human_request');

    // Salvar histórico antes de sair
    const summary = closeSession(phone);
    if (summary) {
      appendHistory(summary).catch(err =>
        logger.warn('Falha ao salvar histórico', { error: err.message })
      );
    }

    const lang = session.language || 'es';
    const msg = HANDOFF_MESSAGES[lang] || HANDOFF_MESSAGES.es;
    logger.info('Encaminhamento para humano', { phone, language: lang });
    return msg;
  }

  // ── Resposta ARIA via Claude ───────────────────────────────────────────────
  try {
    const response = await chat(phone, text, toolOptions);
    return response;
  } catch (err) {
    logger.error('Erro ao processar mensagem', { phone, error: err.message });
    return '😔 Disculpa, tuve un problema. Por favor intenta de nuevo.';
  }
}
