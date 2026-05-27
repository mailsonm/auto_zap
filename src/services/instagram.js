/**
 * Instagram Send API Service
 *
 * Envia mensagens DMs de texto aos clientes pelo canal Instagram comercial
 * usando a API de Envio da Meta (Meta Graph API).
 *
 * Phase 8: INSTA-03, INSTA-06
 */

import logger from '../logger.js';

/**
 * Envia uma mensagem de direct (DM) para o usuário do Instagram.
 * Adiciona automaticamente o caractere invisível \u200B no final para controle de loop.
 *
 * @param {string} recipientId — ID do usuário do Instagram do cliente
 * @param {string} text — texto da mensagem a enviar
 * @returns {Promise<object>} — resultado do request em JSON
 */
export async function sendInstagramMessage(recipientId, text) {
  const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

  if (!token) {
    logger.error('Erro ao enviar mensagem: INSTAGRAM_PAGE_ACCESS_TOKEN não configurada no .env');
    throw new Error('INSTAGRAM_PAGE_ACCESS_TOKEN is missing');
  }

  // Adiciona o caractere invisível zero-width space para controle de auto-takeover
  const textWithMarker = text + '\u200B';

  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(token)}`;

  logger.debug('Enviando DM para o Instagram', { recipientId, length: text.length });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: {
          id: recipientId
        },
        message: {
          text: textWithMarker
        }
      })
    });

    const responseData = await response.json();

    if (!response.ok) {
      logger.error('Meta Send API retornou erro', {
        status: response.status,
        error: responseData
      });
      throw new Error(`Meta API error: ${JSON.stringify(responseData.error || responseData)}`);
    }

    logger.debug('DM enviada com sucesso ao Instagram', { recipientId, messageId: responseData.message_id });
    return responseData;
  } catch (err) {
    logger.error('Erro ao chamar Meta Send API', { recipientId, error: err.message });
    throw err;
  }
}
