---
wave: 2
depends_on:
  - 05-A-PLAN
  - 05-B-PLAN
files_modified:
  - src/index.js
  - deploy.sh
  - docs/DEPLOY.md
requirements_addressed:
  - CORE-06
autonomous: true
---

# Plan 05-C: Reconexão Resiliente, Notificação Admin & Deploy

## Objective
Implementar tratamento resiliente de estados do WhatsApp (UNPAIRED, CONFLICT, TIMEOUT) com backoff exponencial e notificação automática para o admin via WhatsApp. Criar script `deploy.sh` e atualizar `docs/DEPLOY.md` com instruções completas.

## Context
- CONTEXT.md decisions D-06 a D-09, D-13 a D-15
- RESEARCH.md §2 (Tratamento de Erros) e §4 (Deploy)

## Tasks

### Task 1 — Atualizar `src/index.js`: reconexão com backoff + notificação admin + change_state

<read_first>
- src/index.js (arquivo a modificar — ver evento `disconnected` existente linhas 81-92 e toda a estrutura)
- src/health.js (ver setWAConnected para chamar no change_state também)
</read_first>

<action>
Fazer as seguintes modificações em `src/index.js`:

**1. Adicionar variáveis de controle de reconexão após a declaração do `client` (após linha ~55, antes dos eventos):**
```javascript
// ─── Estado de Reconexão ──────────────────────────────────────────────────────

const RECONNECT_DELAYS = [5000, 15000, 30000]; // 5s, 15s, 30s
let reconnectAttempts = 0;

/**
 * Enviar mensagem de notificação para o número admin (ADMIN_PHONE no .env).
 * Falha silenciosamente se ADMIN_PHONE não estiver configurado ou conexão indisponível.
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
 * Se esgotar tentativas, encerrar processo (PM2 reinicia).
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
```

**2. Substituir o evento `disconnected` existente (linhas ~81-92) pela nova implementação:**
```javascript
client.on('disconnected', async (reason) => {
  logger.warn('⚠️  WhatsApp desconectado', { reason });
  setWAConnected(false);
  await notifyAdmin(`⚠️ ARIA bot desconectado. Motivo: ${reason}. Tentando reconectar...`);
  await reconnectWithBackoff(reason);
});
```

**3. Adicionar monitoramento de estados via `change_state` (adicionar APÓS o evento `disconnected`):**
```javascript
client.on('change_state', async (state) => {
  logger.info('Estado WhatsApp alterado', { state });

  switch (state) {
    case 'UNPAIRED':
      // Sessão expirada ou banida — reconectar
      logger.warn('Estado UNPAIRED: sessão expirada ou banida');
      setWAConnected(false);
      await notifyAdmin('⚠️ ARIA: sessão WhatsApp UNPAIRED (expirada/banida). Tentando reconectar...');
      await reconnectWithBackoff('UNPAIRED');
      break;

    case 'CONFLICT':
      // WhatsApp aberto em outro dispositivo — forçar reconexão
      logger.warn('Estado CONFLICT: WhatsApp aberto em outro dispositivo');
      setWAConnected(false);
      await notifyAdmin('⚠️ ARIA: conflito WhatsApp (aberto em outro dispositivo). Reconectando...');
      // Pequena pausa para o outro dispositivo fechar
      await new Promise(resolve => setTimeout(resolve, 3000));
      await reconnectWithBackoff('CONFLICT');
      break;

    case 'TIMEOUT':
      // Puppeteer/Chrome travado — encerrar (PM2 reinicia)
      logger.error('Estado TIMEOUT: Puppeteer travado — encerrando para PM2 reiniciar');
      setWAConnected(false);
      await notifyAdmin('❌ ARIA: timeout do Puppeteer/Chrome. PM2 reiniciando o processo...');
      process.exit(1);
      break;

    case 'CONNECTED':
      // Reconectado com sucesso
      logger.info('Estado CONNECTED: WhatsApp reconectado');
      setWAConnected(true);
      reconnectAttempts = 0;
      break;

    default:
      logger.debug(`Estado WhatsApp: ${state}`);
  }
});
```

**4. Atualizar evento `ready` para resetar o contador de reconexão:**
```javascript
client.on('ready', async () => {
  logger.info('🚀 ARIA está online e pronta para atender!');
  setWAConnected(true);
  reconnectAttempts = 0;  // ← ADICIONAR (reset do contador)
  await preloadData();
});
```
</action>

<acceptance_criteria>
- `src/index.js` contém `const RECONNECT_DELAYS = [5000, 15000, 30000]`
- `src/index.js` contém `async function notifyAdmin(message)` que usa `process.env.ADMIN_PHONE`
- `src/index.js` contém `async function reconnectWithBackoff(reason)`
- `reconnectWithBackoff` chama `process.exit(1)` quando `reconnectAttempts >= RECONNECT_DELAYS.length`
- `src/index.js` contém evento `client.on('change_state', ...)` com cases para UNPAIRED, CONFLICT, TIMEOUT, CONNECTED
- Evento `disconnected` chama `setWAConnected(false)` e `reconnectWithBackoff`
- Evento `change_state` case TIMEOUT chama `process.exit(1)`
- Evento `ready` inclui `reconnectAttempts = 0`
- `notifyAdmin` usa `client.sendMessage(\`${adminPhone}@c.us\`, message)` dentro de try/catch
</acceptance_criteria>

