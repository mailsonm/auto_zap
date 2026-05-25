# Plan 06-A — Configuração do Jest, Mocks & Testes de Handlers

**Phase:** 6 — Testes, Otimização & Documentação Final
**Plan:** 06-A
**Wave:** 1
**Status:** ⏳ Pending

---

## Objective

Configurar o framework de testes **Jest**, criar a estrutura de mocks para os módulos principais externos (whatsapp-web.js, Claude API, App Script/Sheets) e implementar testes de integração para validar a consistência das respostas de produtos, filiais, serviços e FAQs.

---

## Proposed Changes

### Configuration
#### [MODIFY] [package.json](file:///c:/Projectos/auto_zap/package.json)
- Adicionar `"type": "module"` (se ainda não configurado para ESM) e suporte ao Jest em ambiente ESM.
- Instalar dependências de desenvolvimento:
  - `jest`
  - `@types/jest` (opcional, para Intellisense)
- Adicionar script `"test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"` no `package.json` para permitir Jest rodar com módulos ES nativos.

### Test Environment & Mocks
#### [NEW] [jest.config.js](file:///c:/Projectos/auto_zap/jest.config.js)
- Configuração básica do Jest para ESM.

#### [NEW] [tests/mocks/whatsapp.js](file:///c:/Projectos/auto_zap/tests/mocks/whatsapp.js)
- Mock da classe `Client` de `whatsapp-web.js` para simular mensagens e chamadas a funções como `sendMessage` e `sendSeen`.

#### [NEW] [tests/mocks/claude.js](file:///c:/Projectos/auto_zap/tests/mocks/claude.js)
- Mock para a Claude API (`@anthropic-ai/sdk`), permitindo predefinir respostas e analisar os prompts enviados pela persona ARIA.

#### [NEW] [tests/mocks/sheets.js](file:///c:/Projectos/auto_zap/tests/mocks/sheets.js)
- Mock do cliente HTTP do Google Sheets / App Script, retornando dados sintéticos controlados das planilhas de estoque, filiais, FAQs e serviços.

### Handlers Integration Tests
#### [NEW] [tests/integration/products.test.js](file:///c:/Projectos/auto_zap/tests/integration/products.test.js)
- Validar se a consulta de produtos por nome e categoria retorna a resposta estruturada com preços corretos em PYG e BRL.
- Testar comportamento com produtos que requerem receita.
- Testar cenários de produtos sem estoque ou inexistentes.

#### [NEW] [tests/integration/faq.test.js](file:///c:/Projectos/auto_zap/tests/integration/faq.test.js)
- Testar busca de FAQs por similaridade semântica/tags.
- Validar se a resposta passa pelo Claude para ser reescrita de forma natural.

#### [NEW] [tests/integration/branches.test.js](file:///c:/Projectos/auto_zap/tests/integration/branches.test.js)
- Validar se perguntas sobre filiais retornam o formato de texto correto com horários e telefones.

---

## Verification & Acceptance Criteria

- **Execução dos Testes:** `npm run test` roda todos os arquivos sob a pasta `tests/` e reporta sucesso sem falhas.
- **Isolamento Completo:** A execução dos testes não deve tentar abrir navegadores de Puppeteer (whatsapp-web.js) nem fazer chamadas HTTP de verdade para a Meta, Anthropic ou Google.
