/**
 * OpenAI API Client — Samantha
 *
 * Gerencia histórico de conversas por sessão e integra com a OpenAI API.
 * Suporta tool use (Function Calling) para busca de produtos, FAQ, etc.
 * Substitui o cliente Claude mantendo a mesma assinatura e interface.
 */

import OpenAI from 'openai';
import logger from './logger.js';
import { getSystemPrompt } from './aria.js';
import { getSystemInfo, appendHistory } from './sheets.js';
import { closeSession } from './session.js';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_TOKENS = parseInt(process.env.OPENAI_MAX_TOKENS) || 512;
const MAX_HISTORY = parseInt(process.env.MAX_HISTORY_MESSAGES) || 20;
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT_MS) || 30 * 60_000;
const MAX_TOOL_ITERATIONS = 3;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Map<phone, { messages: Message[], lastActivity: number, language: string }>
export const sessions = new Map();

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
 * Trimmar histórico para manter apenas as últimas N mensagens de chat simples.
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
      try {
        const summary = closeSession(phone);
        if (summary) {
          appendHistory(summary).catch(err => {
            logger.warn('Falha ao salvar histórico por timeout', { phone, error: err.message });
          });
        }
      } catch (err) {
        logger.warn('Erro ao fechar sessão no timeout', { phone, error: err.message });
      }
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
 * Enviar mensagem à OpenAI (GPT) e obter resposta.
 *
 * @param {string} phone — número de telefone (ex: "595981234567@c.us")
 * @param {string} userMessage — mensagem do cliente
 * @param {object} [options]
 * @param {Array}  [options.tools] — definições de tools no formato Anthropic
 * @param {Function} [options.executeTool] — dispatcher de tools
 * @returns {Promise<string>} — resposta da Samantha
 */
export async function chat(phone, userMessage, options = {}) {
  const { tools = null, executeTool = null } = options;
  const session = getSession(phone);
  session.lastActivity = Date.now();

  // Adicionar mensagem do usuário ao histórico local (formato simples)
  session.messages.push({ role: 'user', content: userMessage });

  // Obter dados da empresa para construir system prompt
  let companyData = {};
  try {
    companyData = await getSystemInfo();
  } catch (err) {
    logger.warn('Não foi possível carregar dados da empresa', { error: err.message });
  }

  const systemPrompt = getSystemPrompt(companyData);

  // Mapear ferramentas do formato Anthropic para o formato OpenAI
  let openaiTools = null;
  if (tools && tools.length > 0) {
    openaiTools = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema
      }
    }));
  }

  // Montar mensagens de trabalho para a chamada da API
  // OpenAI precisa das mensagens no formato padrão: { role, content, name, tool_calls, tool_call_id }
  let workingMessages = [
    { role: 'system', content: systemPrompt },
    ...session.messages
  ];

  let responseMessage;
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    try {
      const apiOptions = {
        model: MODEL,
        messages: workingMessages,
        max_tokens: MAX_TOKENS
      };

      if (openaiTools && openaiTools.length > 0) {
        apiOptions.tools = openaiTools;
      }

      const completion = await openai.chat.completions.create(apiOptions);
      responseMessage = completion.choices[0].message;

      // Adicionar resposta do assistente (que pode conter tool_calls) ao histórico temporário
      workingMessages.push(responseMessage);
    } catch (err) {
      logger.error('Erro na OpenAI API', { phone, error: err.message });

      // Resposta de fallback em caso de erro
      const fallback = '😔 Tuve un problema técnico. Por favor intenta de nuevo en un momento.';
      session.messages.push({ role: 'assistant', content: fallback });
      trimHistory(session);
      return fallback;
    }

    // Se não houver tool_calls, a resposta final foi obtida
    if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0 || !executeTool) {
      break;
    }

    // Processar chamadas de ferramentas
    logger.info(`Tool use (OpenAI): ${responseMessage.tool_calls.map(tc => tc.function.name).join(', ')}`, { phone, iteration: iterations });

    for (const toolCall of responseMessage.tool_calls) {
      const toolName = toolCall.function.name;
      let toolInput = {};
      try {
        toolInput = JSON.parse(toolCall.function.arguments);
      } catch (jsonErr) {
        logger.error(`Falha ao fazer parse dos argumentos da tool ${toolName}`, { arguments: toolCall.function.arguments });
      }

      let toolResult;
      try {
        toolResult = await executeTool(toolName, toolInput, phone);
      } catch (err) {
        logger.error(`Erro ao executar tool ${toolName}`, { error: err.message });
        toolResult = { error: err.message };
      }

      // Adicionar a resposta da ferramenta no histórico temporário
      workingMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolName,
        content: JSON.stringify(toolResult)
      });
    }
  }

  // Obter texto final da resposta
  const assistantText = (responseMessage.content || '').trim();

  // Salvar no histórico de conversa persistente do usuário (formato texto simples)
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
