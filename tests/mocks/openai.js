export class MockOpenAI {
  static instance = null;

  constructor(config = {}) {
    this.apiKey = config.apiKey;
    this.completions = {
      create: jest.fn().mockImplementation((options) => this.handleCreate(options))
    };
    this.chat = {
      completions: this.completions
    };
    MockOpenAI.instance = this;
    this.mockResponse = 'Hola, soy Samantha. ¿En qué te puedo ayudar?';
    this.mockToolCalls = null;
  }

  setMockResponse(text) {
    this.mockResponse = text;
    this.mockToolCalls = null;
  }

  setMockToolCalls(toolCalls) {
    this.mockToolCalls = toolCalls;
  }

  handleCreate(options) {
    const message = {
      role: 'assistant',
      content: this.mockToolCalls ? null : this.mockResponse
    };

    if (this.mockToolCalls) {
      message.tool_calls = this.mockToolCalls;
    }

    return {
      choices: [
        {
          message,
          finish_reason: this.mockToolCalls ? 'tool_calls' : 'stop'
        }
      ]
    };
  }
}
