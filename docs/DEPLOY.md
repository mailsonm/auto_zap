# Guia de Deploy — VPS Hostinger

## Pré-requisitos no Servidor

- Ubuntu 20.04 ou superior
- Node.js 20+ instalado
- PM2 instalado globalmente
- Acesso SSH à VPS

## 1. Instalar Node.js 20 (se necessário)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # deve mostrar v20+
```

## 2. Instalar PM2

```bash
npm install -g pm2
```

## 3. Instalar Chromium (necessário para Puppeteer/WhatsApp Web)

```bash
sudo apt update
sudo apt install -y chromium-browser fonts-liberation libappindicator3-1 \
  libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
  libgdk-pixbuf2.0-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 \
  libxdamage1 libxrandr2 xdg-utils
```

## 4. Fazer Upload do Projeto

```bash
# No seu computador local:
git push origin main

# No servidor:
git clone <URL_DO_SEU_REPOSITÓRIO> /home/usuario/auto-zap
cd /home/usuario/auto-zap
npm install
```

Ou use SCP/FTP para fazer upload do projeto (exceto `node_modules/`).

## 5. Configurar Variáveis de Ambiente

```bash
cp .env.example .env
nano .env  # Editar com valores reais
```

Preencher no mínimo:
- `ANTHROPIC_API_KEY`
- `GOOGLE_SHEETS_SCRIPT_URL`
- `NODE_ENV=production`

## 6. Autenticar no WhatsApp (primeira vez)

Antes de configurar o PM2, autentique uma vez manualmente para salvar a sessão:

```bash
node src/index.js
```

Um QR Code aparecerá no terminal. Escaneie com o WhatsApp do número da loja.  
Após autenticar, pressione `Ctrl+C`. A sessão fica salva em `.wwebjs_auth/`.

## 7. Iniciar com PM2

```bash
pm2 start ecosystem.config.js
pm2 save                # Salvar lista de processos
pm2 startup             # Configurar auto-start no reboot
```

Seguir as instruções do comando `pm2 startup` (copia e cola o comando gerado).

## 8. Verificar Status

```bash
pm2 status              # Ver processos rodando
pm2 logs aria-bot       # Ver logs em tempo real
pm2 monit               # Dashboard de monitoramento
```

## 9. Atualizar o Bot

```bash
cd /home/usuario/auto-zap
git pull origin main
npm install             # Se houver novas dependências
pm2 restart aria-bot
```

## Comandos Úteis

```bash
pm2 restart aria-bot    # Reiniciar bot
pm2 stop aria-bot       # Parar bot
pm2 delete aria-bot     # Remover da lista PM2
pm2 flush               # Limpar logs
```

## Reconexão Automática

O bot já tem reconexão automática programada (evento `disconnected`). Se o processo PM2 morrer, o PM2 reiniciará automaticamente.

## Logs

Em produção, logs são salvos em `logs/`:
- `logs/app.log` — todos os logs
- `logs/error.log` — apenas erros

Para ver logs ao vivo: `pm2 logs aria-bot --lines 100`

## Troubleshooting

**Erro "no usable sandbox":**
Verifique que as flags `--no-sandbox` estão configuradas no `src/index.js` (já configuradas por padrão).

**WhatsApp desconecta frequentemente:**
Normal nos primeiros dias. O WhatsApp pode deslogar sessões incomuns. Após algumas semanas, estabiliza.

**QR Code expirou / precisa reautenticar:**
```bash
pm2 stop aria-bot
rm -rf .wwebjs_auth/
node src/index.js       # Escanear QR Code novamente
pm2 start ecosystem.config.js
```

---

## Deploy Automatizado com `deploy.sh` (Phase 5)

Após a primeira configuração manual, use o script para deploys futuros:

```bash
# Na primeira vez, tornar o script executável:
chmod +x deploy.sh

