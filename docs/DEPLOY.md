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
