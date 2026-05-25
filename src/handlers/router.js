/**
 * Router Principal de Mensagens — Samantha
 *
 * Recebe mensagens do WhatsApp e orquestra:
 * 1. Rate limiting
 * 2. Verificação de human takeover
 * 3. Detecção de pedido de humano
 * 4. Chamada à OpenAI (com tools quando disponíveis)
 * 5. Registro de sessão
 */

import logger from '../logger.js';
import { chat, clearSession, setSessionLanguage } from '../openai.js';
import { checkRateLimit, getRateLimitMessage } from '../middleware/rateLimit.js';
import {
  getSession,
  isHumanTakeover,
  setHumanTakeover,
  incrementTurn,
  addTopic,
  closeSession
} from '../session.js';
import { appendHistory, fetchBotControlStatus, updateBotStatusInSheets } from '../sheets.js';

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

  // Obter (ou criar) sessão para este número
  const session = getSession(phone);

  // ── Rate Limiting ──────────────────────────────────────────────────────────
  const { allowed, retryAfterMs, inCooldown } = checkRateLimit(phone);
  if (!allowed) {
    const lang = session?.language || 'es';
    return getRateLimitMessage(retryAfterMs, lang, inCooldown);
  }

  // ── Sincronização de Controle com o Sheets ──────────────────────────────────
  try {
    const sheetsStatus = await fetchBotControlStatus(phone);
    if (sheetsStatus === 'Ativo') {
      if (isHumanTakeover(phone)) {
        logger.info('Reativando bot via painel Google Sheets (Ativo)', { phone });
        setHumanTakeover(phone, false);
      }
    } else if (sheetsStatus === 'Inativo') {
      if (!isHumanTakeover(phone)) {
        logger.info('Pausando bot indefinidamente via painel Google Sheets (Inativo)', { phone });
        setHumanTakeover(phone, true, true);
      }
    }
  } catch (err) {
    logger.warn('Erro ao sincronizar status de controle com Sheets', { phone, error: err.message });
  }

  // ── Human Takeover Ativo ───────────────────────────────────────────────────
  if (isHumanTakeover(phone)) {
    logger.info('Mensagem ignorada — human takeover ativo', { phone });
    return null; // Humano está atendendo — Samantha não interfere
  }

  // Detecção ativa de idioma na sessão
  const detectedLang = detectLanguage(text);
  if (detectedLang) {
    session.language = detectedLang;
    setSessionLanguage(phone, detectedLang);
    logger.info(`Idioma detectado e atualizado: ${detectedLang}`, { phone });
  }

  incrementTurn(phone);

  // ── Pedido de Atendimento Humano ───────────────────────────────────────────
  if (isHumanRequest(text)) {
    setHumanTakeover(phone, true);
    updateBotStatusInSheets(phone, 'Pausado (Humano)');
    addTopic(phone, 'human_request');

    // Salvar histórico antes de sair
    const summary = closeSession(phone);
    if (summary) {
      appendHistory(summary).catch(err =>
        logger.warn('Falha ao salvar histórico', { error: err.message })
      );
    }

    // Limpar histórico OpenAI correspondente
    clearSession(phone);

    const lang = session.language || 'es';
    const msg = HANDOFF_MESSAGES[lang] || HANDOFF_MESSAGES.es;
    logger.info('Encaminhamento para humano', { phone, language: lang });
    return msg;
  }

  // ── Resposta Samantha via OpenAI ───────────────────────────────────────────
  try {
    const response = await chat(phone, text, toolOptions);
    return response;
  } catch (err) {
    logger.error('Erro ao processar mensagem', { phone, error: err.message });
    return '😔 Disculpa, tuve un problema. Por favor intenta de nuevo.';
  }
}

/**
 * Detecção leve de idioma baseada em vocabulário comum.
 * @param {string} text
 * @returns {'pt'|'es'|'en'|null}
 */
export function detectLanguage(text) {
  const clean = text.toLowerCase();
  
  const ptWords = /(?<=^|[^a-záéíóúçñãõâêîôûàèìòù])(?:olá|ola|bom\s+dia|boa\s+tarde|boa\s+noite|obrigado|obrigada|tchau|filial|filiais|endereço|endereco|preço|preços|preco|precos|você|voce|tem|onde|quero|preciso|por\s+favor)(?=[^a-záéíóúçñãõâêîôûàèìòù]|$)/gi;
  const esWords = /(?<=^|[^a-záéíóúçñãõâêîôûàèìòù])(?:hola|buenos\s+dias|buenos\s+días|buenas\s+tardes|buenas\s+noches|gracias|adios|adiós|sucursal|sucursales|dirección|direccion|precio|precios|tienen|donde|dónde|quiero|necesito|por\s+favor)(?=[^a-záéíóúçñãõâêîôûàèìòù]|$)/gi;
  const enWords = /(?<=^|[^a-záéíóúçñãõâêîôûàèìòù])(?:hello|hi|good\s+morning|good\s+afternoon|good\s+evening|thanks|thank\s+you|please|bye|goodbye|branch|branches|address|price|prices|where|want|need|have)(?=[^a-záéíóúçñãõâêîôûàèìòù]|$)/gi;
  
  let ptScore = (clean.match(ptWords) || []).length;
  let esScore = (clean.match(esWords) || []).length;
  let enScore = (clean.match(enWords) || []).length;
  
  if (ptScore === 0 && esScore === 0 && enScore === 0) {
    const ptShort = /(?<=^|[^a-záéíóúçñãõâêîôûàèìòù])(?:o|e|do|da|no|na|com|para|um|uma)(?=[^a-záéíóúçñãõâêîôûàèìòù]|$)/gi;
    const esShort = /(?<=^|[^a-záéíóúçñãõâêîôûàèìòù])(?:el|y|del|al|con|para|un|una)(?=[^a-záéíóúçñãõâêîôûàèìòù]|$)/gi;
    const enShort = /(?<=^|[^a-záéíóúçñãõâêîôûàèìòù])(?:the|and|of|to|with|for|an|you|is|are)(?=[^a-záéíóúçñãõâêîôûàèìòù]|$)/gi;
    
    ptScore = (clean.match(ptShort) || []).length;
    esScore = (clean.match(esShort) || []).length;
    enScore = (clean.match(enShort) || []).length;
  }
  
  if (ptScore > esScore && ptScore > enScore) return 'pt';
  if (esScore > ptScore && esScore > enScore) return 'es';
  if (enScore > ptScore && enScore > esScore) return 'en';
  
  return null;
}
