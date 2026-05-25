/**
 * Message Queue — Fila de Envio Humanizado
 *
 * Adiciona delay aleatório (1-3 segundos) antes de enviar respostas
 * e marca mensagens como lidas (sendSeen) antes de responder.
 * Objetivo: simular comportamento humano para reduzir risco de banimento
 * pelo WhatsApp/Meta.
 *
 * Phase 5: D-04 (delay humanizado) e D-05 (sendSeen antes de responder)
 */

import logger from '../logger.js';

const MIN_DELAY_MS = parseInt(process.env.MSG_DELAY_MIN_MS) || 1000; // 1 segundo
const MAX_DELAY_MS = parseInt(process.env.MSG_DELAY_MAX_MS) || 3000; // 3 segundos

/**
 * Gerar delay aleatório entre MIN_DELAY_MS e MAX_DELAY_MS.
 */
function randomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
}

/**
 * Aguardar um número de milissegundos.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enviar resposta ao cliente com delay humanizado.
 *
 * 1. Marca a mensagem como lida (sendSeen) — simula que o "atendente" viu
 * 2. Aguarda delay aleatório de 1-3 segundos — simula tempo de digitação
 * 3. Envia a resposta via msg.reply()
 *
 * @param {object} msg — objeto de mensagem do whatsapp-web.js
 * @param {string} response — texto da resposta a enviar
 * @returns {Promise<void>}
 */
export async function sendWithDelay(msg, response) {
  const delayMs = randomDelay();

  // Marcar mensagem como lida antes de responder
  try {
    const chat = await msg.getChat();
    await chat.sendSeen();
    logger.debug('Mensagem marcada como lida (sendSeen)', { from: msg.from });
  } catch (err) {
    // sendSeen pode falhar se o chat não estiver disponível — não bloquear o envio
    logger.warn('Falha ao marcar como lida (sendSeen)', { from: msg.from, error: err.message });
  }

  // Delay humanizado (simula tempo de digitação)
  logger.debug(`Aguardando ${delayMs}ms antes de responder (delay humanizado)`, { from: msg.from });
  await sleep(delayMs);

  // Enviar resposta
  await msg.reply(response);
}
