# Phase 1: Fundação — OpenWA + Claude + Google Sheets

**Goal:** Servidor Node.js funcional com WhatsApp conectado, Claude API integrada e acesso aos dados do Google Sheets via App Script. ARIA responde mensagens básicas de forma coerente em 3 idiomas.

**Requirements:** CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06

---

## Plan A — Scaffolding & Configuração do Projeto

**Objetivo:** Estrutura de projeto Node.js com todas as dependências instaladas e variáveis de ambiente configuradas.

### Tarefas

1. **Inicializar projeto Node.js**
   - `npm init -y`
   - Configurar `package.json` com `"type": "module"` para ES modules
   - Criar `.gitignore` (node_modules, .env, .wwebjs_auth, *.log)

2. **Instalar dependências**
   ```bash
   npm install whatsapp-web.js @anthropic-ai/sdk qrcode-terminal dotenv winston
   npm install -D nodemon
   ```

3. **Criar estrutura de pastas**
   ```
   src/
   ├── handlers/
   ├── middleware/
   └── (arquivos principais)
   docs/
   tests/
   ```

4. **Criar `.env.example`** com todas as variáveis necessárias:
   ```env
   ANTHROPIC_API_KEY=sk-ant-...
   GOOGLE_SHEETS_SCRIPT_URL=https://script.google.com/macros/s/...
   WA_CLIENT_ID=aria-main
   MAX_HISTORY_MESSAGES=20
   SESSION_TIMEOUT_MS=1800000
   RATE_LIMIT_MAX=10
   RATE_LIMIT_WINDOW_MS=60000
   LOG_LEVEL=info
   NODE_ENV=development
   ```

5. **Criar `README.md`** com instruções de setup básico

### Critério de Aceitação
- `node --version` >= 20
- `npm install` completa sem erros
- `.env` criado a partir do `.env.example` com valores reais

---

## Plan B — Cliente Google Sheets (App Script)

**Objetivo:** Módulo `src/sheets.js` que consulta e escreve dados via App Script com cache em memória.

### Tarefas

1. **Implementar `src/sheets.js`**
   - Função `getSheet(sheetName)` — GET para App Script retorna array de objetos
   - Cache em memória com TTL configurável (default: 15 min para dados estáticos)
   - Função `appendRow(sheetName, data)` — POST para App Script
   - Tratamento de erros com retry (1x) e fallback gracioso

2. **Funções específicas por aba:**
   - `getProducts()` — retorna array de produtos com cache
   - `getBranches()` — retorna filiais com cache
   - `getServices()` — retorna serviços com cache
   - `getFAQs()` — retorna FAQs com cache
   - `getSystemInfo()` — retorna dados da empresa com cache longo (1h)
   - `appendLead(data)` — registra lead sem cache
   - `appendHistory(data)` — registra histórico sem cache

3. **Testar conectividade** com o App Script publicado do usuário

### Critério de Aceitação
- `getProducts()` retorna array de produtos do Google Sheets
- `appendLead({})` registra linha na aba correta
- Cache evita chamadas repetidas em 15 minutos

---

## Plan C — Cliente Claude API (ARIA)

**Objetivo:** Módulo `src/claude.js` com gerenciamento de histórico por sessão e prompt do sistema ARIA configurável.

### Tarefas

1. **Implementar `src/aria.js`** — System prompt do ARIA
   ```javascript
   // Prompt trilíngue — ARIA responde no idioma do cliente
   export const ARIA_SYSTEM_PROMPT = `
   Você é ARIA, assistente virtual da [EMPRESA].
   ...
   `;
   ```
   - Personalidade: informal, acolhedora, usa emojis com moderação
   - Regras: idioma detectado automaticamente (ES primário, PT, EN)
   - Limites: o que pode e não pode fazer (não faz pedidos diretos, registra lead)
   - Dados da empresa: injetados dinamicamente via `getSystemInfo()`

2. **Implementar `src/claude.js`**
   - `Map<phone, Message[]>` para histórico por sessão
   - `chat(phone, userMessage, contextData)` — envia mensagem com histórico + contexto
   - Trim automático do histórico (manter últimas N mensagens configurável)
   - Timeout de sessão (após 30min de inatividade, limpar histórico)
   - Injeção de contexto de dados (produtos buscados, FAQ encontrado) no prompt

