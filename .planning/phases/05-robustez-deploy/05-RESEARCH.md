# Phase 5: Robustez, Rate Limiting & Deploy VPS — Research

**Phase:** 5 - Robustez, Rate Limiting & Deploy VPS
**Date:** 2026-05-22
**Status:** RESEARCH COMPLETE

---

## 1. Rate Limiting & Fila de Mensagens (Anti-Banimento)

### Estado atual
`src/middleware/rateLimit.js` implementa sliding window básico (10 msg/min, configurável). Não tem cooldown estendido nem mensagens multilíngues — usa espanhol fixo.

### Padrão de Cooldown Estendido
Adicionar dois campos ao mapa de rate limit:
- `violationCount`: contador de janelas consecutivas em que o limite foi atingido
- `cooldownUntil`: timestamp de fim do cooldown estendido (10 min)

Quando `count >= RATE_LIMIT_MAX` e `violationCount >= 3`, entrar em cooldown de 10 min. Reset de `violationCount` ao fim de uma janela limpa (sem violação).

### Mensagens de Rate Limit Multilíngues
`detectLanguage()` em `src/handlers/router.js` está exportada e pode ser importada em `rateLimit.js`. Porém, como `rateLimit.js` não tem contexto do texto da mensagem recebida, deve receber o `language` como parâmetro. Alternativa: buscar idioma da sessão via `session.language` (requer import de `session.js`).

**Decisão:** `getRateLimitMessage(retryAfterMs, language)` — chamar do `router.js` passando `session.language || 'es'` para evitar acoplamento circular.

### Fila de Envio Humanizado (Anti-Banimento)
**Pattern:** Array de promises com delay sequencial. Não usar bibliotecas pesadas (BullMQ requer Redis). Implementação simples:

```javascript
// src/middleware/messageQueue.js
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = () => Math.floor(Math.random() * 2000) + 1000; // 1000-3000ms

export async function sendWithDelay(client, msg, response) {
  const chat = await msg.getChat();
  await chat.sendSeen(); // Marcar como lida
  await delay(randomDelay()); // Delay humanizado 1-3s
  await msg.reply(response);
}
```

**Integração:** Em `src/index.js`, substituir `await msg.reply(response)` por `await sendWithDelay(client, msg, response)`.

**Nota:** `chat.sendSeen()` é o método correto no whatsapp-web.js (não `client.sendSeen()`). A instância `chat` vem de `await msg.getChat()`.

---

## 2. Tratamento de Erros do WhatsApp / OpenWA

### Estados Críticos via `change_state`
O whatsapp-web.js usa o evento `change_state` (não `onStateChanged`) para monitorar mudanças de estado:

```javascript
client.on('change_state', (state) => {
  // state pode ser: CONNECTED, OPENING, PAIRING, UNPAIRED, TIMEOUT, CONFLICT
});
```

Estados a monitorar:
- `UNPAIRED` → sessão expirada/banida → notificar admin + backoff reconexão
- `CONFLICT` → WhatsApp aberto em outro device → forçar reconexão + notificar admin
- `TIMEOUT` → Puppeteer travado → `process.exit(1)` (PM2 reinicia)

### Backoff Exponencial
Implementar em `src/index.js` com estado controlado:
- `reconnectAttempts`: contador global (0-3)
- Delays: [5000, 15000, 30000] ms
- Após 3 falhas: `process.exit(1)` (PM2 reinicia processo limpo)

```javascript
const RECONNECT_DELAYS = [5000, 15000, 30000];
let reconnectAttempts = 0;

async function reconnectWithBackoff() {
  if (reconnectAttempts >= RECONNECT_DELAYS.length) {
    logger.error('Máximo de tentativas de reconexão atingido — encerrando.');
    process.exit(1);
  }
  const delayMs = RECONNECT_DELAYS[reconnectAttempts];
  reconnectAttempts++;
  logger.warn(`Tentativa de reconexão ${reconnectAttempts}/3 em ${delayMs/1000}s...`);
  await new Promise(resolve => setTimeout(resolve, delayMs));
  try {
    await client.initialize();
    reconnectAttempts = 0; // Reset após sucesso
  } catch (err) {
    logger.error('Falha na reconexão', { attempt: reconnectAttempts, error: err.message });
    await reconnectWithBackoff(); // Recursivo
  }
}
```

### Notificação Admin via WhatsApp
Quando o bot desconecta/reconecta, enviar mensagem para `ADMIN_PHONE`:
```javascript
async function notifyAdmin(message) {
  const adminPhone = process.env.ADMIN_PHONE;
  if (!adminPhone) return;
  try {
    await client.sendMessage(`${adminPhone}@c.us`, message);
  } catch (err) {
    logger.warn('Falha ao notificar admin', { error: err.message });
  }
}
```

