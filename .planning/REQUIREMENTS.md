# REQUIREMENTS.md — Auto Zap (ARIA)

## v1 Requirements

### CORE — Motor de Mensagens & IA

- [ ] **CORE-01**: Bot recebe mensagens de clientes via WhatsApp e envia respostas automáticas usando Claude API
- [ ] **CORE-02**: Bot detecta idioma da mensagem (ES/PT/EN) e responde no mesmo idioma de forma natural
- [ ] **CORE-03**: Bot mantém contexto de conversa por sessão — histórico das últimas N mensagens para respostas coerentes
- [ ] **CORE-04**: Bot encaminha conversa para atendente humano quando não sabe responder ou quando cliente solicita explicitamente
- [ ] **CORE-05**: Identidade ARIA configurável — nome, personalidade, empresa representada, regras de negócio
- [ ] **CORE-06**: QR Code de autenticação WhatsApp com reconexão automática em caso de queda

### PROD — Catálogo & Estoque

- [ ] **PROD-01**: Cliente pode consultar produtos por nome, SKU ou categoria — bot busca no Google Sheets e responde com detalhes
- [ ] **PROD-02**: Cliente recebe preço em PYG e R$ (automático) e status de disponibilidade do produto consultado
- [ ] **PROD-03**: Bot informa restrições do produto (requiere receta, notas especiais) quando relevante

### SUC — Filiais

- [ ] **SUC-01**: Cliente pode perguntar sobre filiais — bot retorna endereço, horário, telefone e se aceita WhatsApp
- [ ] **SUC-02**: Bot lista filiais disponíveis quando cliente pergunta sobre localização geral

### SVC — Serviços

- [ ] **SVC-01**: Cliente pode consultar serviços disponíveis — bot retorna descrição, preço (PYG/R$), requisitos e duração/modalidade

### FAQ — Perguntas Frequentes

- [ ] **FAQ-01**: Bot busca perguntas frequentes por tags e similaridade semântica com a pergunta do cliente
- [ ] **FAQ-02**: Respostas do FAQ são contextualizadas pelo Claude — não são cópia/cola robótico

### LEAD — Registro de Interesse

- [ ] **LEAD-01**: Bot registra interesse do cliente (nome, telefone, produto/serviço, data) no Google Sheets quando cliente demonstra intenção de compra
- [ ] **LEAD-02**: Bot confirma o registro ao cliente com mensagem de confirmação

### HIST — Histórico de Conversas

- [ ] **HIST-01**: Cada conversa finalizada é registrada no Google Sheets (telefone, data/hora, resumo do atendimento)

---

## v2 Requirements (Deferred)

- Dashboard web de administração para visualizar métricas de atendimento
- Múltiplos números WhatsApp simultâneos (multi-instância por filial)
- Integração ERP Century — estoque e pedidos em tempo real
- Integração Odoo 19 — CRM, pedidos, faturamento
- Relatórios automáticos (diários/semanais) por WhatsApp para gestor
- Agendamento de serviços integrado ao bot
- Respostas com mídia (imagens de produtos, PDFs)
- Sistema de avaliação pós-atendimento (NPS via WhatsApp)

---

## Out of Scope

- Pagamentos / checkout — requer integração bancária, fase futura
- WhatsApp Business API oficial (Meta) — OpenWA para MVP sem custo de licença
- Banco de dados próprio (PostgreSQL, MongoDB) — Google Sheets no MVP
- Interface de usuário web admin — planilha Google Sheets é suficiente para MVP
- Suporte a grupos WhatsApp — somente conversas individuais (1:1)
- Envio de mensagens proativas em massa (broadcast) — risco de banimento no MVP

---

## Traceability

| REQ-ID | Phase |
|--------|-------|
| CORE-01 a CORE-06 | Phase 1 — Fundação (OpenWA + Claude + Sheets) |
| PROD-01 a PROD-03 | Phase 2 — Catálogo & Estoque |
| FAQ-01 a FAQ-02 | Phase 2 — FAQ Inteligente |
| SUC-01 a SUC-02 | Phase 3 — Filiais & Serviços |
| SVC-01 | Phase 3 — Filiais & Serviços |
| LEAD-01 a LEAD-02 | Phase 4 — Leads & Registro |
| HIST-01 | Phase 4 — Leads & Registro |
| ADMIN-01 a ADMIN-02 | Phase 1 — Fundação |
