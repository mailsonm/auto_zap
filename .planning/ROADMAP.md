# ROADMAP.md — Auto Zap (ARIA)

## Project: Auto Zap — ARIA WhatsApp Bot
**Total Phases:** 6 | **Total Requirements:** 17 | **Coverage:** 100% ✓

---

### Phase 1: Fundação — OpenWA + Claude + Google Sheets
**Goal:** Servidor Node.js funcional com WhatsApp conectado, Claude API integrada e acesso aos dados do Google Sheets via App Script. ARIA responde mensagens básicas de forma coerente.
**Mode:** mvp

**Requirements Mapped:** CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06

**Success Criteria:**
1. QR Code gerado e WhatsApp conectado com reconexão automática
2. Mensagem enviada ao WhatsApp recebe resposta da ARIA em menos de 5 segundos
3. ARIA detecta e responde em ES/PT/EN baseado no idioma do cliente
4. ARIA mantém contexto coerente em conversa de 5+ turnos
5. Quando cliente escreve "falar com atendente", bot notifica e encerra atendimento automático
6. Dados da planilha (sistema/empresa) são acessíveis pelo servidor Node.js via App Script

**Deliverables:**
- `src/index.js` — servidor OpenWA principal
- `src/claude.js` — cliente Claude API com gerenciamento de histórico
- `src/sheets.js` — cliente App Script (GET/POST)
- `src/aria.js` — persona/prompt do sistema ARIA
- `.env.example` — variáveis de ambiente documentadas
- `README.md` — instruções de setup e execução

---

### Phase 2: Catálogo Inteligente & FAQ
**Goal:** ARIA consulta produtos, preços, disponibilidade e responde perguntas frequentes de forma natural e contextualizada.
**Mode:** mvp

**Requirements Mapped:** PROD-01, PROD-02, PROD-03, FAQ-01, FAQ-02

**Success Criteria:**
1. Cliente pergunta "tem paracetamol?" e ARIA retorna nome, preço PYG/R$, disponibilidade e notas
2. Cliente pergunta "quais remédios para dor de cabeça?" e ARIA lista produtos da categoria relevante
3. ARIA informa quando produto requer receita médica
4. Cliente faz pergunta frequente (ex: "aceitam cartão?") e ARIA responde usando a base de FAQs
5. Resposta do FAQ é contextualizada pelo Claude — não é texto copiado literalmente
6. Busca por produto inexistente retorna mensagem útil (sugestão de categoria, oferecer humano)

**Deliverables:**
- `src/handlers/products.js` — handler de consulta de produtos
- `src/handlers/faq.js` — handler de busca e resposta de FAQ
- `src/tools/search.js` — lógica de busca semântica/fuzzy nos dados do Sheets

---

### Phase 3: Filiais, Serviços & Contexto Local
**Goal:** ARIA informa sobre filiais (localização, horário, contato) e serviços disponíveis, guiando o cliente para a filial mais relevante.
**Mode:** mvp

**Requirements Mapped:** SUC-01, SUC-02, SVC-01

**Success Criteria:**
1. Cliente pergunta "onde fica a farmácia?" e ARIA lista filiais com endereço e horário
2. Cliente menciona bairro/cidade e ARIA sugere filial mais próxima (se dados disponíveis)
3. ARIA informa quais filiais aceitam WhatsApp para pedidos
4. Cliente pergunta sobre serviço específico e ARIA retorna descrição, preço e requisitos
5. ARIA formata endereços e horários de forma legível no WhatsApp (sem tabelas, sem markdown)

**Deliverables:**
- `src/handlers/branches.js` — handler de consulta de filiais
- `src/handlers/services.js` — handler de consulta de serviços

---

### Phase 4: Registro de Leads & Histórico
**Goal:** ARIA registra leads qualificados e mantém histórico de conversas, permitindo acompanhamento humano pós-atendimento.
**Mode:** mvp

**Requirements Mapped:** LEAD-01, LEAD-02, HIST-01

**Success Criteria:**
1. Quando cliente demonstra intenção de compra, ARIA coleta nome e confirma o produto de interesse
2. Lead é registrado no Google Sheets com telefone, nome, produto, data/hora
3. ARIA confirma registro ao cliente com mensagem amigável ("Registrei seu interesse! Nossa equipe entrará em contato 😊")
4. Ao final de cada conversa (timeout ou encerramento), resumo é salvo no Sheets
5. Histórico inclui: número, data/hora início, idioma detectado, tópicos abordados, desfecho

**Deliverables:**
- `src/handlers/leads.js` — handler de qualificação e registro de leads
- `src/handlers/history.js` — gerenciamento de histórico de conversas
- `src/session.js` — gerenciamento de sessões por número de telefone

---

### Phase 5: Robustez, Rate Limiting & Deploy VPS
**Goal:** Sistema pronto para produção — tratamento de erros, rate limiting, logging estruturado e deploy na VPS Hostinger com PM2.
**Mode:** standard

**Requirements Mapped:** (Infraestrutura — suporta todos os REQ-IDs anteriores)

**Success Criteria:**
1. Bot não cai com mensagens malformadas ou em idioma inesperado
2. Rate limiting previne spam — máximo N mensagens por usuário por minuto
3. Logs estruturados (winston/pino) com nível INFO/ERROR para diagnóstico
4. PM2 reinicia o processo automaticamente após crash
5. Variáveis sensíveis (API keys) em `.env` nunca comitadas no git
6. QR Code re-exibido automaticamente após queda de conexão WhatsApp
7. Guia de deploy documentado para VPS Hostinger (Linux + Node.js + PM2)

**Deliverables:**
- `src/middleware/rateLimit.js` — rate limiting por número
- `src/logger.js` — logging estruturado
- `ecosystem.config.js` — configuração PM2
- `docs/DEPLOY.md` — guia de deploy VPS Hostinger
- `.gitignore` — excluir `.env`, `session/`, logs

---

### Phase 6: Testes, Otimização & Documentação Final
**Goal:** Suite de testes de integração, otimização de prompts ARIA e documentação completa para handoff e onboarding de novos atendentes/devs.
**Mode:** standard

**Requirements Mapped:** (Qualidade — cobre todos os REQ-IDs)

**Success Criteria:**
1. Testes de integração para handlers principais (produto, FAQ, filial, lead)
2. Prompt do ARIA refinado com base em conversas reais de teste
3. Tempo médio de resposta < 4 segundos em condições normais
4. `README.md` completo com setup, configuração e troubleshooting
5. Guia de operação para atendente humano (como assumir conversa do bot)
6. Checklist de migração para futura integração ERP documentado

**Deliverables:**
- `tests/` — suite de testes (Jest ou similar)
- `docs/PROMPTS.md` — histórico e racional das versões do prompt ARIA
- `docs/OPERATIONS.md` — guia operacional para atendentes
- `docs/ERP-INTEGRATION.md` — checklist de migração para Odoo/Century

---

## Milestone 2 (Planejado — Pós MVP)

**Goal:** Integração com ERP Century e/ou Odoo 19, substituindo Google Sheets como fonte de dados.

Fases futuras:
- Phase 7: Integração Century ERP (estoque, pedidos)
- Phase 8: Integração Odoo 19 (CRM, cotações, faturamento)
- Phase 9: Multi-instância WhatsApp (1 número por filial)
- Phase 10: Dashboard de métricas de atendimento
