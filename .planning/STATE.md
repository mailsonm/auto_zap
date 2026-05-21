# STATE.md — Auto Zap (ARIA)

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21)

**Core value:** Todo cliente que manda mensagem recebe uma resposta útil em segundos — seja consulta de produto, FAQ ou encaminhamento para humano.
**Current focus:** Phase 1 — Fundação (OpenWA + Claude + Google Sheets)

## Current Status

**Phase:** 1 ✅ COMPLETA — Fundação implementada e commitada
**Mode:** YOLO
**Last action:** Phase 1 executada — 15 arquivos criados, 0 erros de sintaxe

## Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 1 | Fundação — OpenWA + Claude + Google Sheets | ✅ Completa |
| 2 | Catálogo Inteligente & FAQ | ⏳ Not started |
| 3 | Filiais, Serviços & Contexto Local | ⏳ Not started |
| 4 | Registro de Leads & Histórico | ⏳ Not started |
| 5 | Robustez, Rate Limiting & Deploy VPS | ⏳ Not started |
| 6 | Testes, Otimização & Documentação Final | ⏳ Not started |

## Context for Next Session

- Phase 1 completa — próximo: `/gsd-execute-phase 2`
- Antes de rodar: copiar `.env.example` → `.env` e preencher `ANTHROPIC_API_KEY` e `GOOGLE_SHEETS_SCRIPT_URL`
- Para testar: `npm start` (exibe QR Code no terminal)
- Google Sheets App Script URL: `https://script.google.com/macros/s/AKfycbxsyIkg8pdFutoCO6KlXqCPFM-LqSPwtn4EpG6yX63k02Ui5qi4E_b_wL_oWIjedLoS/exec`
- OpenWA reference: `https://github.com/rmyndharis/OpenWA`
- Claude API key: available in developer's env
- Hosting: Local dev → Hostinger VPS (PM2 + Node.js)
