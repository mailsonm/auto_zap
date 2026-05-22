---
wave: 1
depends_on: []
files_modified:
  - src/health.js
requirements_addressed:
  - CORE-06
autonomous: true
---

# Plan 05-B: Health Check Server

## Objective
Criar servidor HTTP nativo em Node.js com endpoint `GET /health` na porta 8080, protegido por token, retornando status do bot, uptime, sessões ativas e estado da conexão WhatsApp.

## Context
- CONTEXT.md decisions D-10, D-11, D-12
- RESEARCH.md §3 (Health Check)

## Tasks

### Task 1 — Criar `src/health.js`: servidor HTTP de monitoramento

<read_first>
- src/claude.js (ver export `sessions` — Map usado para contar sessões ativas, linha 25)
- src/logger.js (padrão de import e uso do logger)
- .env.example (ver se HEALTH_PORT e HEALTH_TOKEN já existem)
</read_first>

<action>
Criar novo arquivo `src/health.js`:

```javascript
/**
 * Health Check Server — ARIA
 *
 * Servidor HTTP nativo (sem Express) exposto na porta 8080.
 * Endpoint: GET /health
 * Retorna: status, uptime, sessões ativas, estado da conexão WhatsApp, timestamp.
 * Protegido por token (Authorization: Bearer <token> ou ?token=<token>)
 *
 * Phase 5: D-10, D-11, D-12
 */

import http from 'http';
import logger from './logger.js';
import { sessions } from './claude.js';

// Estado interno do módulo (atualizado via setWAConnected)
let waConnected = false;
const startTime = Date.now();

/**
 * Atualizar o estado de conexão do WhatsApp.
 * Deve ser chamado pelos eventos 'ready' e 'disconnected' em src/index.js.
 *
 * @param {boolean} connected
 */
export function setWAConnected(connected) {
  waConnected = connected;
  logger.debug(`Health: waConnected = ${connected}`);
}

/**
 * Iniciar o servidor HTTP de health check.
 * Deve ser chamado no startup de src/index.js.
 *
 * @returns {http.Server}
 */
export function startHealthServer() {
  const PORT = parseInt(process.env.HEALTH_PORT) || 8080;
  const TOKEN = process.env.HEALTH_TOKEN || null;

  const server = http.createServer((req, res) => {
    // Apenas GET /health é aceito
    if (req.method !== 'GET' || req.url?.split('?')[0] !== '/health') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    // Verificar token de autenticação (apenas se HEALTH_TOKEN estiver configurado)
    if (TOKEN) {
      const authHeader = req.headers['authorization'];
      const urlToken = new URLSearchParams(req.url.split('?')[1] || '').get('token');
      const providedToken = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : urlToken;

      if (providedToken !== TOKEN) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        logger.warn('Health check: tentativa sem token válido', {
          ip: req.socket.remoteAddress
        });
        return;
      }
    }

    // Retornar dados de saúde
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const payload = {
      status: waConnected ? 'ok' : 'degraded',
      uptime: uptimeSeconds,
      activeSessions: sessions.size,
      waConnected,
      timestamp: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));

    logger.debug('Health check solicitado', { status: payload.status, sessions: payload.activeSessions });
  });

  server.on('error', (err) => {
    logger.error('Erro no servidor de health check', { error: err.message, port: PORT });
  });

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`🩺 Health check server rodando em http://0.0.0.0:${PORT}/health`);
  });

  return server;
}
```
</action>

<acceptance_criteria>
- Arquivo `src/health.js` existe
- Contém `export function setWAConnected(connected)` que atualiza variável `waConnected`
- Contém `export function startHealthServer()` que cria e inicia servidor HTTP
- Servidor escuta na porta `process.env.HEALTH_PORT || 8080`
- Verifica token via `Authorization: Bearer <token>` OU query param `?token=<token>`
- Retorna JSON com campos: `status`, `uptime`, `activeSessions`, `waConnected`, `timestamp`
- `status` é `'ok'` quando `waConnected === true` e `'degraded'` quando `false`
- `activeSessions` usa `sessions.size` importado de `claude.js`
- Responde 401 quando token configurado e não fornecido/incorreto
- Responde 404 para qualquer outra rota
- Usa import ES Module: `import http from 'http'`
</acceptance_criteria>

---

### Task 2 — Integrar `health.js` em `src/index.js`

<read_first>
- src/index.js (arquivo a modificar — ver imports e eventos ready/disconnected)
- src/health.js (verificar exports: startHealthServer, setWAConnected)
</read_first>

<action>
Fazer 3 modificações em `src/index.js`:

**1. Adicionar import no topo (após os imports existentes):**
```javascript
import { startHealthServer, setWAConnected } from './health.js';
import { sendWithDelay } from './middleware/messageQueue.js';
```

**2. Chamar `startHealthServer()` no topo do arquivo, logo após a validação de ambiente (após `if (missing.length > 0)` block, linha ~32):**
```javascript
// ─── Iniciar Health Check Server ──────────────────────────────────────────────

