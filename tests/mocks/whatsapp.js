import { EventEmitter } from 'events';

export class MockClient extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.sentMessages = [];
    this.seenChats = [];
  }

  async initialize() {
    this.emit('ready');
    return true;
  }

  async sendMessage(to, content, options = {}) {
    const msg = { to, content, options, timestamp: Date.now() };
    this.sentMessages.push(msg);
    return { id: { id: Math.random().toString(36).substr(2, 9) }, ...msg };
  }

  async sendSeen(chatId) {
    this.seenChats.push(chatId);
    return true;
  }

  // Métodos auxiliares para testes
  simulateIncomingMessage(from, body, isGroupMsg = false) {
    const msg = {
      from,
      body,
      isGroupMsg,
      fromMe: false,
      reply: async (text) => this.sendMessage(from, text)
    };
    this.emit('message', msg);
    return msg;
  }

  simulateOutgoingMessage(to, body) {
    const msg = {
      to,
      body,
      fromMe: true
    };
    this.emit('message_create', msg);
    return msg;
  }
}