**Importante:** Chamar `notifyAdmin` antes de iniciar backoff (não após, pois a conexão pode estar indisponível).

### Fallback de Erro de Mensagem
Já existe em `src/index.js` (linha 116): `await msg.reply('😔 Ocurrió un error...')` dentro do try/catch do handler. Em `src/handlers/router.js` (linha 121-123): também tem fallback em espanhol. 

**Melhoria:** Tornar a mensagem de fallback multilíngue usando `session.language` — passar idioma ao construir a mensagem de erro.

---

## 3. Monitoramento & Health Check

### Implementação com `http` nativo do Node.js
Sem Express, sem dependências adicionais:

```javascript
// src/health.js
import http from 'http';
import { sessions } from './claude.js';

let waConnected = false;
let startTime = Date.now();

export function setWAConnected(connected) { waConnected = connected; }

export function startHealthServer() {
  const PORT = parseInt(process.env.HEALTH_PORT) || 8080;
  const TOKEN = process.env.HEALTH_TOKEN;
  
  const server = http.createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      // Verificar token (header Authorization ou query param)
      const authHeader = req.headers['authorization'];
      const urlToken = new URL(req.url, `http://localhost:${PORT}`).searchParams.get('token');
      const providedToken = authHeader?.replace('Bearer ', '') || urlToken;
      
      if (TOKEN && providedToken !== TOKEN) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        activeSessions: sessions.size,
        waConnected,
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  
  server.listen(PORT, () => {
    logger.info(`Health check server rodando na porta ${PORT}`);
  });
  
  return server;
}
```

**Integração em `src/index.js`:**
- Chamar `startHealthServer()` no startup
- Chamar `setWAConnected(true)` no evento `ready`
- Chamar `setWAConnected(false)` nos eventos `disconnected` / estado `UNPAIRED` / `CONFLICT`

---

## 4. Deploy & Infraestrutura

### Script `deploy.sh`
Shell script simples com tratamento de erros:
```bash
#!/bin/bash
set -e  # Parar em caso de erro

echo "🚀 Deploy ARIA Bot..."

# 1. Parar bot
echo "Parando bot..."
pm2 stop aria-bot || true

# 2. Backup da sessão WhatsApp
echo "Backup da sessão WhatsApp..."
cp -r .wwebjs_auth/ .wwebjs_auth.bkp/ 2>/dev/null || true

# 3. Pull código
echo "Atualizando código..."
git pull origin main

# 4. Instalar dependências
echo "Instalando dependências..."
npm install --production

# 5. Reiniciar bot
echo "Iniciando bot..."
pm2 start ecosystem.config.js --update-env

echo "✅ Deploy concluído!"
pm2 status aria-bot
```

### Logrotate
Arquivo `/etc/logrotate.d/aria-bot` (instruções no `DEPLOY.md`):
```
/home/usuario/auto-zap/logs/*.log {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 644 usuario usuario
    postrotate
        pm2 flush aria-bot
    endscript
}
```

**Importante:** `pm2 flush` limpa os logs internos do PM2 após rotação.

### `.env.example` — Novas variáveis
```
RATE_LIMIT_MAX=5
RATE_LIMIT_WINDOW_MS=60000
ADMIN_PHONE=595981234567
HEALTH_PORT=8080
HEALTH_TOKEN=seu-token-secreto-aqui
```

---

## 5. Análise de Risco de Integração

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| `chat.sendSeen()` não disponível no wwebjs atual | Baixa | Wrap em try/catch silencioso |
| `change_state` não disparado no CONFLICT | Média | Também monitorar `disconnected` |
| `client.sendMessage` falha durante notificação admin | Média | Wrap em try/catch, apenas logar |
| Reconexão recursiva causar stack overflow | Baixa | Usar iteração (não recursão) com contador |
| `process.exit(1)` no TIMEOUT encerrar antes de PM2 detectar | Muito baixa | PM2 `restart_delay: 5000` garante reconexão |

---

## 6. Plano de Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `src/middleware/rateLimit.js` | MODIFICAR | D-01, D-02, D-03 |
| `src/middleware/messageQueue.js` | CRIAR | D-04, D-05 |
| `src/health.js` | CRIAR | D-10, D-11, D-12 |
| `src/index.js` | MODIFICAR | D-06, D-07, D-08 + integrar queue e health |
| `src/handlers/router.js` | MODIFICAR | D-09 (fallback multilíngue) + integrar queue |
| `.env.example` | MODIFICAR | Novas variáveis |
| `ecosystem.config.js` | VERIFICAR | Sem alterações esperadas |
| `deploy.sh` | CRIAR | D-13 |
| `docs/DEPLOY.md` | MODIFICAR | D-14, D-15 |

---

## RESEARCH COMPLETE