---

### Task 2 — Criar `deploy.sh`: script de deploy automatizado

<read_first>
- ecosystem.config.js (ver nome do app PM2: 'aria-bot')
- docs/DEPLOY.md (ver fluxo atual de deploy para manter consistência)
- .gitignore (verificar se .wwebjs_auth.bkp/ deve ser ignorado)
</read_first>

<action>
Criar arquivo `deploy.sh` na raiz do projeto:

```bash
#!/bin/bash
# deploy.sh — Script de Deploy do Bot ARIA
# Uso: ./deploy.sh
# Requisitos: PM2 instalado, git configurado, npm disponível

set -e  # Parar execução em caso de qualquer erro

echo ""
echo "=========================================="
echo "  🚀 Deploy ARIA Bot — $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# ── 1. Parar o bot ──────────────────────────────────────────────────────────
echo "⏹  Parando o bot..."
pm2 stop aria-bot 2>/dev/null || echo "  (bot não estava rodando — continuando)"
echo ""

# ── 2. Backup da sessão WhatsApp ─────────────────────────────────────────────
echo "💾 Fazendo backup da sessão WhatsApp..."
if [ -d ".wwebjs_auth" ]; then
  cp -r .wwebjs_auth/ .wwebjs_auth.bkp/
  echo "  Backup salvo em .wwebjs_auth.bkp/"
else
  echo "  (pasta .wwebjs_auth não encontrada — pulando backup)"
fi
echo ""

# ── 3. Atualizar código ──────────────────────────────────────────────────────
echo "📥 Atualizando código do repositório..."
git pull origin main
echo ""

# ── 4. Instalar dependências ─────────────────────────────────────────────────
echo "📦 Instalando dependências..."
npm install --production
echo ""

# ── 5. Reiniciar o bot ───────────────────────────────────────────────────────
echo "▶  Iniciando o bot..."
pm2 start ecosystem.config.js --update-env
echo ""

# ── 6. Status final ─────────────────────────────────────────────────────────
echo "✅ Deploy concluído!"
echo ""
pm2 status aria-bot
echo ""
echo "📋 Para ver os logs em tempo real:"
echo "   pm2 logs aria-bot --lines 50"
echo ""
```

Tornar o script executável (documentar no DEPLOY.md que deve rodar `chmod +x deploy.sh` uma vez):
- Apenas documentar isso em DEPLOY.md pois `chmod` não funciona no Windows

**Adicionar `.wwebjs_auth.bkp/` ao `.gitignore`:**
```
# Backup da sessão WhatsApp (criado pelo deploy.sh)
.wwebjs_auth.bkp/
```
</action>

<acceptance_criteria>
- Arquivo `deploy.sh` existe na raiz do projeto
- Contém `pm2 stop aria-bot`
- Contém `cp -r .wwebjs_auth/ .wwebjs_auth.bkp/` dentro de `if [ -d ".wwebjs_auth" ]`
- Contém `git pull origin main`
- Contém `npm install --production`
- Contém `pm2 start ecosystem.config.js --update-env`
- Contém `set -e` na primeira linha de código (após shebang)
- `.gitignore` contém `.wwebjs_auth.bkp/`
</acceptance_criteria>

---

### Task 3 — Atualizar `docs/DEPLOY.md` com seção Fase 5

<read_first>
- docs/DEPLOY.md (arquivo a modificar — ver estrutura atual e o que já existe)
</read_first>

<action>
Adicionar as seguintes seções ao final de `docs/DEPLOY.md` (após a seção "Troubleshooting"):

```markdown
---

## Deploy Automatizado (Phase 5)

### 10. Usar o script `deploy.sh`

Após a primeira configuração manual, use o script para deploys futuros:

```bash
# Na primeira vez, tornar executável:
chmod +x deploy.sh

# Para deploy (a partir da raiz do projeto):
./deploy.sh
```

O script executa automaticamente:
1. Para o bot (pm2 stop)
2. Backup da sessão WhatsApp em `.wwebjs_auth.bkp/`
3. Atualiza o código (`git pull origin main`)
4. Instala dependências (`npm install --production`)
5. Reinicia o bot com as novas configurações

---

## Monitoramento de Saúde (Phase 5)

O bot expõe um endpoint de saúde em `http://<IP_VPS>:8080/health`.

### Configurar variáveis de ambiente necessárias em `.env`:

