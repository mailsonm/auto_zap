# Auto Zap — ARIA

## What This Is

ARIA é um bot de atendimento ao cliente via WhatsApp, alimentado por IA (atualmente utilizando OpenAI GPT-4o-mini), desenvolvido para lojas de varejo/e-commerce com operação trilíngue (Espanhol/PY principal, Português, Inglês). No MVP (Milestone 1), usa Google Sheets como base de dados. O sistema é construído sobre OpenWA (whatsapp-web.js) + Node.js e escala de 1 número para até 15 filiais independentes.

## Core Value

**Todo cliente que manda mensagem recebe uma resposta útil em segundos** — seja uma consulta de produto, verificação de estoque, FAQ ou encaminhamento para humano.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

**Integração WhatsApp / Motor de Mensagens (Milestone 1)**
- [x] CORE-01: Bot recebe mensagens de clientes via WhatsApp e responde automaticamente (Validação: Phase 1)
- [x] CORE-02: Bot detecta o idioma do cliente e responde no mesmo idioma (ES/PT/EN) (Validação: Phase 1 & Phase 6)
- [x] CORE-03: Bot mantém contexto da conversa por sessão (histórico de mensagens recentes) (Validação: Phase 1)
- [x] CORE-04: Bot encaminha para atendente humano quando não sabe responder ou cliente solicita (Validação: Phase 1 & Phase 6)
- [x] CORE-05: Identidade ARIA configurável — nome, personalidade, empresa representada, regras de negócio (Validação: Phase 1)
- [x] CORE-06: QR Code de autenticação do WhatsApp com reconexão automática (Validação: Phase 1)

**Catálogo & Estoque (Google Sheets) (Milestone 1)**
- [x] PROD-01: Cliente pode consultar produtos por nome, SKU ou categoria (Validação: Phase 2)
- [x] PROD-02: Cliente pode verificar preço (PYG e R$ automático) e disponibilidade de estoque (Validação: Phase 2)
- [x] PROD-03: Bot informa restrições do produto (requiere receta, notas especiais) (Validação: Phase 2)

**Filiais & Serviços (Milestone 1)**
- [x] SUC-01: Cliente pode perguntar sobre filiais (endereço, horário, telefone, WhatsApp) (Validação: Phase 3)
- [x] SUC-02: Bot lista filiais disponíveis quando cliente pergunta sobre localização geral (Validação: Phase 3)
- [x] SVC-01: Cliente pode consultar serviços disponíveis (preço, duração, requisitos) (Validação: Phase 3)

**FAQ (Milestone 1)**
- [x] FAQ-01: Bot responde perguntas frequentes com busca por tags e similaridade semântica (Validação: Phase 2)
- [x] FAQ-02: Respostas do FAQ são naturais e contextualizadas (não copia/cola robótico) (Validação: Phase 2)

**Registro de Leads / Pedidos (Milestone 1)**
- [x] LEAD-01: Bot registra interesse do cliente (nome, contato, produto/serviço desejado) no Google Sheets (Validação: Phase 4)
- [x] LEAD-02: Bot confirma o registro ao cliente com número de protocolo (Validação: Phase 4)

**Histórico (Milestone 1)**
- [x] HIST-01: Cada conversa é registrada (telefone, data/hora, resumo) para consulta posterior (Validação: Phase 4)

### Active

<!-- Current scope. Building toward these. -->

**Canal Instagram & Webhooks (Milestone 2)**
- [ ] INSTA-01: Endpoint Express (`/webhook/instagram` via GET) para validação de token da Meta.
- [ ] INSTA-02: Endpoint Express (`/webhook/instagram` via POST) para recebimento de mensagens de texto de Direct Messages.
- [ ] INSTA-03: Envio de respostas automáticas ao cliente usando a API de Envio da Meta.
- [ ] INSTA-04: Suporte a múltiplos idiomas (ES/PT/EN) em tempo real nas DMs do Instagram.
- [ ] INSTA-05: Gestão de histórico e sessão em memória sob formato de chave unificada `insta:<instagram_user_id>`.
- [ ] INSTA-06: Proteção contra auto-takeover inserindo caractere invisível `\u200B` no final das DMs.
- [ ] INSTA-07: Pausa automática (human takeover) da IA no Instagram ao detectar que o operador respondeu manualmente.
- [ ] INSTA-08: Gravação de Leads no Google Sheets identificando a origem do canal como "Instagram".
- [ ] INSTA-09: Gravação de Histórico consolidado de conversas do Instagram no Google Sheets.

### Out of Scope

- Pagamentos / checkout — requer integração bancária complexa, fase futura
- Múltiplos números simultâneos — MVP usa 1 número; escala para múltiplos na v2
- Integração oficial Meta API — usar OpenWA para menor burocracia e custo no MVP

## Context

- **Google Sheets criado**: `https://docs.google.com/spreadsheets/d/1y9XcIu776zaP_2Q5iBo8OlCkK-VnD4a2FjBVAAXjs4w/`
- **App Script publicado**: `https://script.google.com/macros/s/AKfycbxsyIkg8pdFutoCO6KlXqCPFM-LqSPwtn4EpG6yX63k02Ui5qi4E_b_wL_oWIjedLoS/exec`
- **Referência OpenWA**: `https://github.com/rmyndharis/OpenWA` (Node.js, whatsapp-web.js wrapper, self-hosted)
- **OpenAI API Key**: Ativa (modelo gpt-4o-mini para ótimo custo/velocidade em produção)
- **Estrutura de dados Google Sheets**:
  - `sistema`: dados gerais da empresa
  - `productos`: sku, nombre, presentacion, precio_pyg, precio_brl, requiere_receta, categoria, disponible, notas, ultima_actualizacion
  - `sucursales`: id, nombre_ubicacion, direccion, horario, telefono, acepta_whatsapp, notas
  - `faqs`: id, pregunta, respuesta, tags
  - `serviços`: id, servicio, descripcion, precio_pyg, precio_brl, requisitos, duracion_modalidad
- **Operação atual**: 1 WhatsApp para testes/produção rodando com PM2 e monitoramento local.
- **Hospedagem**: VPS Hostinger (Linux + Node.js + PM2).

## Constraints

- **Tech Stack**: Node.js + OpenWA (whatsapp-web.js).
- **Base de Dados MVP**: Google Sheets via App Script middleware.
- **LLM**: OpenAI API (gpt-4o-mini) — rápida e econômica.
- **Idioma primário**: Espanhol/PY — respostas em espanhol por padrão a menos que cliente fale em outro idioma.
- **Deploy**: Gerenciado via PM2 na VPS Hostinger.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| OpenWA (whatsapp-web.js) em vez de API oficial Meta | Sem custo de licença para MVP, setup mais rápido, ideal para teste | ✅ Validated |
| Google Sheets como banco de dados MVP | Já existente, sem overhead de DB, stakeholders podem editar diretamente | ✅ Validated |
| Uso da API da OpenAI (gpt-4o-mini) em vez do Claude | Excelente custo-benefício, maior velocidade de resposta e compatibilidade perfeita | ✅ Validated |
| App Script como middleware HTTP | Evita compartilhar credenciais Google diretamente com a VPS, já publicado como web app | ✅ Validated |
| Bot Samantha com Caractere Invisível para Prevenção de Loops | Uso de `\u200B` no envio de mensagens do bot para evitar que mensagens automáticas ativem o takeover humano | ✅ Validated |

---
*Last updated: 2026-05-26 after completing Milestone 1*