3. **Modelo:** `claude-3-5-haiku-20241022`
   - `max_tokens: 512` para respostas concisas no WhatsApp
   - Temperatura `0.7` para naturalidade sem aleatoriedade excessiva

### Critério de Aceitação
- `chat("5511999999999", "Hola")` retorna resposta coerente em espanhol
- Segunda mensagem mantém contexto da primeira
- Após 30min de inatividade, histórico é limpo

---

## Plan D — Servidor WhatsApp (OpenWA)

**Objetivo:** `src/index.js` com cliente WhatsApp funcionando, autenticado e processando mensagens.

### Tarefas

1. **Implementar `src/index.js`**
   - Inicializar `Client` do whatsapp-web.js com `LocalAuth`
   - Configuração Puppeteer para VPS Linux (flags no-sandbox)
   - Evento `qr` — exibir QR Code no terminal (qrcode-terminal)
   - Evento `ready` — log de conexão estabelecida
   - Evento `disconnected` — log + tentativa de reinicialização
   - Evento `message` — delegar ao handler principal

2. **Implementar `src/session.js`**
   - Rastrear sessões ativas por número de telefone
   - Guardar: timestamp última mensagem, idioma detectado, estado atual
   - `isHumanTakeover(phone)` — verifica se conversa foi assumida por humano

3. **Implementar `src/handlers/router.js`** (versão básica Phase 1)
   - Receber mensagem → buscar contexto → chamar Claude → enviar resposta
   - Detectar pedido de "falar com humano" → marcar sessão + notificar
   - Ignorar mensagens de grupos (só 1:1)
   - Ignorar mensagens do próprio bot

4. **Integrar tudo:** index.js → router.js → claude.js → sheets.js

### Critério de Aceitação
- QR Code exibido no terminal ao iniciar
- Mensagem recebida gera resposta da ARIA em < 5s
- ARIA responde em ES quando recebe "Hola"
- ARIA responde em PT quando recebe "Olá"
- "quiero hablar con una persona" → mensagem de encaminhamento + sessão marcada

---

## Plan E — Logger, Rate Limit & .gitignore

**Objetivo:** Infraestrutura de suporte para produção — logging estruturado e proteção básica.

### Tarefas

1. **Implementar `src/logger.js`** (Winston)
   - Level: `info` por padrão (configurável via `LOG_LEVEL`)
   - Output: console (dev) + arquivo `logs/app.log` (produção)
   - Formato: timestamp + level + message + metadata JSON

2. **Implementar `src/middleware/rateLimit.js`**
   - `Map<phone, {count, resetTime}>` em memória
   - Default: 10 mensagens por minuto por número
   - Resposta ao ultrapassar: mensagem amigável de "aguarde um momento"

3. **Revisar `.gitignore`**
   ```gitignore
   node_modules/
   .env
   .wwebjs_auth/
   logs/
   *.log
   ```

### Critério de Aceitação
- Logs aparecem no console com timestamp e nível
- Ao enviar 11 mensagens em 1 minuto, recebe aviso de rate limit
- Arquivo `.env` não aparece em `git status`

---

## Sequência de Execução

```
Plan A (scaffolding)
    ↓
Plan B (sheets.js)  ←→  Plan C (claude.js)   [paralelos]
    ↓                         ↓
Plan D (WhatsApp + Router — depende de B e C)
    ↓
Plan E (logger + rate limit)
```

## Definition of Done — Phase 1

- [ ] `npm start` exibe QR Code e conecta ao WhatsApp
- [ ] Mensagem "Hola" recebe resposta em espanhol em < 5s
- [ ] Mensagem "Olá" recebe resposta em português
- [ ] Histórico de 5+ turnos mantém coerência
- [ ] "quiero un humano" → encaminhamento adequado
- [ ] Dados do Google Sheets acessíveis via `sheets.js`
- [ ] Logs estruturados funcionando
- [ ] Rate limiting ativo
- [ ] Zero secrets no git (`.env` ignorado)
