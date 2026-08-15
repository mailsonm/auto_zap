/**
 * ManyChat Webhook Handler
 *
 * Recebe mensagens repassadas pelo bloco "External Request" do ManyChat,
 * processa com o roteador da ARIA (OpenAI + Sheets) e retorna a resposta formatada
 * de acordo com o protocolo do ManyChat v2.
 */

import logger from '../logger.js';

/**
 * Processar requisição POST do ManyChat Webhook.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} rawBody — conteúdo bruto do request
 */
export async function handleManyChatWebhook(req, res, rawBody) {
  try {
    // 1. Validar Token (opcional, configurado no .env)
    const expectedToken = process.env.MANYCHAT_WEBHOOK_TOKEN;
    if (expectedToken) {
      const urlParts = req.url.split('?');
      const queryString = urlParts[1] || '';
      const params = new URLSearchParams(queryString);
      const token = params.get('token') || req.headers['authorization']?.replace('Bearer ', '');
      
      if (token !== expectedToken) {
        logger.warn('ManyChat Webhook: Acesso não autorizado (token inválido)');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }

    // 2. Parsear o body JSON
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (err) {
      logger.warn('ManyChat Webhook: Corpo da requisição inválido (não é JSON)');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const { userId, message } = body;

    if (!userId || !message) {
      logger.warn('ManyChat Webhook: Parâmetros obrigatórios ausentes (userId ou message)', { userId, message });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing userId or message' }));
      return;
    }

    logger.info('ManyChat Webhook: Requisição recebida', { userId, messageLength: message.length });

    // 3. Montar adaptador de mensagem e processar
    const clientPhone = `manychat:${userId}`;
    const msgAdapter = {
      from: clientPhone,
      body: message,
      isGroupMsg: false
    };

    // Importações dinâmicas para evitar dependências circulares
    const { handleMessage } = await import('./router.js');
    const { SAMANTHA_TOOLS, executeTool } = await import('../tools/index.js');
    const { isHumanTakeover } = await import('../session.js');

    const responseText = await handleMessage(msgAdapter, { tools: SAMANTHA_TOOLS, executeTool });
    const takeover = isHumanTakeover(clientPhone);

    // 4. Formatar a resposta no padrão do ManyChat v2
    // Podemos retornar mensagens diretas ou ações (como preencher variáveis)
    const responsePayload = {
      version: 'v2',
      content: {
        actions: [
          {
            action: 'set_field_value',
            field_name: 'human_takeover',
            value: takeover ? 'true' : 'false'
          }
        ],
        messages: []
      }
    };

    if (responseText) {
      responsePayload.content.messages.push({
        type: 'text',
        text: responseText
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(responsePayload));
    
    logger.info('ManyChat Webhook: Resposta enviada com sucesso', {
      userId,
      hasText: !!responseText,
      takeover
    });

  } catch (err) {
    logger.error('Erro ao processar webhook do ManyChat', { error: err.message, stack: err.stack });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
}
