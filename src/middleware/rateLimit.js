/**
 * Rate Limiter por número de telefone
 * Previne spam e uso abusivo do bot
 */

import logger from '../logger.js';

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 10;
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;

// Map<phone, { count: number, resetAt: number }>
const rateLimitMap = new Map();

/**
 * Verifica se o número atingiu o rate limit.
 * @param {string} phone — número de telefone (ex: "595981234567@c.us")
 * @returns {{ allowed: boolean, retryAfterMs: number }}
 */
export function checkRateLimit(phone) {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);

  if (!entry || now >= entry.resetAt) {
    // Primeira mensagem ou janela expirada — resetar contador
    rateLimitMap.set(phone, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfterMs = entry.resetAt - now;
    logger.warn('Rate limit atingido', { phone, count: entry.count, retryAfterMs });
    return { allowed: false, retryAfterMs };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Mensagem amigável de rate limit (multilíngue básico)
 */
export function getRateLimitMessage(retryAfterMs) {
  const seconds = Math.ceil(retryAfterMs / 1000);
  // Detectar idioma não é possível aqui sem histórico — usar espanhol como default
  return `⏳ Muchos mensajes seguidos. Por favor espera ${seconds} segundos antes de continuar. ¡Gracias por tu paciencia! 😊`;
}

/**
 * Limpar entradas expiradas (chamado periodicamente para evitar memory leak)
 */
export function cleanupRateLimits() {
  const now = Date.now();
  let cleaned = 0;
  for (const [phone, entry] of rateLimitMap) {
    if (now >= entry.resetAt) {
      rateLimitMap.delete(phone);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug(`Rate limit cleanup: ${cleaned} entradas removidas`);
  }
}

// Limpeza automática a cada 5 minutos
setInterval(cleanupRateLimits, 5 * 60_000);