```bash
HEALTH_PORT=8080
HEALTH_TOKEN=seu-token-secreto-aqui  # Gere um UUID aleatório
ADMIN_PHONE=5959812345678             # Número admin sem @c.us
```

### Testar o endpoint:

```bash
# Com token no header:
curl -H "Authorization: Bearer seu-token-secreto-aqui" http://localhost:8080/health

# Com token na URL:
curl "http://localhost:8080/health?token=seu-token-secreto-aqui"
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "uptime": 3600,
  "activeSessions": 2,
  "waConnected": true,
  "timestamp": "2025-05-22T20:00:00.000Z"
}
```

- `status: "ok"` — bot conectado e funcionando
- `status: "degraded"` — WhatsApp desconectado (bot ainda rodando, tentando reconectar)

---

## Rotação de Logs (Phase 5)

### Configurar logrotate no servidor VPS (Ubuntu):

```bash
# Criar arquivo de configuração (substitua 'usuario' pelo usuário real)
sudo nano /etc/logrotate.d/aria-bot
```

Cole o conteúdo:
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

**Testar a configuração:**
```bash
sudo logrotate -d /etc/logrotate.d/aria-bot  # Dry run (sem alterar arquivos)
sudo logrotate -f /etc/logrotate.d/aria-bot  # Forçar rotação agora
```

---

## Notificações Admin via WhatsApp (Phase 5)

Com `ADMIN_PHONE` configurado no `.env`, o bot enviará mensagens automáticas quando:
- ⚠️ WhatsApp desconecta (motivo incluído)
- ⚠️ Estado UNPAIRED ou CONFLICT detectado
- ❌ Esgotadas as tentativas de reconexão (PM2 vai reiniciar)
- ✅ Reconexão bem-sucedida

Configure `ADMIN_PHONE` com o número sem o prefixo `@c.us`:
```bash
ADMIN_PHONE=5959812345678  # Paraguai (595) + número
```
```
</action>

<acceptance_criteria>
- `docs/DEPLOY.md` contém seção "Deploy Automatizado (Phase 5)" com instruções do `deploy.sh`
- `docs/DEPLOY.md` contém seção "Monitoramento de Saúde (Phase 5)" com exemplo de `curl` para o `/health`
- `docs/DEPLOY.md` contém seção "Rotação de Logs (Phase 5)" com conteúdo do arquivo logrotate
- `docs/DEPLOY.md` contém seção "Notificações Admin via WhatsApp (Phase 5)"
- Arquivo logrotate no DEPLOY.md usa `weekly`, `rotate 4`, `compress`, `pm2 flush aria-bot`
- DEPLOY.md menciona `HEALTH_TOKEN`, `HEALTH_PORT` e `ADMIN_PHONE` como variáveis a configurar
</acceptance_criteria>

---

## Verification

<verification>
### Verificação das mudanças em index.js
```bash
# Confirmar backoff exponencial
grep "RECONNECT_DELAYS\|reconnectAttempts\|reconnectWithBackoff" src/index.js

# Confirmar notifyAdmin
grep "notifyAdmin\|ADMIN_PHONE\|@c.us" src/index.js

# Confirmar change_state com todos os estados
grep "change_state\|UNPAIRED\|CONFLICT\|TIMEOUT" src/index.js

# Confirmar setWAConnected nos pontos corretos
grep "setWAConnected" src/index.js
```

### Verificação do deploy.sh
```bash
# Confirmar arquivo existe
test -f deploy.sh && echo "OK"

# Confirmar comandos chave
grep "pm2 stop aria-bot" deploy.sh
grep "cp -r .wwebjs_auth" deploy.sh
grep "git pull origin main" deploy.sh
grep "npm install --production" deploy.sh
grep "pm2 start ecosystem.config.js" deploy.sh

# Confirmar set -e
grep "^set -e" deploy.sh
```

### Verificação do DEPLOY.md
```bash
# Confirmar novas seções
grep "deploy.sh\|logrotate\|HEALTH_TOKEN\|ADMIN_PHONE" docs/DEPLOY.md
grep "Phase 5\|Monitoramento\|Rotação" docs/DEPLOY.md
```

### Verificação .gitignore
```bash
grep ".wwebjs_auth.bkp" .gitignore
```

### Verificação Sintaxe index.js
```bash
node --check src/index.js 2>&1 || echo "SYNTAX ERROR"
```
</verification>

<must_haves>
- reconnectWithBackoff com delays [5s, 15s, 30s] e process.exit(1) após 3 falhas (D-07)
- notifyAdmin usando ADMIN_PHONE para WhatsApp do admin (D-08)
- change_state monitorando UNPAIRED, CONFLICT, TIMEOUT (D-06)
- deploy.sh criado com backup .wwebjs_auth e comandos corretos (D-13)
- docs/DEPLOY.md atualizado com logrotate (semanal, 4 semanas), deploy.sh e novas env vars (D-14, D-15)
- .gitignore atualizado com .wwebjs_auth.bkp/
</must_haves>
