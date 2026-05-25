# Phase 6 — Discussion Log

**Phase:** 6 — Testes, Otimização & Documentação Final
**Date:** 2026-05-25
**Mode:** YOLO / Interactive

---

## Areas Discussed

### 1. Framework de Testes (`tests/`)

**Q: Qual deve ser o framework de testes configurado?**
- **Selected:** **Opção A (Jest)**. Utilizar Jest para testes unitários e de integração dos handlers e mocks de APIs (Claude e Google Sheets).

---

### 2. Testes com WhatsApp (`whatsapp-web.js`)

**Q: Como lidar com testes que dependem do WhatsApp real?**
- **Selected:** **Opção A (Mocks 100%)**. Testes unitários e de integração totalmente mockados (fakes de mensagens, Claude API e App Script). Sem dependência de dispositivo conectado nos testes automatizados.

---

### 3. Guia de Operação para Atendentes Humanos (`docs/OPERATIONS.md`)

**Q: Como detalhar a dinâmica de takeover (atendente assumindo conversa)?**
- **Selected: Dinâmica Híbrida Bidirecional.**
  - **Gatilho pelo WhatsApp Web/Celular (Intervenção Rápiva):**
    - O bot detecta mensagens enviadas pelo próprio número (`message.fromMe === true` ou similar).
    - Ativa imediatamente `session.takeover = true` e atualiza a coluna "Status do Bot" no Google Sheets para `"Pausado (Humano)"` com timestamp.
    - Cooldown automático de 30 minutos (configurável no `.env`), a menos que seja reativado.
  - **Controle pelo Google Sheets (Gestão e Painel):**
    - Coluna de controle na planilha permite mudar o status para `"Ativo"` (limpa takeover e volta a responder imediatamente) ou `"Inativo"` (silencia bot por tempo indeterminado).

---

### 4. Checklist de Migração para ERP (`docs/ERP-INTEGRATION.md`)

**Q: Qual o foco e escopo da documentação da migração para ERP?**
- **Selected:** **Opção A (Contrato de Interfaces)**. Focar em documentar o mapeamento conceitual de dados (Sheets → ERP) e desenhar a camada de abstração no código (ex: `SheetsRepository` vs `ErpRepository` futuro) para isolar a infraestrutura de dados da lógica de negócio. Sem desenvolvimento de código ERP agora.

---

## Deferred Ideas

- **Testes End-to-End (E2E) com WhatsApp Real:** Adiado para fases futuras se houver necessidade de automação total em CI/CD complexa.
