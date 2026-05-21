/**
 * Claude API Client — ARIA
 *
 * Gerencia histórico de conversas por sessão e integra com Claude API.
 * Suporta tool use (function calling) para busca de produtos, FAQ, etc.
 */

import Anthropic from '@anthropic-ai/sdk';
import logger from './logger.js';
import { getSystemPrompt } from './aria.js';
import { getSystemInfo } from './sheets.js';

const MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022';
const MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS) || 512;
const MAX_HISTORY = parseInt(process.env.MAX_HISTORY_MESSAGES) || 20;
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT_MS) || 30 * 60_000;
const MAX_TOOL_ITERATIONS = 3;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Map<phone, { messages: Message[], lastActivity: number, language: string }>
const sessions = new Map();

// ─── Gerenciamento de Sessão ─────────────────────────────────────────────────

/**
 * Obter ou criar sessão para um número.
 */
function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, {
      messages: [],
      lastActivity: Date.now(),
      language: 'es'
    });
  }
  return sessions.get(phone);
}

/**
 * Trimmar histórico para manter apenas as últimas N mensagens.
 */
function trimHistory(session) {
  if (session.messages.length > MAX_HISTORY) {
    // Manter sempre os primeiros 2 (saudação inicial) + últimos (MAX_HISTORY - 2)
    const keep = MAX_HISTORY - 2;
    const recent = session.messages.slice(-keep);
    session.messages = [...session.messages.slice(0, 2), ...recent];
    logger.debug('Histórico trimado', { length: session.messages.length });
  }
}

/**
 * Limpar sessões inativas (chamado periodicamente).
 */
export function cleanupSessions() {
  const now = Date.now();
  let cleaned = 0;
  for (const [phone, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessions.delete(phone);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.info(`Sessões expiradas limpas: ${cleaned}`);
  }
}

// Cleanup automático a cada 10 minutos
setInterval(cleanupSessions, 10 * 60_000);

// ─── Chat Principal ──────────────────────────────────────────────────────────

/**
 * Enviar mensagem ao Claude e obter resposta.
 *
 * @param {string} phone — número de telefone (ex: "595981234567@c.us")
 * @param {string} userMessage — mensagem do cliente
 * @param {object} [options]
 * @param {Array}  [options.tools] — definições de tools para tool use
 * @param {Function} [options.executeTool] — dispatcher de tools
 * @returns {Promise<string>} — resposta da ARIA
 */
export async function chat(phone, userMessage, options = {}) {
  const { tools = null, executeTool = null } = options;
  const session = getSession(phone);
  session.lastActivity = Date.now();

  // Adicionar mensagem do usuário ao histórico
  session.messages.push({ role: 'user', content: userMessage });

  // Obter dados da empresa para construir system prompt
  let companyData = {};
  try {
    companyData = await getSystemInfo();
  } catch (err) {
    logger.warn('Não foi possível carregar dados da empresa', { error: err.message });
  }

  const systemPrompt = getSystemPrompt(companyData);

  // Loop de tool use (máximo MAX_TOOL_ITERATIONS)
  let response;
  let workingMessages = [...session.messages];
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const requestOptions = {
      model: MODEL,
      system: systemPrompt,
      messages: workingMessages,
      max_tokens: MAX_TOKENS
    };

    if (tools && tools.length > 0) {
      requestOptions.tools = tools;
    }

    try {
      response = await anthropic.messages.create(requestOptions);
    } catch (err) {
      logger.error('Erro na Claude API', { phone, error: err.message, status: err.status });

      // Resposta de fallback em caso de erro
      const fallback = '😔 Tuve un problema técnico. Por favor intenta de nuevo en un momento.';
      session.messages.push({ role: 'assistant', content: fallback });
      trimHistory(session);
      return fallback;
    }

    // Resposta final (sem tool use)
    if (response.stop_reason !== 'tool_use' || !tools || !executeTool) {
      break;
    }

    // Processar tool calls
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');

    logger.info(`Tool use: ${toolUseBlocks.map(b => b.name).join(', ')}`, { phone, iteration: iterations });

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        try {
          const result = await executeTool(block.name, block.input);
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result)
          };
        } catch (err) {
          logger.error(`Erro ao executar tool ${block.name}`, { error: err.message });
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ erro: err.message }),
            is_error: true
          };
        }
      })
    );

    // Atualizar histórico de trabalho para próxima iteração
    workingMessages = [
      ...workingMessages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults }
    ];
  }

  // Extrair texto da resposta final
  const assistantText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  // Salvar no histórico persistente (somente exchange simplificado)
  session.messages.push({ role: 'assistant', content: assistantText });
  trimHistory(session);

  logger.info('Resposta gerada', {
    phone,
    inputLength: userMessage.length,
    outputLength: assistantText.length,
    iterations,
    model: MODEL
  });

  return assistantText;
}

/**
 * Verificar se uma sessão está ativa.
 */
export function hasActiveSession(phone) {
  return sessions.has(phone);
}

/**
 * Limpar sessão manualmente (ex: quando humano assume atendimento).
 */
export function clearSession(phone) {
  sessions.delete(phone);
  logger.info('Sessão encerrada manualmente', { phone });
}

/**
 * Obter idioma detectado da sessão.
 */
export function getSessionLanguage(phone) {
  return sessions.get(phone)?.language || 'es';
}

/**
 * Atualizar idioma da sessão.
 */
export function setSessionLanguage(phone, language) {
  const session = getSession(phone);
  session.language = language;
}
