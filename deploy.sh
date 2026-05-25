#!/bin/bash
# deploy.sh — Script de Deploy Automatizado do Bot ARIA
# Uso: ./deploy.sh
# Requisitos: PM2 instalado globalmente, git configurado, npm disponível
#
# Executa em sequência:
# 1. Para o bot
# 2. Backup da sessão WhatsApp
# 3. Atualiza o código do repositório
# 4. Instala dependências de produção
# 5. Reinicia o bot com as novas configurações

set -e  # Parar execução em caso de qualquer erro

echo ""
echo "=========================================="
echo "  🚀 Deploy ARIA Bot — $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# ── 1. Parar o bot ──────────────────────────────────────────────────────────
echo "⏹  Parando o bot..."
pm2 stop aria-bot 2>/dev/null || echo "  (bot não estava rodando — continuando)"
echo ""

# ── 2. Backup da sessão WhatsApp ─────────────────────────────────────────────
echo "💾 Fazendo backup da sessão WhatsApp..."
if [ -d ".wwebjs_auth" ]; then
  cp -r .wwebjs_auth/ .wwebjs_auth.bkp/
  echo "  Backup salvo em .wwebjs_auth.bkp/"
else
  echo "  (pasta .wwebjs_auth não encontrada — pulando backup)"
fi
echo ""

# ── 3. Atualizar código ──────────────────────────────────────────────────────
echo "📥 Atualizando código do repositório..."
git pull origin main
echo ""

# ── 4. Instalar dependências ─────────────────────────────────────────────────
echo "📦 Instalando dependências de produção..."
npm install --production
echo ""

# ── 5. Reiniciar o bot ───────────────────────────────────────────────────────
echo "▶  Iniciando o bot..."
pm2 start ecosystem.config.js --update-env
echo ""

# ── 6. Status final ─────────────────────────────────────────────────────────
echo "✅ Deploy concluído!"
echo ""
pm2 status aria-bot
echo ""
echo "📋 Para acompanhar os logs em tempo real:"
echo "   pm2 logs aria-bot --lines 50"
echo ""
