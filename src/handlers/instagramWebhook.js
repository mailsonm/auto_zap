/**
 * Instagram Webhook Handler
 *
 * Processa a verificação de assinatura (GET) e o recebimento de mensagens (POST)
 * do webhook do Instagram Graph API da Meta.
 *
 * Phase 7: INSTA-01, INSTA-02
 */

import logger from '../logger.js';
import { validateMetaSignature } from '../middleware/metaSignature.js';
import { setHumanTakeover } from '../session.js';
import { updateBotStatusInSheets } from '../sheets.js';

/**
 * Processar requisição GET de verificação da assinatura do Webhook.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
export function handleGETVerification(req, res) {
  try {
    const urlParts = req.url.split('?');
    const queryString = urlParts[1] || '';
    const params = new URLSearchParams(queryString);

    const mode = params.get('hub.mode');
    const token = params.get('hub.verify_token');
    const challenge = params.get('hub.challenge');

    const expectedToken = process.env.META_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === expectedToken) {
      logger.info('Meta Webhook: Assinatura verificada com sucesso!');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(challenge);
    } else {
      logger.warn('Meta Webhook: Falha na verificação de assinatura. Token incorreto ou ausente.', {
        mode,
        tokenReceived: token
      });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden' }));
    }
  } catch (err) {
    logger.error('Erro ao verificar webhook da Meta', { error: err.message });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
}

/**
 * Processar requisição POST com eventos de mensagens vindos do Instagram.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} rawBody — conteúdo bruto do request para validação HMAC
 */
export function handlePOSTWebhook(req, res, rawBody) {
  const signature = req.headers['x-hub-signature-256'];

  // Validar assinatura HMAC-SHA256
  if (!validateMetaSignature(rawBody, signature)) {
    logger.warn('Meta Webhook: Assinatura inválida no POST');
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    const payload = JSON.parse(rawBody);

    // Garantir que é um evento do tipo instagram
    if (payload.object !== 'instagram') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unsupported object type' }));
      return;
    }

    // Processar mensagens recebidas no payload
    const entries = payload.entry || [];
    for (const entry of entries) {
      const messagingEvents = entry.messaging || [];
      for (const event of messagingEvents) {
        // Ignora se não for evento de mensagem
        if (!event.message) {
          continue;
        }

        // Se for uma mensagem ecoada (enviada pela própria página comercial)
        if (event.message.is_echo) {
          const text = event.message.text || '';
          
          // Se não contiver o caractere invisível \u200B, foi uma intervenção manual do atendente
          if (!text.includes('\u200B')) {
            const clientPhone = `insta:${event.recipient.id}`;
            logger.info('Meta Webhook: Intervenção humana detectada no Instagram (mensagem manual enviada)', { to: clientPhone });
            
            // Ativar takeover localmente e sincronizar com Google Sheets
            setHumanTakeover(clientPhone, true);
            updateBotStatusInSheets(clientPhone, 'Pausado (Humano)');
          } else {
            logger.debug('Meta Webhook: Ignorando eco enviado pelo próprio bot', { recipientId: event.recipient.id });
          }
          continue;
        }

        // Mensagem vinda do cliente
        const senderId = event.sender.id;
        const recipientId = event.recipient.id;
        const messageText = event.message.text || '';

        logger.info('Meta Webhook: DM do Instagram recebida', {
          senderId,
          recipientId,
          text: messageText
        });
      }
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EVENT_RECEIVED');
  } catch (err) {
    logger.error('Erro ao processar payload do webhook da Meta', { error: err.message });
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad Request' }));
  }
}
