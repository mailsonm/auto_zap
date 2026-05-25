/**
 * Health Check Server — ARIA
 *
 * Servidor HTTP nativo (sem Express) exposto na porta 8080.
 * Endpoint: GET /health
 * Retorna: status, uptime, sessões ativas, estado da conexão WhatsApp, timestamp.
 * Protegido por token (Authorization: Bearer <token> ou ?token=<token>)
 *
 * Phase 5: D-10, D-11, D-12
 */

import http from 'http';
import logger from './logger.js';
import { sessions } from './claude.js';

// Estado interno do módulo (atualizado via setWAConnected)
let waConnected = false;
const startTime = Date.now();

/**
 * Atualizar o estado de conexão do WhatsApp.
 * Deve ser chamado pelos eventos 'ready' e 'disconnected' / change_state em src/index.js.
 *
 * @param {boolean} connected
 */
export function setWAConnected(connected) {
  waConnected = connected;
  logger.debug(`Health: waConnected = ${connected}`);
}

/**
 * Iniciar o servidor HTTP de health check.
 * Deve ser chamado no startup de src/index.js.
 *
 * @returns {http.Server}
 */
export function startHealthServer() {
  const PORT = parseInt(process.env.HEALTH_PORT) || 8080;
  const TOKEN = process.env.HEALTH_TOKEN || null;

  const server = http.createServer((req, res) => {
    const urlPath = req.url?.split('?')[0];

    // Apenas GET /health é aceito
    if (req.method !== 'GET' || urlPath !== '/health') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    // Verificar token de autenticação (apenas se HEALTH_TOKEN estiver configurado)
    if (TOKEN) {
      const authHeader = req.headers['authorization'];
      const queryString = req.url?.split('?')[1] || '';
      const urlToken = new URLSearchParams(queryString).get('token');
      const providedToken = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : urlToken;

      if (providedToken !== TOKEN) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        logger.warn('Health check: tentativa sem token válido', {
          ip: req.socket.remoteAddress
        });
        return;
      }
    }

    // Retornar dados de saúde
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const payload = {
      status: waConnected ? 'ok' : 'degraded',
      uptime: uptimeSeconds,
      activeSessions: sessions.size,
      waConnected,
      timestamp: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));

    logger.debug('Health check respondido', {
      status: payload.status,
      sessions: payload.activeSessions,
      uptime: uptimeSeconds
    });
  });

  server.on('error', (err) => {
    logger.error('Erro no servidor de health check', { error: err.message, port: PORT });
  });

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`🩺 Health check server rodando em http://0.0.0.0:${PORT}/health`);
  });

  return server;
}
