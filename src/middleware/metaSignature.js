/**
 * Meta Signature Validator
 *
 * Valida a assinatura HMAC-SHA256 (x-hub-signature-256) dos webhooks da Meta
 * utilizando a chave secreta do aplicativo (META_APP_SECRET) e o corpo bruto da requisição.
 *
 * Phase 7: INSTA-02 (validação de segurança)
 */

import crypto from 'crypto';
import logger from '../logger.js';

/**
 * Validar assinatura HMAC-SHA256 do payload recebido da Meta.
 *
 * @param {string} rawBody — corpo bruto da requisição HTTP (em formato string/text)
 * @param {string} signatureHeader — cabeçalho 'x-hub-signature-256' da requisição
 * @returns {boolean}
 */
export function validateMetaSignature(rawBody, signatureHeader) {
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('CRÍTICO: META_APP_SECRET não configurada em produção! Rejeitando requisição do webhook por segurança.');
      return false;
    }
    logger.warn('META_APP_SECRET não configurada no .env. Validação de assinatura pulada em desenvolvimento.');
    return true; // Permitir em desenvolvimento apenas se META_APP_SECRET estiver ausente
  }

  if (!signatureHeader) {
    logger.warn('Assinatura ausente no cabeçalho x-hub-signature-256');
    return false;
  }

  try {
    // O cabeçalho vem no formato: sha256=ASSINATURA_HEX
    const signatureParts = signatureHeader.split('=');
    if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
      logger.warn('Formato de cabeçalho x-hub-signature-256 inválido');
      return false;
    }

    const providedSignature = signatureParts[1];
    
    // Gerar HMAC-SHA256 do corpo bruto
    const computedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    const providedBuf = Buffer.from(providedSignature, 'utf8');
    const computedBuf = Buffer.from(computedSignature, 'utf8');

    if (providedBuf.length !== computedBuf.length) {
      return false;
    }

    // Compara em tempo constante para mitigar ataques de timing
    return crypto.timingSafeEqual(providedBuf, computedBuf);
  } catch (err) {
    logger.error('Erro ao validar assinatura da Meta', { error: err.message });
    return false;
  }
}
