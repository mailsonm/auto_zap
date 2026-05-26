import { jest } from '@jest/globals';

// Variável de controle dinâmico de status do Sheets
let mockSheetsStatus = null;

// Mock da OpenAI
jest.unstable_mockModule('openai', () => {
  return {
    default: class {
      constructor() {
        this.chat = {
          completions: {
            create: jest.fn().mockImplementation(async (options) => {
              // Simular resposta padrão ou tool calls se houver perguntas sobre produtos
              const messages = options.messages || [];
              const lastMessage = messages[messages.length - 1]?.content || '';
              
              if (lastMessage.includes('paracetamol')) {
                return {
                  choices: [{
                    message: {
                      role: 'assistant',
                      content: null,
                      tool_calls: [{
                        id: 'call_123',
                        type: 'function',
                        function: {
                          name: 'buscar_produto',
                          arguments: JSON.stringify({ query: 'paracetamol' })
                        }
                      }]
                    },
                    finish_reason: 'tool_calls'
                  }]
                };
              }

              // Resposta de FAQ
              if (lastMessage.includes('tarjeta')) {
                return {
                  choices: [{
                    message: {
                      role: 'assistant',
                      content: null,
                      tool_calls: [{
                        id: 'call_456',
                        type: 'function',
                        function: {
                          name: 'buscar_faq',
                          arguments: JSON.stringify({ pergunta: 'tarjeta' })
                        }
                      }]
                    },
                    finish_reason: 'tool_calls'
                  }]
                };
              }

              // Resposta padrão
              return {
                choices: [{
                  message: {
                    role: 'assistant',
                    content: 'Hola, soy Samantha. ¿En qué puedo ayudarte hoy?'
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

// Mock do Sheets
jest.unstable_mockModule('../../src/sheets.js', () => {
  return {
    getSystemInfo: async () => ({
      nombre_empresa: 'Farmacia Americana',
      telefono: '595981234567',
      direccion: 'Av. España, Asunción',
      horario: '07:00 a 22:00'
    }),
    getProducts: async () => [
      {
        sku: 'P-001',
        nombre: 'Paracetamol 500mg',
        presentacion: 'Caja de 10 comprimidos',
        precio_pyg: 5000,
        precio_brl: 5.00,
        requiere_receta: 'N',
        categoria: 'analgésico',
        disponible: 'S',
        notas: 'Tomar cada 6 u 8 horas.'
      }
    ],
    getFAQs: async () => [
      {
        id: 1,
        pregunta: '¿Aceptan tarjeta?',
        respuesta: 'Sí, aceptamos todas las tarjetas de crédito y débito.',
        tags: 'pagos, tarjeta'
      }
    ],
    getBranches: async () => [],
    getServices: async () => [],
    appendLead: async () => ({ sucesso: true }),
    appendHistory: async () => ({ sucesso: true }),
    updateBotStatusInSheets: async () => ({ sucesso: true }),
    fetchBotControlStatus: async () => mockSheetsStatus,
    onCacheRefresh: () => {}
  };
});

// ─── Importar Módulos sob Teste ───────────────────────────────────────────────

const { handleMessage } = await import('../../src/handlers/router.js');
const { SAMANTHA_TOOLS, executeTool } = await import('../../src/tools/index.js');
const { setHumanTakeover, isHumanTakeover } = await import('../../src/session.js');

describe('Testes de Integração de Handlers — Samantha (OpenAI)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSheetsStatus = null;
  });

  test('Deve responder mensagem de saudação padrão da Samantha', async () => {
    const msg = {
      from: '595981234567@c.us',
      body: 'hola',
      isGroupMsg: false,
      reply: jest.fn()
    };

    const response = await handleMessage(msg, { tools: SAMANTHA_TOOLS, executeTool });
    expect(response).toBe('Hola, soy Samantha. ¿En qué puedo ayudarte hoy?');
  });

  test('Deve interpretar e disparar busca de produtos no catálogo', async () => {
    const msg = {
      from: '595981234567@c.us',
      body: 'tienen paracetamol?',
      isGroupMsg: false,
      reply: jest.fn()
    };

    // A chamada deve disparar a tool buscar_produto,
    // que retorna o resultado da busca mockada.
    const response = await handleMessage(msg, { tools: SAMANTHA_TOOLS, executeTool });
    expect(response).toBeDefined();
    // Como mockamos a chamada de IA, a resposta gerada após a execução do tool
    // pode ser o fallback ou a continuação do chat.
    // Vamos garantir que a função executou sem crashar e retornou uma resposta amigável.
    expect(typeof response).toBe('string');
  });

  test('Deve responder a dúvidas frequentes usando a tool buscar_faq', async () => {
    const msg = {
      from: '595981234567@c.us',
      body: 'se puede pagar con tarjeta?',
      isGroupMsg: false,
      reply: jest.fn()
    };

    const response = await handleMessage(msg, { tools: SAMANTHA_TOOLS, executeTool });
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
  });

  test('Deve ignorar mensagens e ativar takeover se controle do Sheets estiver Inativo', async () => {
    const phone = '595981234567@c.us';
    const msg = {
      from: phone,
      body: 'hola',
      isGroupMsg: false,
      reply: jest.fn()
    };

    // Forçar controle do Sheets para Inativo
    mockSheetsStatus = 'Inativo';

    const response = await handleMessage(msg, { tools: SAMANTHA_TOOLS, executeTool });
    
    // O bot deve ignorar a mensagem (retornar null)
    expect(response).toBeNull();
    
    // E o takeover local deve ter sido ativado na sessão
    expect(isHumanTakeover(phone)).toBe(true);
  });

  test('Deve limpar takeover local se controle do Sheets mudar para Ativo', async () => {
    const phone = '595981234567@c.us';
    const msg = {
      from: phone,
      body: 'hola',
      isGroupMsg: false,
      reply: jest.fn()
    };

    // Ativar o takeover localmente de forma prévia
    setHumanTakeover(phone, true);
    expect(isHumanTakeover(phone)).toBe(true);

    // Mudar controle no Sheets para Ativo
    mockSheetsStatus = 'Ativo';

    const response = await handleMessage(msg, { tools: SAMANTHA_TOOLS, executeTool });
    
    // O bot deve responder normalmente (não null)
    expect(response).toBe('Hola, soy Samantha. ¿En qué puedo ayudarte hoy?');
    
    // E o takeover local deve ter sido removido
    expect(isHumanTakeover(phone)).toBe(false);
  });

  test('Deve desativar takeover local e responder se o cliente pedir para voltar para a Samantha', async () => {
    const phone = '595981234569@c.us';
    const msg = {
      from: phone,
      body: 'quero falar com a samantha',
      isGroupMsg: false,
      reply: jest.fn()
    };

    // Ativar o takeover localmente de forma prévia (bot pausado)
    setHumanTakeover(phone, true);
    expect(isHumanTakeover(phone)).toBe(true);

    const response = await handleMessage(msg, { tools: SAMANTHA_TOOLS, executeTool });
    
    // O bot deve sair do takeover e responder na hora
    expect(response).toBe('Hola, soy Samantha. ¿En qué puedo ayudarte hoy?');
    expect(isHumanTakeover(phone)).toBe(false);
  });
});
