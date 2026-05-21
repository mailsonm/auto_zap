# Auto Zap — ARIA

## What This Is

ARIA é um bot de atendimento ao cliente via WhatsApp, alimentado pela Claude API (Anthropic), desenvolvido para lojas de varejo/e-commerce com operação trilíngue (Espanhol/PY principal, Português, Inglês). No MVP, usa Google Sheets como base de dados; no futuro integrará com ERPs Century e Odoo 19. O sistema é construído sobre OpenWA (whatsapp-web.js) + Node.js e escala de 1 número para até 15 filiais independentes.

## Core Value

**Todo cliente que manda mensagem recebe uma resposta útil em segundos** — seja uma consulta de produto, verificação de estoque, FAQ ou encaminhamento para humano.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

**Integração WhatsApp / Motor de Mensagens**
- [ ] CORE-01: Bot recebe mensagens de clientes via WhatsApp e responde automaticamente
- [ ] CORE-02: Bot detecta o idioma do cliente e responde no mesmo idioma (ES/PT/EN)
- [ ] CORE-03: Bot mantém contexto da conversa por sessão (histórico de mensagens recentes)
- [ ] CORE-04: Bot encaminha para atendente humano quando não sabe responder ou cliente solicita

**Catálogo & Estoque (Google Sheets)**
- [ ] PROD-01: Cliente pode consultar produtos por nome, SKU ou categoria
- [ ] PROD-02: Cliente pode verificar preço (PYG e R$ automático) e disponibilidade de estoque
- [ ] PROD-03: Bot informa restrições do produto (requiere receta, notas especiais)

**Filiais & Serviços**
- [ ] SUC-01: Cliente pode perguntar sobre filiais (endereço, horário, telefone, WhatsApp)
- [ ] SVC-01: Cliente pode consultar serviços disponíveis (preço, duração, requisitos)

**FAQ**
- [ ] FAQ-01: Bot responde perguntas frequentes com busca por tags e similaridade semântica
- [ ] FAQ-02: Respostas do FAQ são naturais e contextualizadas (não copia/cola robótico)

**Registro de Leads / Pedidos**
- [ ] LEAD-01: Bot registra interesse do cliente (nome, contato, produto/serviço desejado) no Google Sheets
- [ ] LEAD-02: Bot confirma o registro ao cliente com número de protocolo

**Histórico**
- [ ] HIST-01: Cada conversa é registrada (telefone, data/hora, resumo) para consulta posterior

**Configuração & Administração**
- [ ] ADMIN-01: Sistema de prompt do ARIA configurável (personalidade, empresa, regras de negócio)
- [ ] ADMIN-02: QR Code de autenticação do WhatsApp com reconexão automática

### Out of Scope

- Pagamentos / checkout — requer integração bancária complexa, fase futura
- Dashboard web de administração — fora do MVP, interface será o próprio Google Sheets
- WhatsApp Business API oficial (Meta) — usar OpenWA para MVP, sem custo de licença
- Múltiplos números simultâneos — MVP usa 1 número; escala para múltiplos na v2
- Integração ERP (Century/Odoo 19) — planejada para milestone 2

## Context

- **Google Sheets já criado**: `https://docs.google.com/spreadsheets/d/1y9XcIu776zaP_2Q5iBo8OlCkK-VnD4a2FjBVAAXjs4w/`
- **App Script publicado**: `https://script.google.com/macros/s/AKfycbxsyIkg8pdFutoCO6KlXqCPFM-LqSPwtn4EpG6yX63k02Ui5qi4E_b_wL_oWIjedLoS/exec`
- **Referência OpenWA**: `https://github.com/rmyndharis/OpenWA` (Node.js, whatsapp-web.js wrapper, self-hosted)
- **Claude API Key**: disponível (modelo a definir — recomendado claude-3-5-haiku para custo/velocidade no MVP)
- **Estrutura de dados Google Sheets**:
  - `sistema`: dados gerais da empresa
  - `productos`: sku, nombre, presentacion, precio_pyg, precio_brl, requiere_receta, categoria, disponible, notas, ultima_actualizacion
  - `sucursales`: id, nombre_ubicacion, direccion, horario, telefono, acepta_whatsapp, notas
  - `faqs`: id, pregunta, respuesta, tags
  - `serviços`: id, servicio, descripcion, precio_pyg, precio_brl, requisitos, duracion_modalidad
- **Operação atual**: 1 WhatsApp para testes → migra para responsável → futuro: 1 por filial (até 15 lojas)
- **Hospedagem**: Dev local → VPS Hostinger (já existe, compartilhado com outras apps)
- **Mercado**: Paraguai + Brasil (trilíngue ES/PY principal, PT, EN)
- **Tom**: Informal, acolhedor, que cria vínculo ("Hola! 😊 ¿En qué te puedo ayudar hoy?")

## Constraints

- **Tech Stack**: Node.js + OpenWA (whatsapp-web.js) — não mudar para WhatsApp Business API oficial
- **Base de Dados MVP**: Google Sheets via App Script (já publicado) — sem banco de dados próprio no MVP
- **LLM**: Claude API (Anthropic) — chave disponível
- **Idioma primário**: Espanhol/PY — bot deve responder em espanhol por padrão a menos que cliente escreva em outro idioma
- **Escalabilidade**: Arquitetura deve permitir adicionar novos números WhatsApp sem refatoração
- **Deploy**: VPS Hostinger (Linux) — usar PM2 para gerenciar processo Node.js

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| OpenWA (whatsapp-web.js) em vez de API oficial Meta | Sem custo de licença para MVP, setup mais rápido, ideal para teste | — Pending |
| Google Sheets como banco de dados MVP | Já existente, sem overhead de DB, stakeholders podem editar diretamente | — Pending |
| Claude API para inteligência | Qualidade de resposta superior, suporte nativo a multilíngue, contexto longo | — Pending |
| App Script como middleware HTTP | Evita compartilhar credenciais Google, já publicado como web app | — Pending |
| Bot chamado ARIA | Nome escolhido pelo cliente | — Pending |

## Evolution

Este documento evolui a cada transição de fase e marco de milestone.

**Após cada transição de fase:**
1. Requisitos invalidados? → Mover para Out of Scope com razão
2. Requisitos validados? → Mover para Validated com referência da fase
3. Novos requisitos emergiram? → Adicionar em Active
4. Decisões para registrar? → Adicionar em Key Decisions
5. "What This Is" ainda preciso? → Atualizar se derivou

**Após cada milestone:**
1. Revisão completa de todas as seções
2. Core Value check — ainda é a prioridade certa?
3. Auditoria Out of Scope — razões ainda válidas?
4. Atualizar Context com estado atual

---
*Last updated: 2026-05-21 after initialization*
