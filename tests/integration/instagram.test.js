import { jest } from '@jest/globals';
import crypto from 'crypto';

// Configura variáveis de ambiente mockadas ANTES de importar os módulos
process.env.META_VERIFY_TOKEN = 'samantha_insta_verify_2026';
process.env.META_APP_SECRET = '9268290c6b37cd45b214bffbc32f7892';

const { handleGETVerification, handlePOSTWebhook } = await import('../../src/handlers/instagramWebhook.js');

describe('Testes de Webhook do Instagram (Meta Graph API) — Phase 7', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn()
    };
  });

  // ── Testes de Verificação GET ──────────────────────────────────────────────

  test('Deve aceitar a verificação GET se o token estiver correto', () => {
    const mockReq = {
      method: 'GET',
      url: '/webhook/instagram?hub.mode=subscribe&hub.verify_token=samantha_insta_verify_2026&hub.challenge=challenge123'
    };

    handleGETVerification(mockReq, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/plain' });
    expect(mockRes.end).toHaveBeenCalledWith('challenge123');
  });

  test('Deve rejeitar a verificação GET (403 Forbidden) se o token estiver incorreto', () => {
    const mockReq = {
      method: 'GET',
      url: '/webhook/instagram?hub.mode=subscribe&hub.verify_token=token_incorreto&hub.challenge=challenge123'
    };

    handleGETVerification(mockReq, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Forbidden' }));
  });

  // ── Testes de Recebimento POST ─────────────────────────────────────────────

  test('Deve processar mensagens (200 OK) se a assinatura estiver correta', () => {
    const payload = {
      object: 'instagram',
      entry: [
        {
          id: 'page_123',
          time: Date.now(),
          messaging: [
            {
              sender: { id: 'user_456' },
              recipient: { id: 'page_123' },
              timestamp: Date.now(),
              message: {
                mid: 'msg_789',
                text: 'Olá Samantha!'
              }
            }
          ]
        }
      ]
    };

    const rawBody = JSON.stringify(payload);
    
    // Gerar assinatura HMAC válida com base no segredo mockado
    const hash = crypto
      .createHmac('sha256', process.env.META_APP_SECRET)
      .update(rawBody)
      .digest('hex');

    const mockReq = {
      method: 'POST',
      headers: {
        'x-hub-signature-256': `sha256=${hash}`
      }
    };

    handlePOSTWebhook(mockReq, mockRes, rawBody);

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/plain' });
    expect(mockRes.end).toHaveBeenCalledWith('EVENT_RECEIVED');
  });

  test('Deve rejeitar mensagens (401 Unauthorized) se a assinatura for inválida', () => {
    const payload = {
      object: 'instagram',
      entry: []
    };

    const rawBody = JSON.stringify(payload);

    const mockReq = {
      method: 'POST',
      headers: {
        'x-hub-signature-256': 'sha256=assinatura_falsa_e_invalida'
      }
    };

    handlePOSTWebhook(mockReq, mockRes, rawBody);

    expect(mockRes.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Unauthorized' }));
  });

  test('Deve rejeitar mensagens (400 Bad Request) se o payload for inválido', () => {
    const rawBody = 'payload_malformado_que_nao_e_json';
    
    const hash = crypto
      .createHmac('sha256', process.env.META_APP_SECRET)
      .update(rawBody)
      .digest('hex');

    const mockReq = {
      method: 'POST',
      headers: {
        'x-hub-signature-256': `sha256=${hash}`
      }
    };

    handlePOSTWebhook(mockReq, mockRes, rawBody);

    expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Bad Request' }));
  });
});
