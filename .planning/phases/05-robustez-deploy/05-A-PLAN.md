---
wave: 1
depends_on: []
files_modified:
  - src/middleware/rateLimit.js
requirements_addressed:
  - CORE-06
autonomous: true
---

# Plan 05-A: Rate Limiting Avançado & Fila de Mensagens Humanizada

## Objective
Melhorar o rate limiter com cooldown estendido, mensagens multilíngues, e criar a fila de envio humanizado para prevenir banimento pelo WhatsApp.

## Context
- CONTEXT.md decisions D-01 a D-05
- RESEARCH.md §1 (Rate Limiting & Fila) e §2 parcial (Fallback)

## Tasks

### Task 1 — Atualizar `src/middleware/rateLimit.js`: 5 msg/min + cooldown estendido multilíngue

<read_first>
- src/middleware/rateLimit.js (arquivo a modificar — ver estrutura atual)
- src/handlers/router.js (para entender como getRateLimitMessage é chamado e como obter language)
- src/session.js (padrão de getSession, para ver se já tem language acessível)
</read_first>

<action>
Substituir TODO o conteúdo de `src/middleware/rateLimit.js` com a implementação abaixo:

```javascript
/**
 * Rate Limiter por número de telefone
 * Previne spam e uso abusivo do bot
 * Phase 5: 5 msg/min + cooldown estendido após 3 violações consecutivas
 */

import logger from '../logger.js';

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 5;
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const COOLDOWN_VIOLATIONS = 3;            // Violações antes do cooldown
const COOLDOWN_DURATION_MS = 10 * 60_000; // 10 minutos de cooldown

// Map<phone, { count: number, resetAt: number, violationCount: number, cooldownUntil: number }>
const rateLimitMap = new Map();

/**
 * Verifica se o número atingiu o rate limit.
 * @param {string} phone — número de telefone
 * @returns {{ allowed: boolean, retryAfterMs: number, inCooldown: boolean }}
 */
export function checkRateLimit(phone) {
  const now = Date.now();
  const entry = rateLimitMap.get(phone) ?? {
    count: 0,
    resetAt: now + RATE_LIMIT_WINDOW_MS,
    violationCount: 0,
    cooldownUntil: 0
  };

  // Verificar cooldown estendido (após 3+ violações consecutivas)
  if (entry.cooldownUntil > now) {
    const retryAfterMs = entry.cooldownUntil - now;
    logger.warn('Cliente em cooldown estendido', { phone, retryAfterMs: Math.ceil(retryAfterMs / 1000) + 's' });
    return { allowed: false, retryAfterMs, inCooldown: true };
  }

  // Nova janela: resetar contador
  if (now >= entry.resetAt) {
    // Se a janela anterior foi limpa (sem violação), resetar violationCount
    if (entry.count < RATE_LIMIT_MAX) {
      entry.violationCount = 0;
    }
    entry.count = 1;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitMap.set(phone, entry);
    return { allowed: true, retryAfterMs: 0, inCooldown: false };
  }

  // Dentro da janela atual: verificar limite
  if (entry.count >= RATE_LIMIT_MAX) {
    entry.violationCount++;

    // Ativar cooldown estendido após COOLDOWN_VIOLATIONS violações consecutivas
    if (entry.violationCount >= COOLDOWN_VIOLATIONS) {
      entry.cooldownUntil = now + COOLDOWN_DURATION_MS;
      logger.warn('Cooldown estendido ativado', {
        phone,
        violations: entry.violationCount,
        cooldownMinutes: COOLDOWN_DURATION_MS / 60_000
      });
      rateLimitMap.set(phone, entry);
      return { allowed: false, retryAfterMs: COOLDOWN_DURATION_MS, inCooldown: true };
    }

    const retryAfterMs = entry.resetAt - now;
    logger.warn('Rate limit atingido', { phone, count: entry.count, retryAfterMs, violations: entry.violationCount });
    rateLimitMap.set(phone, entry);
    return { allowed: false, retryAfterMs, inCooldown: false };
  }

  entry.count++;
  rateLimitMap.set(phone, entry);
  return { allowed: true, retryAfterMs: 0, inCooldown: false };
}

/**
 * Mensagem amigável de rate limit (multilíngue).
 * @param {number} retryAfterMs
 * @param {string} [language='es'] — idioma da sessão ('es'|'pt'|'en')
 * @param {boolean} [inCooldown=false] — se está em cooldown estendido
 */
export function getRateLimitMessage(retryAfterMs, language = 'es', inCooldown = false) {
  const seconds = Math.ceil(retryAfterMs / 1000);
  const minutes = Math.ceil(retryAfterMs / 60_000);

  const messages = {
    es: {
      normal: `⏳ Muchos mensajes seguidos. Por favor espera ${seconds} segundos antes de continuar. ¡Gracias por tu paciencia! 😊`,
      cooldown: `⏳ Has enviado demasiados mensajes. Por favor espera ${minutes} minutos antes de continuar. ¡Gracias! 😊`
    },
    pt: {
      normal: `⏳ Muitas mensagens seguidas. Por favor aguarde ${seconds} segundos antes de continuar. Obrigado pela paciência! 😊`,
      cooldown: `⏳ Você enviou muitas mensagens. Por favor aguarde ${minutes} minutos antes de continuar. Obrigado! 😊`
    },
    en: {
      normal: `⏳ Too many messages. Please wait ${seconds} seconds before continuing. Thanks for your patience! 😊`,
      cooldown: `⏳ You've sent too many messages. Please wait ${minutes} minutes before continuing. Thank you! 😊`
    }
  };

  const lang = messages[language] ? language : 'es';
  return inCooldown ? messages[lang].cooldown : messages[lang].normal;
}