startHealthServer();
```

**3. Atualizar eventos `ready` e `disconnected` para chamar `setWAConnected`:**

No evento `ready` (linha ~74-79), adicionar `setWAConnected(true)`:
```javascript
client.on('ready', async () => {
  logger.info('🚀 ARIA está online e pronta para atender!');
  setWAConnected(true);         // ← ADICIONAR
  await preloadData();
});
```

No evento `disconnected` (linha ~81-92), adicionar `setWAConnected(false)`:
```javascript
client.on('disconnected', async (reason) => {
  logger.warn('⚠️  WhatsApp desconectado', { reason });
  setWAConnected(false);        // ← ADICIONAR
  logger.info('Tentando reconectar em 5 segundos...');
  // ... resto do código existente
});
```

**4. Substituir `await msg.reply(response)` pelo `sendWithDelay`:**

No handler `client.on('message', ...)` (linha ~96-121), substituir:
```javascript
// ANTES:
if (response) {
  await msg.reply(response);
  logger.debug('Resposta enviada', {
    to: msg.from,
    length: response.length
  });
}

// DEPOIS:
if (response) {
  await sendWithDelay(msg, response);
  logger.debug('Resposta enviada com delay humanizado', {
    to: msg.from,
    length: response.length
  });
}
```
</action>

<acceptance_criteria>
- `src/index.js` contém `import { startHealthServer, setWAConnected } from './health.js'`
- `src/index.js` contém `import { sendWithDelay } from './middleware/messageQueue.js'`
- `src/index.js` chama `startHealthServer()` antes de `client.initialize()`
- Evento `ready` chama `setWAConnected(true)`
- Evento `disconnected` chama `setWAConnected(false)`
- Handler de mensagem usa `sendWithDelay(msg, response)` em vez de `msg.reply(response)`
</acceptance_criteria>

---

## Verification

<verification>
### Verificação do Health Server
```bash
# Confirmar arquivo criado
test -f src/health.js && echo "OK"

# Confirmar exports
grep "export function setWAConnected\|export function startHealthServer" src/health.js

# Confirmar uso de sessions
grep "sessions.size" src/health.js

# Confirmar campos do payload
grep "status.*waConnected.*uptime\|activeSessions\|timestamp" src/health.js || grep "activeSessions" src/health.js

# Confirmar autenticação por Bearer e query param
grep "Bearer\|urlToken\|searchParams\|split" src/health.js
```

### Verificação de Integração em index.js
```bash
# Confirmar imports
grep "startHealthServer\|setWAConnected" src/index.js
grep "sendWithDelay" src/index.js

# Confirmar chamada no startup
grep "startHealthServer()" src/index.js

# Confirmar setWAConnected nos eventos
grep "setWAConnected(true)\|setWAConnected(false)" src/index.js
```

### Verificação Sintaxe
```bash
node --input-type=module --eval "import './src/health.js'; console.log('OK')" 2>&1
```

### Teste Manual (após iniciar o bot)
```bash
# Com token:
curl -H "Authorization: Bearer aria-health-dev-token" http://localhost:8080/health

# Sem token (deve retornar 401):
curl http://localhost:8080/health
```
</verification>

<must_haves>
- `src/health.js` criado com GET /health na porta 8080 (D-10)
- Retorna status, uptime, activeSessions, waConnected, timestamp (D-11)
- Protegido por HEALTH_TOKEN via Bearer ou query param (D-12)
- `src/index.js` chama startHealthServer() no startup
- setWAConnected sincronizado com eventos ready/disconnected
- msg.reply substituído por sendWithDelay em index.js
</must_haves>
