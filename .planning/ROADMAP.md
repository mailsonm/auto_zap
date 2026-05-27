# ROADMAP.md — Auto Zap (ARIA)

## Project: Auto Zap — ARIA WhatsApp Bot
**Total Phases:** 3 | **Total Requirements:** 9 | **Coverage:** 100% ✓

---

## Milestone 1 (v1.0) — ✅ COMPLETA
* **Milestone 1:** [Fundação, Catálogo, FAQ, Filiais, Leads & Robustez](file:///.planning/milestones/v1.0-ROADMAP.md) — Concluída em 2026-05-26.

---

## Milestone 2 (v2.0) — ⏳ ATIVO
**Goal:** Expandir os canais de atendimento integrando mensagens diretas (DMs) do Instagram, mantendo a mesma inteligência, controle de takeover humano e sincronização com o Google Sheets.

### Phase 7: Webhook & Validação Meta
**Goal:** Endpoint Express operacional exposto para a internet que valida o token de webhook da Meta e recebe eventos de mensagens de texto recebidas no Instagram.
**Mode:** standard

**Requirements Mapped:** INSTA-01, INSTA-02

**Success Criteria:**
1. Rota GET `/webhook/instagram` responde com o desafio `hub.challenge` quando validada com o token correto definido no `.env`.
2. Rota POST `/webhook/instagram` recebe payloads de mensagens do Instagram, valida a assinatura e extrai remetente, destinatário e texto da mensagem.
3. Logs estruturados no console ao receber mensagens do Instagram (sem processamento ou resposta ainda).

**Deliverables:**
- `src/handlers/instagramWebhook.js` — controlador do webhook da Meta.
- `src/middleware/metaSignature.js` — validador de assinatura SHA256 dos payloads da Meta.

---

### Phase 8: Resposta & Envio Graph API
**Goal:** Enviar respostas automatizadas usando a API de Envio da Meta, gerenciar credenciais seguras e interceptar o envio manual para pausar o bot (takeover).
**Mode:** standard

**Requirements Mapped:** INSTA-03, INSTA-06, INSTA-07

**Success Criteria:**
1. Chamada à API de Envio da Meta (`https://graph.facebook.com/v19.0/me/messages`) responde com sucesso ao enviar DMs.
2. Todas as mensagens enviadas pela Samantha no Instagram contêm o caractere invisível `\u200B`.
3. Webhook detecta mensagens enviadas pelo próprio número de página da empresa e ativa o human takeover para o contato do Instagram no Sheets e na sessão local.
4. Mensagens manuais enviadas pelo operador pausam o bot por 30 minutos (mesmo comportamento do WhatsApp).

**Deliverables:**
- `src/services/instagram.js` — cliente da Meta Graph API (Send Message).
- Atualização em `src/index.js` para escutar e integrar os webhooks.

---

### Phase 9: Sessão & Roteamento Unificado
**Goal:** Unificar o roteador principal do bot para tratar indistintamente WhatsApp e Instagram, salvando leads e históricos na mesma planilha do Sheets.
**Mode:** standard

**Requirements Mapped:** INSTA-04, INSTA-05, INSTA-08, INSTA-09

**Success Criteria:**
1. Sessões do Instagram criadas sob a chave `insta:<id>` mantêm histórico das últimas 20 mensagens em português, espanhol ou inglês.
2. Testes de integração Jest para validar o comportamento de roteamento de DMs do Instagram.
3. Registro de leads do Instagram na mesma planilha, preenchendo a coluna Notas com `[Instagram] [Protocolo: XXXXXX]`.
4. Registro de histórico com desfechos e turnos das conversas do Instagram no Sheets.

**Deliverables:**
- Atualização em `src/handlers/router.js` para suportar canais dinâmicos.
- `tests/integration/instagram.test.js` — testes de integração do canal Instagram.
- Atualização no `README.md` com guia de configuração Meta API.

---

## Milestones Futuras (Adiadas)
* **Milestone 3:** Painel Web de Controle Operacional (Frontend).
* **Milestone 4:** Integração ERP Century e/ou Odoo 19.
* **Milestone 5:** Multi-instância WhatsApp (um número para cada filial).
