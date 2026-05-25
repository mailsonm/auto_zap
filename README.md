# Auto Zap — Samantha 🤖

Bot de atendimento ao cliente via WhatsApp, trilíngue (ES/PT/EN), alimentado pela OpenAI API (modelo GPT-4o-mini).

## Stack

- **Node.js** 20+ com ES Modules
- **whatsapp-web.js** — automação WhatsApp via Puppeteer
- **OpenAI API** — inteligência e NLU (modelo `gpt-4o-mini`)
- **Google Sheets** via App Script — base de dados do MVP
- **Fuse.js** — busca fuzzy no catálogo
- **Winston** — logging estruturado
- **Jest** — framework de testes de integração

## Pré-requisitos

- Node.js 20 ou superior
- Conta OpenAI com API key
- Google Sheets configurado com App Script publicado
- Google Chrome ou Chromium instalado (para Puppeteer/WhatsApp Web)

---

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
OPENAI_API_KEY=sk-proj-...
GOOGLE_SHEETS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
WA_CLIENT_ID=samantha-main
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

### 5. Executar a Suíte de Testes (Jest)

A suíte de testes de integração roda 100% isolada e mockada (offline):

```bash
npm test
```

---

## Estrutura do Projeto

```
src/
├── index.js              — Entry point, inicialização WhatsApp e interceptador message_create
├── aria.js               — System prompt Samantha (persona trilíngue)
├── openai.js             — OpenAI API client + histórico por sessão
├── sheets.js             — Google Sheets via App Script (GET/POST + cache + controle)
├── session.js            — Gerenciamento de sessões ativas, takeover e cooldown
├── logger.js             — Winston logger estruturado
├── handlers/
│   └── router.js         — Roteador principal com controle bidirecional Sheets
└── middleware/
    ├── rateLimit.js      — Rate limiting por número
    └── messageQueue.js   — Fila de envio com delay humanizado e typing indicator
docs/
├── DEPLOY.md             — Guia de deploy VPS Hostinger
├── OPERATIONS.md         — Guia de atendimento híbrido para operadores humanos
└── ERP-INTEGRATION.md    — Checklist conceitual e contratos para migração ERP
tests/
├── mocks/                — Stubs e fakes para WhatsApp, OpenAI e Sheets
└── integration/          — Testes de integração de handlers e roteamento
```

---

## Variáveis de Ambiente

| Variável | Descrição | Default |
| :--- | :--- | :--- |
| `OPENAI_API_KEY` | API key da OpenAI | (obrigatório) |
| `GOOGLE_SHEETS_SCRIPT_URL` | URL do App Script publicado | (obrigatório) |
| `WA_CLIENT_ID` | ID único do cliente WhatsApp (para LocalAuth) | `samantha-main` |
| `OPENAI_MODEL` | Modelo OpenAI (gpt-4o-mini = recomendado) | `gpt-4o-mini` |
| `OPENAI_MAX_TOKENS` | Limite de tokens por resposta | `512` |
| `MAX_HISTORY_MESSAGES` | Máximo de mensagens no histórico por sessão | `20` |
| `SESSION_TIMEOUT_MS` | Timeout de inatividade da sessão (ms) | `1800000` (30min) |
| `HUMAN_TAKEOVER_COOLDOWN_MIN` | Tempo de silêncio do bot após takeover (min) | `30` |
| `RATE_LIMIT_MAX` | Máximo de mensagens por janela de tempo | `5` |
| `RATE_LIMIT_WINDOW_MS` | Janela de tempo do rate limit (ms) | `60000` (1min) |
| `LOG_LEVEL` | Nível de log (error/warn/info/debug) | `info` |
| `NODE_ENV` | Ambiente (development/production) | `development` |

---

## Deploy VPS

Ver [docs/DEPLOY.md](docs/DEPLOY.md) para instruções de deploy na VPS Hostinger com PM2.

## Atendimento Híbrido

Consulte [docs/OPERATIONS.md](docs/OPERATIONS.md) para entender como os atendentes operam junto com o bot e utilizam a planilha para pausar/reativar a assistente Samantha.

## Troubleshooting

**QR Code não aparece:** Verifique se Chromium está instalado. No Ubuntu/Debian: `sudo apt install chromium-browser`

**Erro 429 da OpenAI:** Rate limit da OpenAI atingido. Verifique se seu plano na OpenAI possui créditos ativos.
