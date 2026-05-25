/**
 * Rate Limiter por número de telefone
 * Previne spam e uso abusivo do bot
 * Phase 5: 5 msg/min + cooldown estendido após 3 violações consecutivas
 */

import logger from '../logger.js';

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 5;
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const COOLDOWN_VIOLATIONS = 3;            // Violações antes do cooldown
const COOLDOWN_DURATION_MS = 10 * 60_000; // 10 minutos de cooldown

// Map<phone, { count: number, resetAt: number, violationCount: number, cooldownUntil: number }>
const rateLimitMap = new Map();

/**
 * Verifica se o número atingiu o rate limit.
 * @param {string} phone — número de telefone
 * @returns {{ allowed: boolean, retryAfterMs: number, inCooldown: boolean }}
 */
export function checkRateLimit(phone) {
  const now = Date.now();
  const entry = rateLimitMap.get(phone) ?? {
    count: 0,
    resetAt: now + RATE_LIMIT_WINDOW_MS,
    violationCount: 0,
    cooldownUntil: 0
  };

  // Verificar cooldown estendido (após 3+ violações consecutivas)
  if (entry.cooldownUntil > now) {
    const retryAfterMs = entry.cooldownUntil - now;
    logger.warn('Cliente em cooldown estendido', { phone, retryAfterSec: Math.ceil(retryAfterMs / 1000) });
    return { allowed: false, retryAfterMs, inCooldown: true };
  }

  // Nova janela: resetar contador
  if (now >= entry.resetAt) {
    // Se a janela anterior foi limpa (sem violação), resetar violationCount
    if (entry.count < RATE_LIMIT_MAX) {
      entry.violationCount = 0;
    }
    entry.count = 1;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitMap.set(phone, entry);
    return { allowed: true, retryAfterMs: 0, inCooldown: false };
  }

  // Dentro da janela atual: verificar limite
  if (entry.count >= RATE_LIMIT_MAX) {
    entry.violationCount++;

    // Ativar cooldown estendido após COOLDOWN_VIOLATIONS violações consecutivas
    if (entry.violationCount >= COOLDOWN_VIOLATIONS) {
      entry.cooldownUntil = now + COOLDOWN_DURATION_MS;
      logger.warn('Cooldown estendido ativado', {
        phone,
        violations: entry.violationCount,
        cooldownMinutes: COOLDOWN_DURATION_MS / 60_000
      });
      rateLimitMap.set(phone, entry);
      return { allowed: false, retryAfterMs: COOLDOWN_DURATION_MS, inCooldown: true };
    }

    const retryAfterMs = entry.resetAt - now;
    logger.warn('Rate limit atingido', { phone, count: entry.count, retryAfterMs, violations: entry.violationCount });
    rateLimitMap.set(phone, entry);
    return { allowed: false, retryAfterMs, inCooldown: false };
  }

  entry.count++;
  rateLimitMap.set(phone, entry);
  return { allowed: true, retryAfterMs: 0, inCooldown: false };
}

/**
 * Mensagem amigável de rate limit (multilíngue).
 * @param {number} retryAfterMs
 * @param {string} [language='es'] — idioma da sessão ('es'|'pt'|'en')
 * @param {boolean} [inCooldown=false] — se está em cooldown estendido
 */
export function getRateLimitMessage(retryAfterMs, language = 'es', inCooldown = false) {
  const seconds = Math.ceil(retryAfterMs / 1000);
  const minutes = Math.ceil(retryAfterMs / 60_000);

  const messages = {
    es: {
      normal: `⏳ Muchos mensajes seguidos. Por favor espera ${seconds} segundos antes de continuar. ¡Gracias por tu paciencia! 😊`,
      cooldown: `⏳ Has enviado demasiados mensajes. Por favor espera ${minutes} minutos antes de continuar. ¡Gracias! 😊`
    },
    pt: {
      normal: `⏳ Muitas mensagens seguidas. Por favor aguarde ${seconds} segundos antes de continuar. Obrigado pela paciência! 😊`,
      cooldown: `⏳ Você enviou muitas mensagens. Por favor aguarde ${minutes} minutos antes de continuar. Obrigado! 😊`
    },
    en: {
      normal: `⏳ Too many messages. Please wait ${seconds} seconds before continuing. Thanks for your patience! 😊`,
      cooldown: `⏳ You've sent too many messages. Please wait ${minutes} minutes before continuing. Thank you! 😊`
    }
  };

  const lang = messages[language] ? language : 'es';
  return inCooldown ? messages[lang].cooldown : messages[lang].normal;
}

/**
 * Limpar entradas expiradas (chamado periodicamente para evitar memory leak)
 */
export function cleanupRateLimits() {
  const now = Date.now();
  let cleaned = 0;
  for (const [phone, entry] of rateLimitMap) {
    // Remover apenas se a janela expirou E o cooldown estendido também expirou
    if (now >= entry.resetAt && now >= (entry.cooldownUntil || 0)) {
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
