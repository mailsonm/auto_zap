# REQUIREMENTS.md — Auto Zap (ARIA) — Milestone 2 (v2.0)

## v2 Requirements — Integração Instagram DMs

### INSTA — Canal Instagram & Webhooks

- [ ] **INSTA-01**: Endpoint Express (`/webhook/instagram` via GET) para validação de token da Meta (Meta Webhook verification).
- [ ] **INSTA-02**: Endpoint Express (`/webhook/instagram` via POST) para recebimento de mensagens de texto de Direct Messages (DMs).
- [ ] **INSTA-03**: Envio de respostas automáticas ao cliente usando a API de Envio da Meta (Instagram Send API).
- [ ] **INSTA-04**: Suporte a múltiplos idiomas (ES/PT/EN) em tempo real nas DMs do Instagram, utilizando o roteador existente.
- [ ] **INSTA-05**: Gestão de histórico e sessão em memória sob formato de chave unificada `insta:<instagram_user_id>`.
- [ ] **INSTA-06**: Proteção contra auto-takeover inserindo caractere invisível `\u200B` no final das DMs enviadas pela Samantha.
- [ ] **INSTA-07**: Pausa automática (human takeover) da IA no Instagram ao detectar que o operador humano enviou uma mensagem manual (capturado via Webhook da Meta onde o sender é o próprio ID da Página).
- [ ] **INSTA-08**: Gravação de Leads no Google Sheets identificando a origem do canal como "Instagram".
- [ ] **INSTA-09**: Gravação de Histórico consolidado de conversas do Instagram no Google Sheets ao encerrar a sessão.

---

## Traceability

| REQ-ID | Phase |
|--------|-------|
| INSTA-01, INSTA-02 | Phase 7 — Webhook & Validação Meta |
| INSTA-03, INSTA-06 | Phase 8 — Resposta & Envio Graph API |
| INSTA-04, INSTA-05 | Phase 9 — Sessão & Roteamento Unificado |
| INSTA-07 | Phase 8 — Resposta & Envio Graph API |
| INSTA-08, INSTA-09 | Phase 9 — Sessão & Roteamento Unificado |
