# GEMINI.md — Auto Zap (ARIA)

## GSD Workflow Guidance

Este projeto usa o framework **Get Shit Done (GSD)** para planejamento e execução estruturada.

### Estrutura de Planejamento

```
.planning/
├── PROJECT.md        ← Contexto vivo do projeto (ler sempre primeiro)
├── REQUIREMENTS.md   ← Requisitos v1 com REQ-IDs
├── ROADMAP.md        ← 6 fases de execução
├── STATE.md          ← Estado atual e próximos passos
├── config.json       ← Configurações do workflow GSD
└── research/         ← Pesquisa de domínio (gerada em /gsd-plan-phase)
    └── phases/       ← Planos por fase (gerados em /gsd-plan-phase N)
```

### Regras do Workflow

1. **Sempre ler PROJECT.md antes de qualquer ação** — contém decisões e contexto que afetam implementação
2. **Não modificar REQUIREMENTS.md sem aprovação** — REQ-IDs são rastreados no roadmap
3. **Commits atômicos** — cada fase commita seus artefatos imediatamente
4. **Modo YOLO ativo** — execução autônoma aprovada pelo usuário

### Próximo Passo

```
/gsd-discuss-phase 1
```

Ou para pular direto ao plano:

```
/gsd-plan-phase 1
```

---

## Sobre o Projeto

**ARIA** é um bot de atendimento WhatsApp trilíngue (ES/PT/EN) para lojas de varejo/e-commerce.

**Stack MVP:**
- Node.js + OpenWA (whatsapp-web.js)
- Claude API (Anthropic) — inteligência e NLU
- Google Sheets via App Script — base de dados
- PM2 — process manager para VPS

**Roadmap resumido:**
1. Fundação (OpenWA + Claude + Sheets)
2. Catálogo & FAQ
3. Filiais & Serviços
4. Leads & Histórico
5. Robustez & Deploy VPS
6. Testes & Documentação
