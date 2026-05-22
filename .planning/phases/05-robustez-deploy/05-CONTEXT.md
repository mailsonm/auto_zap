# Phase 5: Robustez, Rate Limiting & Deploy VPS - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Tornar o bot ARIA pronto para produção: proteção inteligente contra spam/abuso com fila humanizada de envio de respostas (anti-banimento WhatsApp), tratamento resiliente de erros de conexão com estados do OpenWA (UNPAIRED, CONFLICT, TIMEOUT), endpoint de monitoramento `/health`, e deploy estruturado na VPS Hostinger com script `deploy.sh` e rotação de logs.

</domain>

<decisions>
## Implementation Decisions

### Rate Limiting & Fila de Mensagens (Anti-Spam / Anti-Banimento)
- **D-01:** Reduzir o limite de rate limit de 10 para **5 mensagens por minuto** por cliente (mais seguro contra spam acidental).
- **D-02:** Implementar **cooldown estendido de 10 minutos** para clientes que violarem o rate limit 3+ vezes consecutivas. Após 3 janelas de violação, entrar em cooldown automático.
- **D-03:** A mensagem de aviso de rate limit deve ser **trilíngue**: detectar o idioma da sessão (`session.language` de `session.js`) e responder em ES/PT/EN — reutilizar a função `detectLanguage()` da Fase 4.
- **D-04:** Implementar **fila de envio de respostas** (`src/middleware/messageQueue.js`): antes de chamar `msg.reply()`, aguardar um delay aleatório de **1 a 3 segundos** para simular comportamento humano e reduzir risco de banimento pelo Meta.
- **D-05:** Antes de enviar a resposta, chamar `client.sendSeen(msg.from)` para marcar a mensagem como lida (simula que o "atendente" viu antes de digitar).

### Tratamento de Erros do WhatsApp / OpenWA
- **D-06:** Monitorar os estados críticos do OpenWA via `client.onStateChanged()`:
  - `UNPAIRED` → sessão expirada ou banida → acionar reconexão + notificar admin
  - `CONFLICT` → WhatsApp aberto em outro dispositivo → forçar reconexão silenciosa + notificar admin
  - `TIMEOUT` → Puppeteer/Chrome travado → encerrar processo (PM2 reinicia)
- **D-07:** Estratégia de reconexão com **backoff exponencial**: tentar 3 vezes (5s → 15s → 30s). Se as 3 tentativas falharem, parar e deixar o PM2 reiniciar o processo completo.
- **D-08:** Quando o bot desconecta ou reconecta com sucesso, **enviar mensagem de notificação para o número admin** configurável via `ADMIN_PHONE` no `.env`.
- **D-09:** Quando o processamento de uma mensagem falha (erro Claude API, timeout Sheets, exceção inesperada), o cliente deve receber uma **mensagem amigável genérica de fallback** em espanhol (padrão) + registrar o erro no log estruturado.

### Monitoramento & Health Check
- **D-10:** Expor um servidor HTTP simples na **porta 8080** com o endpoint `GET /health`.
- **D-11:** O endpoint `/health` retorna JSON com: `status`, `uptime` (segundos desde o início), `activeSessions` (contagem de sessões ativas no `claude.js`), `waConnected` (boolean do estado do cliente WhatsApp), `timestamp`.
- **D-12:** O endpoint deve ser protegido por **token simples**: validar `Authorization: Bearer <token>` ou query param `?token=<token>`. Token configurável via `HEALTH_TOKEN` no `.env`.

### Estratégia de Deploy na VPS
- **D-13:** Criar script **`deploy.sh`** na raiz do projeto que executa em sequência:
  1. Parar o bot (`pm2 stop aria-bot`)
  2. Backup da sessão WhatsApp (`cp -r .wwebjs_auth/ .wwebjs_auth.bkp/`)
  3. Atualizar código (`git pull origin main`)
  4. Instalar dependências (`npm install --production`)
  5. Reiniciar o bot (`pm2 start ecosystem.config.js --update-env`)
- **D-14:** Configurar **rotação de logs via `logrotate` do Linux**: semanal, manter 4 semanas de histórico. Criar arquivo de configuração `/etc/logrotate.d/aria-bot` como parte do guia de deploy.
- **D-15:** Atualizar `docs/DEPLOY.md` com seção sobre o script `deploy.sh`, configuração do `logrotate` e instrução para configurar `ADMIN_PHONE` e `HEALTH_TOKEN` no `.env`.

