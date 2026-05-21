# Research Summary — Auto Zap (ARIA)

## Stack Recomendada (2025)

### Runtime & Framework
- **Node.js 20 LTS** — suporte LTS estável, ES modules nativos
- **whatsapp-web.js** (pacote principal, base do OpenWA referenciado) — `npm install whatsapp-web.js`
- **Puppeteer** (bundled) — necessário para whatsapp-web.js no VPS Linux
- **@anthropic-ai/sdk** — cliente oficial Claude API
- **node-fetch / axios** — HTTP client para App Script

### Autenticação WhatsApp
- **LocalAuth** para MVP (dados em `.wwebjs_auth/` local) — ideal para VPS Hostinger com disco persistente
- Migrar para **RemoteAuth + MongoDB** apenas se escalar para Docker/multi-instância

### Gerenciamento de Contexto Claude
- API é **stateless** — histórico mantido em memória (Map<phone, messages[]>)
- **claude-3-5-haiku-20241022** — modelo recomendado para velocidade e custo em chatbots
- System prompt cacheável (prompt caching) para reduzir custo em até 90%
- Histórico: manter últimas 20 mensagens por sessão, trimmar automaticamente

### Integração Google Sheets
- **App Script como REST API** (já publicado pelo usuário) — Abordagem 2, ideal para MVP
- `fetch()` nativo do Node.js 20 — sem necessidade de biblioteca extra
- GET para consultas, POST para registros (leads, histórico)

### Deploy VPS
- **PM2** — process manager, restart automático, logs
- Puppeteer no Linux: flags obrigatórias `--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage`
- **dotenv** — gerenciamento de variáveis de ambiente

## Pitfalls Críticos

### WhatsApp / OpenWA
1. **Banimento de conta** — evitar mensagens não solicitadas; responder apenas a quem iniciou conversa
2. **QR Code expirado** — implementar auto-reconexão com evento `disconnected`
3. **Puppeteer no VPS** — sem flags corretas, não inicia; `--no-sandbox` obrigatório em Linux
4. **WhatsApp Web session timeout** — sessão pode expirar; usar `LocalAuth` para persistir
5. **Rate limiting** — delays aleatórios entre respostas para parecer mais humano

### Claude API
6. **Context window** — histórico ilimitado explode tokens; implementar trim automático
7. **Latência** — Haiku ~1s, Sonnet ~3s; usar streaming para UX melhor
8. **Custo** — sem rate limiting no bot, usuários maliciosos geram custo; implementar limite por sessão

### Google Sheets / App Script
9. **Quota do App Script** — 20k chamadas/dia em conta gratuita; agrupar operações quando possível
10. **Latência do App Script** — cold start ~2-3s; cachear dados estáticos (produtos, FAQ) em memória no Node.js
11. **CORS** — App Script retorna CORS headers corretos para `fetch` do Node.js

## Arquitetura Recomendada

```
src/
├── index.js            — Entry point, inicialização WA client + Express
├── aria.js             — System prompt ARIA (trilíngue, persona configurável)
├── claude.js           — Claude API client + histórico por sessão
├── sheets.js           — App Script HTTP client (GET/POST) + cache em memória
├── session.js          — Gerenciamento de sessões ativas por número
├── handlers/
│   ├── router.js       — Roteador principal (detecta intenção + delega)
│   ├── products.js     — Consulta catálogo e estoque
│   ├── faq.js          — Busca e resposta de FAQ
│   ├── branches.js     — Informações de filiais
│   ├── services.js     — Informações de serviços
│   ├── leads.js        — Registro de interesse/lead
│   └── history.js      — Registro de histórico de conversa
├── middleware/
│   └── rateLimit.js    — Rate limiting por número
└── logger.js           — Winston logger estruturado
```

## Decisões de Design

| Decisão | Escolha | Rationale |
|---------|---------|-----------|
| WhatsApp lib | whatsapp-web.js (LocalAuth) | MVP simples, VPS com disco persistente |
| Claude model | claude-3-5-haiku-20241022 | Velocidade + custo para chatbot |
| Sheets acesso | App Script REST (já publicado) | Zero configuração extra |
| Cache de dados | In-memory Map com TTL 15min | Reduz chamadas ao App Script |
| Idioma detection | Via prompt Claude (não lib externa) | Mais simples, Claude é excelente em multilíngue |
| Session storage | In-memory Map | MVP; migrar para Redis na v2 |
