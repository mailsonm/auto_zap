# Guia Operacional — Atendimento Híbrido com Samantha

Este guia detalha como os atendentes humanos e a assistente virtual **Samantha** interagem no dia a dia para garantir um atendimento contínuo, rápido e sem conflitos de mensagens.

---

## 1. O Fluxo de Transição Humana (Takeover)

Samantha atende todos os clientes automaticamente. No entanto, o sistema foi desenhado para dar **prioridade total** ao atendente humano quando houver necessidade de intervenção.

A transição ocorre de duas maneiras:
1. **Solicitação do Cliente:** Quando o cliente escreve termos como *"falar com atendente"*, *"preciso de uma pessoa"* ou similares, o bot avisa o cliente que está chamando um atendente e silencia-se imediatamente.
2. **Intervenção Manual (WhatsApp Web/Celular):** Se você enviar **qualquer mensagem manual** no chat com o cliente (seja pelo WhatsApp Web, celular da empresa ou outro dispositivo conectado), o bot detecta o envio do atendente (`fromMe = true`), entra em pausa imediatamente para aquele contato e envia o status de pausa para o Google Sheets.

---

## 2. A Pausa Automática (Cooldown de 30 minutos)

* **Tempo de Silêncio:** Quando a pausa é ativada por intervenção humana (manual ou por pedido do cliente), o bot silencia-se por **30 minutos** (configurado no `.env` pela variável `HUMAN_TAKEOVER_COOLDOWN_MIN`).
* **Expiração:** Após 30 minutos sem nenhuma nova mensagem humana no chat, o bot assume novamente o atendimento automático caso o cliente envie alguma mensagem.
* **Renovação:** Cada nova mensagem que você enviar no chat renova o tempo de silêncio por mais 30 minutos.

---

## 3. Painel Administrativo no Google Sheets

Para controle total do bot de forma independente, foi criada uma aba chamada **`controle`** na sua planilha do Google Sheets.

Essa aba permite que você gerencie o status do bot para cada cliente a qualquer momento:

| Status na Planilha | Significado para o Bot | Ação Recomendada |
| :--- | :--- | :--- |
| **`Ativo`** | O bot está ativo para responder o cliente imediatamente. | Use para destravar o bot antes dos 30 minutos de pausa se o atendimento já foi concluído. |
| **`Pausado (Humano)`** | O bot está pausado para que o humano atenda (cooldown de 30 min ativo). | Status inserido automaticamente quando você digita no chat ou o cliente pede humano. |
| **`Inativo`** | O bot está desligado para este contato por tempo indeterminado. | Use quando o caso é complexo e você quer garantir que o bot nunca mais responda essa pessoa. |

### Como reativar o bot antes do tempo?
Se você terminou de atender o cliente e quer que a Samantha volte a responder as mensagens dele imediatamente:
1. Abra a planilha do Google Sheets na aba **`controle`**.
2. Localize a linha correspondente ao telefone do cliente.
3. Altere a coluna **`status`** para **`Ativo`**.
4. O bot lerá essa alteração e voltará a responder automaticamente na próxima mensagem que o cliente enviar.

---

## 4. Melhores Práticas de Operação

* **Deixe o bot saudar o cliente:** Evite responder conversas recém-iniciadas antes de o bot entender a necessidade básica do cliente (como a busca de um produto).
* **Use o Sheets para auditoria:** Monitore as abas `leads` e `historico` para visualizar os clientes que demonstraram intenção real de compra e o protocolo gerado, permitindo contato ativo de pós-venda.