/**
 * Limpar entradas expiradas (chamado periodicamente para evitar memory leak)
 */
export function cleanupRateLimits() {
  const now = Date.now();
  let cleaned = 0;
  for (const [phone, entry] of rateLimitMap) {
    // Remover apenas se a janela expirou E o cooldown estendido também expirou
    if (now >= entry.resetAt && now >= (entry.cooldownUntil || 0)) {
      rateLimitMap.delete(phone);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug(`Rate limit cleanup: ${cleaned} entradas removidas`);
  }
}

// Limpeza automática a cada 5 minutos
setInterval(cleanupRateLimits, 5 * 60_000);
```

**Atualizar a chamada em `src/handlers/router.js`:**
Na linha onde `checkRateLimit` é chamado (linha ~71-73), atualizar para passar `language` e `inCooldown`:

```javascript
// Antes (linha 71-73):
const { allowed, retryAfterMs } = checkRateLimit(phone);
if (!allowed) {
  return getRateLimitMessage(retryAfterMs);
}

// Depois:
const { allowed, retryAfterMs, inCooldown } = checkRateLimit(phone);
if (!allowed) {
  const lang = session?.language || 'es';
  return getRateLimitMessage(retryAfterMs, lang, inCooldown);
}
```

**Nota:** A variável `session` ainda não está declarada neste ponto do código em `router.js`. Mover a criação da `session` para ANTES da verificação de rate limit:

```javascript
// ANTES de checkRateLimit, adicionar:
const session = getSession(phone);
```

E remover a declaração duplicada de `session` que existe mais abaixo (linha ~82: `const session = getSession(phone);`).
</action>

<acceptance_criteria>
- `src/middleware/rateLimit.js` contém `RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 5`
- `src/middleware/rateLimit.js` contém `COOLDOWN_VIOLATIONS = 3` e `COOLDOWN_DURATION_MS = 10 * 60_000`
- `src/middleware/rateLimit.js` exporta `checkRateLimit` retornando `{ allowed, retryAfterMs, inCooldown }`
- `src/middleware/rateLimit.js` contém `violationCount` e `cooldownUntil` no mapa de entries
- `getRateLimitMessage` aceita 3 parâmetros: `(retryAfterMs, language, inCooldown)` e retorna mensagens em ES/PT/EN
- `src/handlers/router.js` passa `lang` e `inCooldown` para `getRateLimitMessage`
- `src/handlers/router.js` declara `session = getSession(phone)` antes da verificação de rate limit (sem duplicata)
</acceptance_criteria>

---

### Task 2 — Criar `src/middleware/messageQueue.js`: fila de envio humanizado

<read_first>
- src/index.js (ver como msg.reply é chamado atualmente — linha 101)
- src/middleware/rateLimit.js (padrão de módulo ES module com export)
- src/logger.js (padrão de uso do logger)
</read_first>

<action>
Criar novo arquivo `src/middleware/messageQueue.js`:

```javascript
/**
 * Message Queue — Fila de Envio Humanizado
 *
 * Adiciona delay aleatório (1-3 segundos) antes de enviar respostas
 * e marca mensagens como lidas (sendSeen) antes de responder.
 * Objetivo: simular comportamento humano para reduzir risco de banimento
 * pelo WhatsApp/Meta.
 *
 * Phase 5: D-04 (delay humanizado) e D-05 (sendSeen antes de responder)
 */

import logger from '../logger.js';

const MIN_DELAY_MS = parseInt(process.env.MSG_DELAY_MIN_MS) || 1000; // 1 segundo
const MAX_DELAY_MS = parseInt(process.env.MSG_DELAY_MAX_MS) || 3000; // 3 segundos

/**
 * Gerar delay aleatório entre MIN_DELAY_MS e MAX_DELAY_MS.
 */
function randomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
}

/**
 * Aguardar um número de milissegundos.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enviar resposta ao cliente com delay humanizado.
 *
 * 1. Marca a mensagem como lida (sendSeen) — simula que o "atendente" viu
 * 2. Aguarda delay aleatório de 1-3 segundos — simula tempo de digitação
 * 3. Envia a resposta via msg.reply()
 *
 * @param {object} msg — objeto de mensagem do whatsapp-web.js
 * @param {string} response — texto da resposta a enviar
 * @returns {Promise<void>}
 */
