import { jest } from '@jest/globals';

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
                    content: 'Olá! Sou a Samantha.'
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
const mockIsHumanTakeover = jest.fn();
jest.unstable_mockModule('../../src/session.js', () => {
  return {
    setHumanTakeover: jest.fn(),
    isHumanTakeover: mockIsHumanTakeover,
    getSession: jest.fn().mockReturnValue({
      language: 'pt',
      lastLocalChange: 0
    }),
    incrementTurn: jest.fn(),
    addTopic: jest.fn(),
    closeSession: jest.fn().mockReturnValue({
      phone: 'manychat:user_123',
      summary: 'Conversa no ManyChat'
    })
  };
});

jest.unstable_mockModule('../../src/sheets.js', () => {
  return {
    updateBotStatusInSheets: jest.fn(),
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

// Importar o handler de teste
const { handleManyChatWebhook } = await import('../../src/handlers/manychatWebhook.js');

describe('Testes de Webhook do ManyChat', () => {
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn()
    };
    process.env.MANYCHAT_WEBHOOK_TOKEN = '';
  });

  test('Deve processar mensagem do ManyChat com sucesso e retornar resposta formatada', async () => {
    mockIsHumanTakeover.mockReturnValue(false);

    const payload = {
      userId: 'user_123',
      message: 'Olá, gostaria de saber o preço'
    };

    const rawBody = JSON.stringify(payload);
    const mockReq = {
      method: 'POST',
      url: '/webhook/manychat',
      headers: {}
    };

    await handleManyChatWebhook(mockReq, mockRes, rawBody);

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json; charset=utf-8' });
    
    // Obter argumento enviado ao mockRes.end
    const responseBody = JSON.parse(mockRes.end.mock.calls[0][0]);
    expect(responseBody).toEqual({
      version: 'v2',
      content: {
        actions: [
          {
            action: 'set_field_value',
            field_name: 'human_takeover',
            value: 'false'
          }
        ],
        messages: [
          {
            type: 'text',
            text: 'Olá! Sou a Samantha.'
          }
        ]
      }
    });
  });

  test('Deve validar token de autorização se MANYCHAT_WEBHOOK_TOKEN estiver configurado', async () => {
    process.env.MANYCHAT_WEBHOOK_TOKEN = 'secret_token_123';

    const payload = {
      userId: 'user_123',
      message: 'Olá'
    };

    const rawBody = JSON.stringify(payload);
    const mockReq = {
      method: 'POST',
      url: '/webhook/manychat?token=token_incorreto',
      headers: {}
    };

    await handleManyChatWebhook(mockReq, mockRes, rawBody);

    expect(mockRes.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Unauthorized' }));
  });

  test('Deve aceitar a requisição com token correto', async () => {
    process.env.MANYCHAT_WEBHOOK_TOKEN = 'secret_token_123';
    mockIsHumanTakeover.mockReturnValue(false);

    const payload = {
      userId: 'user_123',
      message: 'Olá'
    };

    const rawBody = JSON.stringify(payload);
    const mockReq = {
      method: 'POST',
      url: '/webhook/manychat?token=secret_token_123',
      headers: {}
    };

    await handleManyChatWebhook(mockReq, mockRes, rawBody);

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json; charset=utf-8' });
  });

  test('Deve sinalizar human_takeover = true na ação quando takeover estiver ativo', async () => {
    mockIsHumanTakeover.mockReturnValue(true);

    const payload = {
      userId: 'user_123',
      message: 'Olá'
    };

    const rawBody = JSON.stringify(payload);
    const mockReq = {
      method: 'POST',
      url: '/webhook/manychat',
      headers: {}
    };

    await handleManyChatWebhook(mockReq, mockRes, rawBody);

    const responseBody = JSON.parse(mockRes.end.mock.calls[0][0]);
    expect(responseBody.content.actions).toEqual([
      {
        action: 'set_field_value',
        field_name: 'human_takeover',
        value: 'true'
      }
    ]);
  });
});