# Para fazer deploy (a partir da raiz do projeto):
./deploy.sh
```

O script executa automaticamente:
1. ⏹ Para o bot (`pm2 stop aria-bot`)
2. 💾 Backup da sessão WhatsApp em `.wwebjs_auth.bkp/`
3. 📥 Atualiza o código (`git pull origin main`)
4. 📦 Instala dependências (`npm install --production`)
5. ▶ Reinicia o bot com novas configurações (`pm2 start ecosystem.config.js --update-env`)

---

## Monitoramento de Saúde — Health Check (Phase 5)

O bot expõe um endpoint HTTP na porta 8080 para monitoramento externo.

### Configurar as variáveis de ambiente em `.env`:

```bash
HEALTH_PORT=8080
HEALTH_TOKEN=seu-token-secreto-aqui   # Gere um UUID ou string aleatória segura
ADMIN_PHONE=5959812345678              # Número admin (código país + número, sem @c.us)
```

### Testar o endpoint de saúde:

```bash
# Com token no header Authorization:
curl -H "Authorization: Bearer seu-token-secreto-aqui" http://localhost:8080/health

# Com token como query param:
curl "http://localhost:8080/health?token=seu-token-secreto-aqui"

# De fora do servidor (substituir <IP_VPS> pelo IP real):
curl -H "Authorization: Bearer seu-token-secreto-aqui" http://<IP_VPS>:8080/health
```

### Resposta esperada:

```json
{
  "status": "ok",
  "uptime": 3600,
  "activeSessions": 2,
  "waConnected": true,
  "timestamp": "2025-05-22T20:00:00.000Z"
}
```

| Campo | Significado |
|-------|-------------|
| `status: "ok"` | Bot conectado e funcionando normalmente |
| `status: "degraded"` | WhatsApp desconectado — bot rodando mas tentando reconectar |
| `uptime` | Segundos desde o início do processo |
| `activeSessions` | Número de conversas ativas no Claude |
| `waConnected` | `true` se WhatsApp está conectado |

### Abrir a porta no firewall da VPS (se necessário):

```bash
sudo ufw allow 8080/tcp
sudo ufw status
```

---

## Rotação de Logs com `logrotate` (Phase 5)

### Criar o arquivo de configuração do logrotate:

```bash
# Substitua 'usuario' e o caminho pelo usuário e diretório reais do seu servidor
sudo nano /etc/logrotate.d/aria-bot
```

Cole o seguinte conteúdo (ajuste o caminho e o usuário):

```
/home/usuario/auto-zap/logs/*.log {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 644 usuario usuario
    postrotate
        pm2 flush aria-bot
    endscript
}
```

### Testar a configuração:

```bash
# Dry run (mostra o que faria sem alterar arquivos):
sudo logrotate -d /etc/logrotate.d/aria-bot

# Forçar rotação agora (para testar de verdade):
sudo logrotate -f /etc/logrotate.d/aria-bot
```

A configuração acima:
- Roda **semanalmente**
- Mantém **4 semanas** de histórico
- **Comprime** logs antigos (`gzip`)
- Limpa os buffers internos do PM2 após rotação (`pm2 flush aria-bot`)

---

## Notificações Admin via WhatsApp (Phase 5)

Com `ADMIN_PHONE` configurado no `.env`, o bot enviará mensagens automáticas para o número admin quando:

| Evento | Mensagem enviada |
|--------|-----------------|
| Bot desconecta | ⚠️ ARIA bot desconectado. Motivo: [reason]. Tentando reconectar... |
| Estado UNPAIRED | ⚠️ ARIA: sessão WhatsApp UNPAIRED (expirada/banida). Tentando reconectar... |
| Estado CONFLICT | ⚠️ ARIA: conflito WhatsApp (aberto em outro dispositivo). Reconectando... |
| Estado TIMEOUT | ❌ ARIA: timeout do Puppeteer/Chrome. PM2 reiniciando o processo... |
| Reconexão falhou (3x) | ❌ ARIA bot não conseguiu reconectar após 3 tentativas. PM2 reiniciando... |
| Reconexão bem-sucedida | ✅ ARIA bot reconectado com sucesso! |

### Formato do ADMIN_PHONE:

```bash
# Paraguai (595) + número (sem espaços, sem @c.us):
ADMIN_PHONE=5959812345678

# Brasil (55) + DDD + número:
ADMIN_PHONE=5511987654321
```
