/**
 * Samantha — Entry Point
 *
 * Inicializa o cliente WhatsApp (whatsapp-web.js) e conecta todos os módulos.
 * Exibe QR Code no terminal para autenticação e mantém reconexão automática.
 */

import 'dotenv/config';
import whatsappWeb from 'whatsapp-web.js';
const { Client, LocalAuth } = whatsappWeb;
import qrcode from 'qrcode-terminal';
import logger from './logger.js';
import { handleMessage } from './handlers/router.js';
import { getProducts, getFAQs, getBranches, getServices, onCacheRefresh, updateBotStatusInSheets } from './sheets.js';
import { buildProductIndex, buildFAQIndex, buildBranchIndex, buildServiceIndex } from './tools/search.js';
import { SAMANTHA_TOOLS, executeTool } from './tools/index.js';
import { startHealthServer, setWAConnected } from './health.js';
import { sendWithDelay } from './middleware/messageQueue.js';
import { setHumanTakeover } from './session.js';

// Registrar atualizadores automáticos de índice de busca fuzzy
onCacheRefresh('productos', (data) => buildProductIndex(data));
onCacheRefresh('faqs', (data) => buildFAQIndex(data));
onCacheRefresh('sucursales', (data) => buildBranchIndex(data));
onCacheRefresh('serviços', (data) => buildServiceIndex(data));

// ─── Validação de Ambiente ────────────────────────────────────────────────────

const REQUIRED_ENV = ['ANTHROPIC_API_KEY', 'GOOGLE_SHEETS_SCRIPT_URL'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  logger.error(`Variáveis de ambiente faltando: ${missing.join(', ')}`);
  logger.error('Copie .env.example para .env e preencha os valores.');
  process.exit(1);
}

// ─── Health Check Server ───────────────────────────────────────────

startHealthServer();

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

// ─── Estado de Reconexão ──────────────────────────────────────────────────────

const RECONNECT_DELAYS = [5000, 15000, 30000]; // 5s, 15s, 30s (backoff exponencial)
let reconnectAttempts = 0;

/**
 * Enviar mensagem de alerta para o número admin configurado em ADMIN_PHONE.
 * Falha silenciosamente se ADMIN_PHONE não estiver configurado.
 */
async function notifyAdmin(message) {
  const adminPhone = process.env.ADMIN_PHONE;
  if (!adminPhone) return;
  try {
    await client.sendMessage(`${adminPhone}@c.us`, message);
    logger.info('Notificação enviada ao admin', { adminPhone });
  } catch (err) {
    logger.warn('Falha ao notificar admin via WhatsApp', { error: err.message });
  }
}

/**
 * Reconectar com backoff exponencial (máximo 3 tentativas).
 * Após esgotar tentativas, encerra o processo (PM2 reinicia automaticamente).
 */
async function reconnectWithBackoff(reason = 'desconexão') {
  if (reconnectAttempts >= RECONNECT_DELAYS.length) {
    logger.error('Máximo de tentativas de reconexão atingido — encerrando para PM2 reiniciar.');
    await notifyAdmin(`❌ ARIA bot não conseguiu reconectar após 3 tentativas (${reason}). PM2 reiniciando...`);
    process.exit(1);
  }

  const delayMs = RECONNECT_DELAYS[reconnectAttempts];
  reconnectAttempts++;

  logger.warn(`Tentativa de reconexão ${reconnectAttempts}/3 em ${delayMs / 1000}s...`, { reason });

  await new Promise(resolve => setTimeout(resolve, delayMs));

  try {
    await client.initialize();
    reconnectAttempts = 0; // Reset após sucesso
    logger.info('Reconexão bem-sucedida!');
    await notifyAdmin('✅ ARIA bot reconectado com sucesso!');
  } catch (err) {
    logger.error(`Falha na reconexão (tentativa ${reconnectAttempts})`, { error: err.message });
    await reconnectWithBackoff(reason);
  }
}

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
  setWAConnected(true);
  reconnectAttempts = 0;
  await preloadData();
});

client.on('disconnected', async (reason) => {
  logger.warn('⚠️  WhatsApp desconectado', { reason });
  setWAConnected(false);
  await notifyAdmin(`⚠️ ARIA bot desconectado. Motivo: ${reason}. Tentando reconectar...`);
  await reconnectWithBackoff(reason);
});

// Monitorar estados críticos do WhatsApp (Phase 5: D-06)
client.on('change_state', async (state) => {
  logger.info('Estado WhatsApp alterado', { state });

  switch (state) {
    case 'UNPAIRED':
      // Sessão expirada ou banida — tentar reconectar
      logger.warn('Estado UNPAIRED: sessão expirada ou banida');
      setWAConnected(false);
      await notifyAdmin('⚠️ ARIA: sessão WhatsApp UNPAIRED (expirada/banida). Tentando reconectar...');
      await reconnectWithBackoff('UNPAIRED');
      break;

    case 'CONFLICT':
      // WhatsApp Web aberto em outro dispositivo — forçar reconexão
      logger.warn('Estado CONFLICT: WhatsApp aberto em outro dispositivo');
      setWAConnected(false);
      await notifyAdmin('⚠️ ARIA: conflito WhatsApp (aberto em outro dispositivo). Reconectando...');
      // Pequena pausa para o outro dispositivo ter chance de fechar
      await new Promise(resolve => setTimeout(resolve, 3000));
      await reconnectWithBackoff('CONFLICT');
      break;

    case 'TIMEOUT':
      // Puppeteer/Chrome travado — encerrar (PM2 reinicia o processo)
      logger.error('Estado TIMEOUT: Puppeteer/Chrome travado — encerrando para PM2 reiniciar');
      setWAConnected(false);
      await notifyAdmin('❌ ARIA: timeout do Puppeteer/Chrome. PM2 reiniciando o processo...');
      process.exit(1);
      break;

    case 'CONNECTED':
      // Reconectado com sucesso
      logger.info('Estado CONNECTED: WhatsApp reconectado com sucesso');
      setWAConnected(true);
      reconnectAttempts = 0;
      break;

    default:
      logger.debug(`Estado WhatsApp: ${state}`);
  }
});


// ─── Handler de Mensagens ─────────────────────────────────────────────────────

client.on('message', async (msg) => {
  try {
    const response = await handleMessage(msg, { tools: SAMANTHA_TOOLS, executeTool });

    if (response) {
      await sendWithDelay(msg, response);
      logger.debug('Resposta enviada com delay humanizado', {
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

// Intercepta mensagens criadas pelo próprio atendente humano
client.on('message_create', async (msg) => {
  try {
    if (msg.fromMe) {
      const phone = msg.to;
      if (phone && !phone.includes('@g.us')) {
        logger.info('Detecção de intervenção humana (mensagem manual enviada)', { to: phone });
        setHumanTakeover(phone, true);
        updateBotStatusInSheets(phone, 'Pausado (Humano)');
      }
    }
  } catch (err) {
    logger.error('Erro no interceptador message_create', { error: err.message });
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
    logger.warn('Samantha iniciará sem dados em cache — primeiro atendimento pode ser mais lento.');
  }
}

// ─── Inicialização ────────────────────────────────────────────────────────────

logger.info('='.repeat(50));
logger.info('  Samantha — Bot de Atendimento WhatsApp');
logger.info('  Powered by OpenAI API + whatsapp-web.js');
logger.info('='.repeat(50));
logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
logger.info(`Modelo OpenAI: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
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
