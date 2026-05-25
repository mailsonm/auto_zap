# STATE.md — Auto Zap (ARIA)

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21)

**Core value:** Todo cliente que manda mensagem recebe uma resposta útil em segundos — seja consulta de produto, FAQ ou encaminhamento para humano.
**Current focus:** Phase 1 — Fundação (OpenWA + Claude + Google Sheets)

## Current Status

**Phase:** 6 ⏳ INICIADA — Testes, Otimização & Documentação Final (Alinhamento de Contexto concluído)
**Mode:** YOLO
**Last action:** Finalizada a Fase 5 (Robustez & Deploy) e criados os arquivos de contexto da Fase 6

## Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 1 | Fundação — OpenWA + Claude + Google Sheets | ✅ Completa |
| 2 | Catálogo Inteligente & FAQ | ✅ Completa |
| 3 | Filiais, Serviços & Contexto Local | ✅ Completa |
| 4 | Registro de Leads & Histórico | ✅ Completa |
| 5 | Robustez, Rate Limiting & Deploy VPS | ✅ Completa |
| 6 | Testes, Otimização & Documentação Final | ⏳ Em andamento |

## Context for Next Session

- Phase 5 completa (Rate limits, mensagem humanizada, backoff, /health check e deploy documentado).
- Phase 6 alinhada (Decidido Jest 100% mockado, takeover híbrido no whatsapp + sheets e contratos de interface ERP).
- Leads são criados com protocolo exclusivo de 6 dígitos prefixados na coluna notas.
- Timeout (inatividade) e takeover limpam memória no Claude e consolidam histórico de conversas no Sheets.
- O smoke test da Fase 4 passou com sucesso offline (`node scratch/smoke_phase4.js`).

