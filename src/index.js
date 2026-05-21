/**
 * ARIA — Entry Point
 *
 * Inicializa o cliente WhatsApp (whatsapp-web.js) e conecta todos os módulos.
 * Exibe QR Code no terminal para autenticação e mantém reconexão automática.
 */

import 'dotenv/config';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import logger from './logger.js';
import { handleMessage } from './handlers/router.js';
import { getProducts, getFAQs, getBranches, getServices } from './sheets.js';

// ─── Validação de Ambiente ────────────────────────────────────────────────────

const REQUIRED_ENV = ['ANTHROPIC_API_KEY', 'GOOGLE_SHEETS_SCRIPT_URL'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  logger.error(`Variáveis de ambiente faltando: ${missing.join(', ')}`);
  logger.error('Copie .env.example para .env e preencha os valores.');
  process.exit(1);
}

// ─── Cliente WhatsApp ─────────────────────────────────────────────────────────

const WA_CLIENT_ID = process.env.WA_CLIENT_ID || 'aria-main';

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: WA_CLIENT_ID,
    dataPath: '.wwebjs_auth'
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',                // Obrigatório no Linux/VPS
      '--disable-setuid-sandbox',    // Obrigatório no Linux/VPS
      '--disable-dev-shm-usage',     // Previne crash por memória compartilhada limitada
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

// ─── Eventos do Cliente ───────────────────────────────────────────────────────

client.on('qr', (qr) => {
  logger.info('QR Code gerado — escaneie com o WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  logger.info('✅ WhatsApp autenticado — sessão salva em .wwebjs_auth/');
});

client.on('auth_failure', (msg) => {
  logger.error('❌ Falha na autenticação WhatsApp', { message: msg });
  logger.error('Delete a pasta .wwebjs_auth/ e reinicie para escanear o QR Code novamente.');
  process.exit(1);
});

client.on('ready', async () => {
  logger.info('🚀 ARIA está online e pronta para atender!');

  // Pré-carregar dados do Sheets no startup
  await preloadData();
});

client.on('disconnected', async (reason) => {
  logger.warn('⚠️  WhatsApp desconectado', { reason });
  logger.info('Tentando reconectar em 5 segundos...');

  setTimeout(async () => {
    try {
      await client.initialize();
    } catch (err) {
      logger.error('Falha na reconexão', { error: err.message });
    }
  }, 5000);
});

// ─── Handler de Mensagens ─────────────────────────────────────────────────────

client.on('message', async (msg) => {
  try {
    const response = await handleMessage(msg);

    if (response) {
      await msg.reply(response);
      logger.debug('Resposta enviada', {
        to: msg.from,
        length: response.length
      });
    }
  } catch (err) {
    logger.error('Erro não tratado ao processar mensagem', {
      from: msg.from,
      error: err.message,
      stack: err.stack
    });

    // Tentar enviar mensagem de erro ao cliente
    try {
      await msg.reply('😔 Ocurrió un error. Por favor intenta de nuevo en un momento.');
    } catch (_) {
      // Se não conseguir enviar, apenas logar
    }
  }
});

// ─── Pré-carregamento de Dados ───────────────────────────────────────────────

async function preloadData() {
  logger.info('Carregando dados do Google Sheets...');
  try {
    const [products, faqs, branches, services] = await Promise.allSettled([
      getProducts(),
      getFAQs(),
      getBranches(),
      getServices()
    ]);

    const stats = {
      produtos: products.status === 'fulfilled' ? products.value.length : 'ERRO',
      faqs: faqs.status === 'fulfilled' ? faqs.value.length : 'ERRO',
      filiais: branches.status === 'fulfilled' ? branches.value.length : 'ERRO',
      servicos: services.status === 'fulfilled' ? services.value.length : 'ERRO'
    };

    logger.info('Dados carregados:', stats);

    const hasErrors = Object.values(stats).some(v => v === 'ERRO');
    if (hasErrors) {
      logger.warn('Alguns dados não foram carregados. Verifique GOOGLE_SHEETS_SCRIPT_URL no .env');
    }
  } catch (err) {
    logger.error('Falha ao pré-carregar dados', { error: err.message });
    logger.warn('ARIA iniciará sem dados em cache — primeiro atendimento pode ser mais lento.');
  }
}

// ─── Inicialização ────────────────────────────────────────────────────────────

logger.info('='.repeat(50));
logger.info('  ARIA — Bot de Atendimento WhatsApp');
logger.info('  Powered by Claude API + whatsapp-web.js');
logger.info('='.repeat(50));
logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
logger.info(`Modelo Claude: ${process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022'}`);
logger.info(`Cliente WA ID: ${WA_CLIENT_ID}`);
logger.info('Inicializando...');

client.initialize().catch(err => {
  logger.error('Falha crítica ao inicializar WhatsApp client', { error: err.message });
  process.exit(1);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function shutdown(signal) {
  logger.info(`Sinal ${signal} recebido — encerrando ARIA...`);
  try {
    await client.destroy();
    logger.info('Cliente WhatsApp encerrado.');
  } catch (err) {
    logger.warn('Erro ao encerrar cliente', { error: err.message });
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  logger.error('Exceção não capturada', { error: err.message, stack: err.stack });
  shutdown('uncaughtException');
});
