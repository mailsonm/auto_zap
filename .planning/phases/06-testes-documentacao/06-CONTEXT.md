# Phase 6 Context — Testes, Otimização & Documentação Final

Este documento consolida as diretrizes e decisões bloqueadas para o planejamento e execução da Fase 6.

## Decisions Locked

### 1. Suite de Testes (UAT / Integração)
* **Framework:** **Jest**.
* **Estratégia:** 100% Mockado. Não haverá dependência de instâncias reais do WhatsApp Web conectadas para os testes automáticos.
* **Mocks Essenciais:**
  * Mockar a biblioteca `whatsapp-web.js` (mensagens recebidas/enviadas, status do cliente).
  * Mockar as chamadas para a Claude API (`src/claude.js`).
  * Mockar as chamadas para o Google Sheets / App Script (`src/sheets.js`).
* **Objetivo:** Garantir a cobertura dos fluxos de conversação principais (produtos, FAQ, filiais, criação de leads).

### 2. Controle de Intervenção Humana (Takeover Híbrido)
* **Mensagens Enviadas pelo Atendente (WhatsApp Web / Celular):**
  * O bot deve ouvir o evento de mensagens criadas (`message_create` no whatsapp-web.js) e verificar se `message.fromMe === true`.
  * Se for verdade, significa que o atendente respondeu manualmente. O bot ativa `session.takeover = true` imediatamente para aquele contato.
  * O bot dispara uma atualização para o Google Sheets na planilha de histórico/sessões alterando o status para `"Pausado (Humano)"` com o timestamp atual.
  * O bot entra em cooldown automático de **30 minutos** (tempo configurável no `.env` via `HUMAN_TAKEOVER_COOLDOWN_MIN=30`).
* **Controle Central via Google Sheets:**
  * O atendente ou gestor pode alterar o status de um contato ou controle geral no Sheets.
  * Se o status for alterado para `"Ativo"`, o bot limpa o takeover daquela sessão e volta a responder imediatamente.
  * Se for alterado para `"Inativo"`, o bot entra em pausa indeterminada para aquele usuário.
  * *Implementação do Polling/Leitura:* O bot lerá esse estado no Sheets durante o fluxo (ex: ao receber mensagem, ou verificando cache sincronizado) para saber se deve ou não responder.

### 3. Documentação Operacional (`docs/OPERATIONS.md`)
* Guiar o atendente sobre a dinâmica de takeover automático (responder pelo celular/web pausa o bot por 30 minutos).
* Explicar como reativar o bot antes do tempo através do Sheets.

### 4. Checklist de Integração ERP (`docs/ERP-INTEGRATION.md`)
* Foco conceitual e contratual. Sem desenvolvimento de código de integração ativa.
* Estabelecer o contrato de interfaces (entradas e saídas esperadas).
* Desenhar como refatorar e isolar as chamadas atuais do Google Sheets em uma camada clara de repositório (ex: `SheetsRepository` vs `ErpRepository` futuro) garantindo que a lógica dos handlers e Claude permaneça agnóstica.

---

## Research Needed

1. **Estrutura de Mocks do `whatsapp-web.js` com Jest:** Como simular eventos de mensagens recebidas e enviadas para testar o router e handlers de forma limpa.
2. **Ciclo de Atualização do Takeover Bidirecional:**
   * Garantir que a leitura do status da planilha não adicione latência excessiva a cada mensagem recebida (implementar em cache ou ler de forma eficiente).
   * Estrutura do evento `message_create` no `index.js` para interceptar `fromMe`.
