import { jest } from '@jest/globals';
import crypto from 'crypto';

// Configura variáveis de ambiente mockadas ANTES de importar os módulos
process.env.META_VERIFY_TOKEN = 'samantha_insta_verify_2026';
process.env.META_APP_SECRET = '9268290c6b37cd45b214bffbc32f7892';
process.env.INSTAGRAM_PAGE_ACCESS_TOKEN = 'EAA_TEST_TOKEN_123';

// Mock da OpenAI para simular respostas da Samantha
jest.unstable_mockModule('openai', () => {
  return {
    default: class {
      constructor() {
        this.chat = {
          completions: {
            create: jest.fn().mockImplementation(async () => {
              return {
                choices: [{
                  message: {
                    role: 'assistant',
                    content: 'Olá! Sou a Samantha. Como posso ajudar?'
                  },
                  finish_reason: 'stop'
                }]
              };
            })
          }
        };
      }
    }
  };
});

// Mock do Session e Sheets para verificar chamadas de takeover
const mockSetHumanTakeover = jest.fn();
jest.unstable_mockModule('../../src/session.js', () => {
  return {
    setHumanTakeover: mockSetHumanTakeover,
    isHumanTakeover: jest.fn(),
    getSession: jest.fn().mockReturnValue({
      language: 'pt',
      lastLocalChange: 0
    }),
    incrementTurn: jest.fn(),
    addTopic: jest.fn(),
    closeSession: jest.fn().mockReturnValue({
      phone: 'insta:user_456',
      summary: 'Conversa no Instagram'
    })
  };
});

const mockUpdateBotStatusInSheets = jest.fn();
jest.unstable_mockModule('../../src/sheets.js', () => {
  return {
    updateBotStatusInSheets: mockUpdateBotStatusInSheets,
    getSystemInfo: async () => ({
      nombre_empresa: 'Farmacia Americana'
    }),
    getProducts: async () => [],
    getFAQs: async () => [],
    getBranches: async () => [],
    getServices: async () => [],
    appendLead: jest.fn(),
    appendHistory: jest.fn(),
    fetchBotControlStatus: async () => 'Ativo',
    onCacheRefresh: jest.fn()
  };
});

// Importações dos controladores e serviços sob teste
const { handleGETVerification, handlePOSTWebhook } = await import('../../src/handlers/instagramWebhook.js');
const { sendInstagramMessage } = await import('../../src/services/instagram.js');

describe('Testes de Webhook do Instagram (Meta Graph API) — Phase 7, 8 & 9', () => {
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
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

  test('Deve processar mensagens do cliente (200 OK) se a assinatura estiver correta', () => {
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

  // ── Testes de Takeover Humano (is_echo) ──────────────────────────────────

  test('Deve ativar o takeover se for um eco do operador (sem caractere invisível)', () => {
    const payload = {
      object: 'instagram',
      entry: [
        {
          id: 'page_123',
          messaging: [
            {
              sender: { id: 'page_123' },
              recipient: { id: 'user_456' },
              message: {
                is_echo: true,
                text: 'Olá, vou te atender manualmente agora.'
              }
            }
          ]
        }
      ]
    };

    const rawBody = JSON.stringify(payload);
    const hash = crypto.createHmac('sha256', process.env.META_APP_SECRET).update(rawBody).digest('hex');
    const mockReq = {
      method: 'POST',
      headers: { 'x-hub-signature-256': `sha256=${hash}` }
    };

    handlePOSTWebhook(mockReq, mockRes, rawBody);

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/plain' });
    expect(mockRes.end).toHaveBeenCalledWith('EVENT_RECEIVED');
    
    // Takeover deve ser ativado para a chave 'insta:user_456'
    expect(mockSetHumanTakeover).toHaveBeenCalledWith('insta:user_456', true);
    expect(mockUpdateBotStatusInSheets).toHaveBeenCalledWith('insta:user_456', 'Pausado (Humano)');
  });

  test('Deve ignorar o eco se contiver o caractere invisível (enviado pelo próprio bot)', () => {
    const payload = {
      object: 'instagram',
      entry: [
        {
          id: 'page_123',
          messaging: [
            {
              sender: { id: 'page_123' },
              recipient: { id: 'user_456' },
              message: {
                is_echo: true,
                text: 'Olá, sou a Samantha!\u200B'
              }
            }
          ]
        }
      ]
    };

    const rawBody = JSON.stringify(payload);
    const hash = crypto.createHmac('sha256', process.env.META_APP_SECRET).update(rawBody).digest('hex');
    const mockReq = {
      method: 'POST',
      headers: { 'x-hub-signature-256': `sha256=${hash}` }
    };

    handlePOSTWebhook(mockReq, mockRes, rawBody);

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/plain' });
    
    // Takeover NÃO deve ser acionado
    expect(mockSetHumanTakeover).not.toHaveBeenCalled();
    expect(mockUpdateBotStatusInSheets).not.toHaveBeenCalled();
  });

  // ── Teste E2E de Mensagem do Cliente e Resposta Automatizada ─────────────────

  test('Deve processar mensagem do cliente, chamar a OpenAI e enviar resposta de volta', async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message_id: 'mid_999' })
      })
    );

    const payload = {
      object: 'instagram',
      entry: [
        {
          id: 'page_123',
          messaging: [
            {
              sender: { id: 'user_456' },
              recipient: { id: 'page_123' },
              message: {
                text: 'olá'
              }
            }
          ]
        }
      ]
    };

    const rawBody = JSON.stringify(payload);
    const hash = crypto.createHmac('sha256', process.env.META_APP_SECRET).update(rawBody).digest('hex');
    const mockReq = {
      method: 'POST',
      headers: { 'x-hub-signature-256': `sha256=${hash}` }
    };

    handlePOSTWebhook(mockReq, mockRes, rawBody);

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/plain' });
    expect(mockRes.end).toHaveBeenCalledWith('EVENT_RECEIVED');

    // Aguardar o processamento assíncrono do IIFE
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verificar se o fetch do sendInstagramMessage enviou a resposta da OpenAI de volta ao cliente
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://graph.facebook.com/v19.0/me/messages'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: 'user_456' },
          message: { text: 'Olá! Sou a Samantha. Como posso ajudar?\u200B' }
        })
      })
    );
  });

  // ── Testes de Serviço de Envio API ─────────────────────────────────────────

  describe('Serviço de Envio — sendInstagramMessage', () => {
    let originalFetch;

    beforeAll(() => {
      originalFetch = global.fetch;
    });

    afterAll(() => {
      global.fetch = originalFetch;
    });

    test('Deve enviar mensagem via POST HTTP com caractere invisível no payload', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message_id: 'mid_123abc' })
        })
      );

      const res = await sendInstagramMessage('user_456', 'Olá cliente!');

      expect(res).toEqual({ message_id: 'mid_123abc' });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://graph.facebook.com/v19.0/me/messages'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: 'user_456' },
            message: { text: 'Olá cliente!\u200B' }
          })
        })
      );
    });

    test('Deve propagar o erro se a chamada HTTP falhar', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: { message: 'OAuth Exception' } })
        })
      );

      await expect(sendInstagramMessage('user_456', 'Olá')).rejects.toThrow('Meta API error');
    });
  });
});