export async function sendWithDelay(msg, response) {
  const delayMs = randomDelay();

  // Marcar mensagem como lida antes de responder
  try {
    const chat = await msg.getChat();
    await chat.sendSeen();
    logger.debug('Mensagem marcada como lida (sendSeen)', { from: msg.from });
  } catch (err) {
    // sendSeen pode falhar se o chat não estiver disponível — não bloquear o envio
    logger.warn('Falha ao marcar como lida (sendSeen)', { from: msg.from, error: err.message });
  }

  // Delay humanizado (simula tempo de digitação)
  logger.debug(`Aguardando ${delayMs}ms antes de responder (delay humanizado)`, { from: msg.from });
  await sleep(delayMs);

  // Enviar resposta
  await msg.reply(response);
}
```
</action>

<acceptance_criteria>
- Arquivo `src/middleware/messageQueue.js` existe
- Contém `export async function sendWithDelay(msg, response)`
- Contém `const MIN_DELAY_MS = parseInt(process.env.MSG_DELAY_MIN_MS) || 1000`
- Contém `const MAX_DELAY_MS = parseInt(process.env.MSG_DELAY_MAX_MS) || 3000`
- Contém `await chat.sendSeen()` dentro de try/catch
- Contém `await sleep(delayMs)` antes de `await msg.reply(response)`
- Usa `import logger from '../logger.js'` — ES Module syntax
</acceptance_criteria>

---

### Task 3 — Atualizar `.env.example` com novas variáveis da Fase 5

<read_first>
- .env.example (arquivo a modificar — ver variáveis existentes)
- .env (ver se tem as novas variáveis para não duplicar)
</read_first>

<action>
Adicionar ao final de `.env.example` as seguintes variáveis (antes de qualquer comentário de seção existente, ou criar nova seção):

```dotenv
# ─── Rate Limiting (Phase 5) ──────────────────────────────────────────────────
RATE_LIMIT_MAX=5
RATE_LIMIT_WINDOW_MS=60000

# ─── Message Queue — Delay Humanizado (Phase 5) ───────────────────────────────
MSG_DELAY_MIN_MS=1000
MSG_DELAY_MAX_MS=3000

# ─── Admin Notifications (Phase 5) ───────────────────────────────────────────
# Número do administrador que recebe alertas do bot (formato: 5959812345678 sem @c.us)
ADMIN_PHONE=

# ─── Health Check Server (Phase 5) ───────────────────────────────────────────
HEALTH_PORT=8080
# Token de autenticação para o endpoint /health (gere um UUID ou string aleatória)
HEALTH_TOKEN=
```

Também adicionar ao `.env` real as mesmas variáveis com valores de desenvolvimento:
```dotenv
RATE_LIMIT_MAX=5
RATE_LIMIT_WINDOW_MS=60000
MSG_DELAY_MIN_MS=1000
MSG_DELAY_MAX_MS=3000
ADMIN_PHONE=
HEALTH_PORT=8080
HEALTH_TOKEN=aria-health-dev-token
```
</action>

<acceptance_criteria>
- `.env.example` contém `RATE_LIMIT_MAX=5`
- `.env.example` contém `ADMIN_PHONE=`
- `.env.example` contém `HEALTH_PORT=8080`
- `.env.example` contém `HEALTH_TOKEN=`
- `.env.example` contém `MSG_DELAY_MIN_MS=1000` e `MSG_DELAY_MAX_MS=3000`
- `.env` contém `HEALTH_TOKEN=aria-health-dev-token` (ou valor de dev)
</acceptance_criteria>

---

## Verification

<verification>
### Verificação do Rate Limiter
```bash
# Confirmar RATE_LIMIT_MAX=5
grep "RATE_LIMIT_MAX.*|| 5" src/middleware/rateLimit.js

# Confirmar cooldown estendido
grep "COOLDOWN_VIOLATIONS\|cooldownUntil\|violationCount" src/middleware/rateLimit.js

# Confirmar getRateLimitMessage trilíngue
grep "messages.pt\|messages.en\|messages.es" src/middleware/rateLimit.js

# Confirmar inCooldown retornado
grep "inCooldown" src/middleware/rateLimit.js

# Confirmar router.js passa language para getRateLimitMessage
grep "getRateLimitMessage.*lang" src/handlers/router.js
```

### Verificação da Fila
```bash
# Confirmar arquivo criado
test -f src/middleware/messageQueue.js && echo "OK"

# Confirmar sendWithDelay exportado
grep "export async function sendWithDelay" src/middleware/messageQueue.js

# Confirmar sendSeen
grep "sendSeen" src/middleware/messageQueue.js

# Confirmar delay aleatório
grep "randomDelay\|MIN_DELAY_MS\|MAX_DELAY_MS" src/middleware/messageQueue.js
```

### Verificação Sintaxe
```bash
node --input-type=module --eval "import './src/middleware/rateLimit.js'; console.log('OK')"
node --input-type=module --eval "import './src/middleware/messageQueue.js'; console.log('OK')"
```
</verification>

<must_haves>
- Rate limit reduzido para 5 msg/min (D-01)
- Cooldown de 10 min após 3 violações (D-02)
- getRateLimitMessage aceita language e retorna mensagem no idioma correto (D-03)
- sendWithDelay com sendSeen + delay 1-3s criado e exportado (D-04, D-05)
- router.js atualizado para usar language no rate limit message
</must_haves>
