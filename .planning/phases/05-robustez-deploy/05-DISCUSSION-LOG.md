# Phase 5 — Discussion Log

**Phase:** 5 - Robustez, Rate Limiting & Deploy VPS
**Date:** 2026-05-22
**Mode:** Interactive (default)

---

## Areas Discussed

### 1. Rate Limiting & Fila de Mensagens

**Q: Qual deve ser o limite de mensagens por minuto por cliente?**
- Options: 10/min (atual), 5/min (recomendado), dois níveis (aviso/bloqueio)
- **Selected:** 5 msg/min (mais seguro contra spam acidental)

**Q: Após violar o limite várias vezes, entra em cooldown estendido?**
- Options: Não, Sim (3+ violações → 10 min cooldown), Blacklist permanente
- **Selected:** Sim — após 3 violações consecutivas, cooldown de 10 min

**Q: A mensagem de rate limit deve estar em qual idioma?**
- Options: Só ES (padrão atual), Trilínguo ES/PT/EN, Usar detectLanguage() da Fase 4
- **Selected:** Trilínguo via session.language + detectLanguage()

**Freeform (usuário):** Identificou o risco de banimento pelo WhatsApp ao disparar muitas respostas rápidas ou processar 50 requisições simultâneas do Claude. Propôs implementar uma fila de mensagens com delay humanizado (1-3 segundos) + simular comportamento humano.

**Q: Qual estratégia de delay humanizado para a fila?**
- Options: Delay fixo 1-3s aleatório, Proporcional ao tamanho da mensagem, Fila com 1 envio a cada 2s globalmente
- **Selected:** Delay fixo 1-3 segundos aleatórios

**Q: Simular "digitando" com sendSeen antes de responder?**
- Options: Não, Sim (sendSeen + msg.reply após delay), Não agora
- **Selected:** Sim — client.sendSeen(msg.from) + msg.reply() após o delay

---

### 2. Tratamento de Erros do WhatsApp

**Q: Quando o bot desconecta, como o admin deve ser avisado?**
- Options: Silenciosamente (PM2), WhatsApp para o admin, E-mail (SMTP)
- **Selected:** Enviar mensagem no WhatsApp do admin

**Q: Estratégia de reconexão automática?**
- Options: Indefinidamente, Backoff 3x (5s/15s/30s) depois PM2, 5 min depois reiniciar
- **Selected:** Backoff exponencial 3 tentativas (5s → 15s → 30s), depois PM2 reinicia

**Q: Quando processamento falha, cliente recebe mensagem de desculpas?**
- Options: Não (só log), Sim (mensagem amigável + log), Depende do tipo de erro
- **Selected:** Sim — resposta genérica amigável + erro no log

**Freeform (usuário):** Identificou estados críticos do OpenWA: `UNPAIRED` (sessão expirada/banida), `CONFLICT` (WhatsApp aberto em outro dispositivo), `TIMEOUT` (Puppeteer travado). Propôs monitorar via `client.onStateChanged()` e reagir a cada estado.

---

### 3. Monitoramento & Health Check

**Q: O bot deve expor endpoint HTTP para monitoramento?**
- Options: Não, GET /health simples (status + uptime + sessões), Métricas completas
- **Selected:** GET /health simples na porta 8080

**Q: Em qual porta deve rodar o servidor de health check?**
- Options: 3000, 8080 (recomendado), Configurável via .env
- **Selected:** 8080

**Q: O endpoint /health precisa de autenticação?**
- Options: Não (interno), Sim — token simples (Authorization header ou ?token=)
- **Selected:** Sim — token via HEALTH_TOKEN no .env

---

### 4. Estratégia de Deploy na VPS

**Q: Qual a estratégia de atualização do bot?**
- Options: Manual SSH (git pull + pm2 restart), Script deploy.sh (recomendado), CI/CD GitHub Actions
- **Selected:** deploy.sh com git pull + npm install + pm2 restart em sequência

**Q: O script deve fazer backup da sessão WhatsApp antes de atualizar?**
- Options: Não (gitignore já protege), Sim (cp .wwebjs_auth/ .wwebjs_auth.bkp/), Rsync remoto
- **Selected:** Sim — backup local antes de cada deploy

**Q: Qual estratégia de rotação de logs para evitar disco cheio?**
- Options: Não (logs locais bastam), logrotate do Linux semanal/4 semanas, pm2-logrotate
- **Selected:** logrotate do Linux — semanal, manter 4 semanas

---

## Deferred Ideas

- **CI/CD GitHub Actions** — deploy automático. Futuro (v2)
- **Métricas avançadas no health check** — latência, taxa de erro. Fase 6
- **pm2-logrotate** — alternativa ao logrotate nativo. Descartado (sem dependência extra)
- **Blacklist permanente** — cooldown de 10 min é suficiente para o MVP