### the agent's Discretion
- Implementação interna do servidor HTTP de health check: usar o módulo `http` nativo do Node.js (sem Express) para manter as dependências mínimas.
- Formato exato das mensagens de notificação admin: mensagem simples em espanhol com emoji, ex: `"⚠️ ARIA bot desconectado. Motivo: CONFLICT. Tentando reconectar..."`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Código Existente a Modificar
- `src/middleware/rateLimit.js` — Rate limiter atual (sliding window, 10 msg/min) — será modificado para 5 msg/min + cooldown estendido
- `src/handlers/router.js` — Ponto de integração do rate limit e da fila de mensagens; contém `detectLanguage()` para reutilização nas mensagens de rate limit
- `src/index.js` — Evento `disconnected` existente; será estendido com `onStateChanged` e backoff exponencial
- `src/claude.js` — Exporta `sessions` (Map) para o health check poder contar sessões ativas
- `src/session.js` — `getSession()`, `closeSession()` — padrão de gerenciamento de sessão

### Arquivos a Criar
- `src/middleware/messageQueue.js` — Fila de envio com delay humanizado (D-04, D-05)
- `src/health.js` — Servidor HTTP na porta 8080 com `GET /health` (D-10 a D-12)
- `deploy.sh` — Script de deploy na raiz do projeto (D-13)

### Configuração e Deploy
- `ecosystem.config.js` — PM2 config existente; verificar se precisa de ajustes
- `.env.example` — Adicionar: `RATE_LIMIT_MAX=5`, `ADMIN_PHONE`, `HEALTH_TOKEN`, `HEALTH_PORT=8080`
- `docs/DEPLOY.md` — Guia existente; atualizar com logrotate, deploy.sh e novas env vars

### Referências do Projeto
- `.planning/ROADMAP.md` §Phase 5 — Success Criteria oficiais desta fase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `detectLanguage(text)` em `src/handlers/router.js` — pode ser importada para gerar mensagens de rate limit trilíngues
- `sessions` (Map exportado de `src/claude.js`) — usar para contar sessões ativas no health check
- `logger` de `src/logger.js` — já usa Winston com JSON em produção; usar em todos os novos módulos
- `rateLimit.js` — janela deslizante e cleanup periódico já funcionais; extender sem reescrever

### Established Patterns
- Todas as constantes configuráveis via `.env` com defaults sensatos (ex: `parseInt(process.env.X) || default`)
- Cleanup periódico via `setInterval` (padrão em `rateLimit.js` e `claude.js`)
- Imports ES Modules (`import/export`) — manter em todos os novos arquivos
- Logger sempre chamado com contexto estruturado: `logger.info('msg', { phone, dados })`

### Integration Points
- `src/index.js` → inicializar `messageQueue.js` e `health.js` no startup do bot
- `src/handlers/router.js` → substituir `msg.reply(response)` por chamada à fila de mensagens
- `src/middleware/rateLimit.js` → adicionar lógica de cooldown estendido e mensagens trilíngues

</code_context>

<specifics>
## Specific Ideas

- **Anti-banimento via fila de mensagens:** Ideia levantada pelo usuário — simular comportamento humano para evitar detecção de spam pelo Meta/WhatsApp. Delay de 1-3 segundos + `sendSeen` antes da resposta.
- **Estados críticos do OpenWA:** Usuário identificou `UNPAIRED` (sessão expirada/banida) e `CONFLICT` (WhatsApp aberto em outro lugar) como estados críticos a monitorar explicitamente via `onStateChanged`.
- **Notificação admin via WhatsApp:** Quando o bot desconecta ou reconecta, enviar mensagem de notificação para o próprio número admin. Número configurado via `ADMIN_PHONE` no `.env`.

</specifics>

<deferred>
## Deferred Ideas

- **CI/CD com GitHub Actions** — deploy automático na VPS via push na `main`. Válido para v2; no MVP o deploy manual com `deploy.sh` é suficiente.
- **Métricas avançadas no health check** — taxa de erro, latência média, mensagens processadas. Pode ser adicionado na Fase 6 (Testes & Documentação).
- **pm2-logrotate** — alternativa ao logrotate do Linux mencionada. Postergado; logrotate nativo do Linux é mais simples e sem dependência adicional.
- **Blacklist permanente de spammers** — via `.env` ou arquivo de config. Fora do escopo do MVP; o cooldown de 10 min cobre o caso de uso mais comum.

</deferred>

---

*Phase: 5-Robustez, Rate Limiting & Deploy VPS*
*Context gathered: 2026-05-22*
