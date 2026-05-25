# Plan 06-B — Takeover Híbrido Bidirecional (WhatsApp + Sheets)

**Phase:** 6 — Testes, Otimização & Documentação Final
**Plan:** 06-B
**Wave:** 2
**Status:** ⏳ Pending

---

## Objective

Implementar o mecanismo de takeover que detecta quando o atendente humano interage pelo aplicativo do WhatsApp (Web ou celular), ativando a pausa automática do bot com envio do status para o Sheets, e integrando a capacidade de reativação ou pausa indefinida diretamente pela planilha do Google Sheets.

---

## Proposed Changes

### Configuration
#### [MODIFY] [.env.example](file:///c:/Projectos/auto_zap/.env.example) e `.env`
- Adicionar a variável `HUMAN_TAKEOVER_COOLDOWN_MIN=30` para configurar o tempo padrão de silenciamento automático do bot.

### Core Logic & State Management
#### [MODIFY] [src/session.js](file:///c:/Projectos/auto_zap/src/session.js) ou `src/claude.js`
- Adicionar suporte para salvar e verificar o timestamp da pausa (`takeoverTime`).
- Implementar função `isTakeoverActive(phone)` que:
  1. Verifica se `session.takeover` é true e se o cooldown de 30 minutos ainda está ativo.
  2. Expira o takeover se passar dos 30 minutos, voltando a responder automaticamente.
- Implementar lógica de controle via Sheets:
  - Adicionar suporte a um cache leve das configurações de controle de conversas lidas do Sheets (para evitar ler o Sheets a cada mensagem).
  - Ou validar o status de controle lido da API do Sheets sob demanda.

### Event Interception
#### [MODIFY] [src/index.js](file:///c:/Projectos/auto_zap/src/index.js)
- Escutar o evento `message_create` no OpenWA (`whatsapp-web.js`):
  ```javascript
  client.on('message_create', async (msg) => {
      if (msg.fromMe) {
          // O atendente humano enviou uma mensagem manualmente
          const phone = msg.to.replace('@c.us', '');
          activateHumanTakeover(phone);
      }
  });
  ```
- Criar a função `activateHumanTakeover(phone)` que:
  1. Define `session.takeover = true` e o timestamp atual na sessão.
  2. Envia a chamada ao App Script do Sheets atualizando o status da conversa com aquele número para `"Pausado (Humano)"` com o timestamp.

### Sheets Integration
#### [MODIFY] [src/sheets.js](file:///c:/Projectos/auto_zap/src/sheets.js)
- Adicionar ou expandir o endpoint do App Script / rotas locais de gravação para aceitar atualizações de status da sessão (coluna "Status do Bot" ou "Controle Bot").
- Criar função `updateBotStatusInSheets(phone, status)` para sincronizar o status.
- Criar função `fetchBotControlStatus(phone)` para ler o estado definido na coluna de controle no Sheets.

---

## Verification & Acceptance Criteria

- **Intervenção Automática:** Mandar uma mensagem do próprio número via WhatsApp simula a intervenção humana. A sessão do contato correspondente deve ter `takeover = true` e o cooldown de 30 min ativado.
- **Sincronização com o Sheets:** O status `"Pausado (Humano)"` deve ser enviado para o Google Sheets para que o gestor saiba que o atendente está falando com o cliente.
- **Painel no Sheets:** Alterar o status do contato na planilha do Google Sheets para `"Ativo"` deve limpar a flag `takeover` do bot imediatamente ou no próximo contato do cliente, fazendo o bot voltar a responder de forma automática.
