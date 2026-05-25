# Summary — Plan 05-A: Rate Limiting Avançado & Fila de Mensagens Humanizada

**Phase:** 5 — Robustez, Rate Limiting & Deploy VPS
**Plan:** 05-A
**Wave:** 1
**Status:** ✅ Complete
**Commit:** feat(05-A): rate limit 5msg/min + cooldown 10min + fila humanizada + msgs trilingues

## What Was Built

### 1. Rate Limiter Aprimorado (`src/middleware/rateLimit.js`)
- **Limite reduzido**: 5 msg/min por número (era 10 — D-01)
- **Cooldown estendido**: após 3 violações consecutivas, cliente entra em cooldown de 10 minutos (D-02)
- **Mensagens multilíngues**: `getRateLimitMessage(ms, language, inCooldown)` retorna mensagens em ES/PT/EN com variantes para cooldown normal e cooldown estendido (D-03)
- **Cleanup periódico**: `setInterval` a cada 5 min remove entradas expiradas

### 2. Fila de Envio Humanizado (`src/middleware/messageQueue.js`) — NOVO
- `sendWithDelay(msg, response)`: marca mensagem como lida via `chat.sendSeen()` + aguarda 1-3 segundos aleatórios + envia `msg.reply()` (D-04, D-05)
- Anti-banimento WhatsApp: simula comportamento humano (digitação lenta)
- `sendSeen` falha silenciosamente (try/catch) — não bloqueia o envio

### 3. Atualização do Router (`src/handlers/router.js`)
- `session` movida para antes do check de rate limit
- Rate limit recebe `lang` e `inCooldown` para mensagem no idioma correto do cliente

### 4. Variáveis de Ambiente
- `.env.example` e `.env`: `RATE_LIMIT_MAX=5`, `MSG_DELAY_MIN_MS=1000`, `MSG_DELAY_MAX_MS=3000`

## Acceptance Criteria — All Passed ✅
- [x] RATE_LIMIT_MAX = 5
- [x] COOLDOWN_VIOLATIONS = 3, COOLDOWN_DURATION_MS = 10 * 60_000
- [x] checkRateLimit retorna `{ allowed, retryAfterMs, inCooldown }`
- [x] getRateLimitMessage(ms, language, inCooldown) — 3 parâmetros, ES/PT/EN
- [x] sendWithDelay exportado com sendSeen + delay aleatório
- [x] router.js passa lang e inCooldown para getRateLimitMessage
- [x] Sintaxe Node.js válida (node --check)
