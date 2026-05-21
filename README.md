# Auto Zap — ARIA 🤖

Bot de atendimento ao cliente via WhatsApp, trilíngue (ES/PT/EN), alimentado pela Claude API.

## Stack

- **Node.js** 20+ com ES Modules
- **whatsapp-web.js** — automação WhatsApp via Puppeteer
- **Claude API** (Anthropic) — inteligência e NLU
- **Google Sheets** via App Script — base de dados do MVP
- **Fuse.js** — busca fuzzy no catálogo
- **Winston** — logging estruturado

## Pré-requisitos

- Node.js 20 ou superior
- Conta Anthropic com API key
- Google Sheets configurado com App Script publicado
- Google Chrome ou Chromium instalado (para Puppeteer/WhatsApp Web)

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Editar `.env` com suas credenciais:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
GOOGLE_SHEETS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
WA_CLIENT_ID=aria-main
```

### 3. Iniciar o bot

```bash
npm start
```

Na primeira execução, um QR Code aparecerá no terminal. Escaneie com o WhatsApp do número que será usado pelo bot.

### 4. Desenvolvimento (auto-reload)

```bash
npm run dev
```

## Estrutura do Projeto

```
src/
├── index.js              — Entry point, inicialização WhatsApp client
├── aria.js               — System prompt ARIA (persona trilíngue)
├── claude.js             — Claude API client + histórico por sessão
├── sheets.js             — Google Sheets via App Script (GET/POST + cache)
├── session.js            — Gerenciamento de sessões ativas por telefone
├── logger.js             — Winston logger estruturado
├── handlers/
│   └── router.js         — Roteador principal de mensagens
└── middleware/
    └── rateLimit.js      — Rate limiting por número
docs/
└── DEPLOY.md             — Guia de deploy VPS Hostinger
tests/
└── (testes de integração)
```

## Variáveis de Ambiente

| Variável | Descrição | Default |
|----------|-----------|---------|
| `ANTHROPIC_API_KEY` | API key da Anthropic | (obrigatório) |
| `GOOGLE_SHEETS_SCRIPT_URL` | URL do App Script publicado | (obrigatório) |
| `WA_CLIENT_ID` | ID único do cliente WhatsApp (para LocalAuth) | `aria-main` |
| `MAX_HISTORY_MESSAGES` | Máximo de mensagens no histórico por sessão | `20` |
| `SESSION_TIMEOUT_MS` | Timeout de inatividade da sessão (ms) | `1800000` (30min) |
| `RATE_LIMIT_MAX` | Máximo de mensagens por janela de tempo | `10` |
| `RATE_LIMIT_WINDOW_MS` | Janela de tempo do rate limit (ms) | `60000` (1min) |
| `LOG_LEVEL` | Nível de log (error/warn/info/debug) | `info` |
| `NODE_ENV` | Ambiente (development/production) | `development` |

## Deploy VPS

Ver [docs/DEPLOY.md](docs/DEPLOY.md) para instruções de deploy na VPS Hostinger com PM2.

## Troubleshooting

**QR Code não aparece:** Verifique se Chromium está instalado. No Ubuntu/Debian: `sudo apt install chromium-browser`

**Bot desconecta frequentemente:** Normal no início. O `LocalAuth` persiste a sessão em `.wwebjs_auth/` após o primeiro login.

**Erro 429 da Claude API:** Rate limit da Anthropic atingido. Considere aumentar `RATE_LIMIT_MAX` para reduzir volume.
