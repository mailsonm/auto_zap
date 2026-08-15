# ERROS.md — Registro de Erros e Correções de Segurança

## 2026-08-15 - Potencial Bypass na Validação de Assinatura HMAC de Webhook (Meta Graph API)

- **Sintoma:** Se a variável `META_APP_SECRET` estivesse ausente no `.env`, a função `validateMetaSignature` retornava `true` incondicionalmente, aceitando qualquer requisição POST não autenticada no endpoint `/webhook/instagram`.
- **Causa:** Lógica de fallback permissiva desenvolvida para testes locais sem diferenciação estrita do ambiente de produção.
- **Solução aplicada:** Refatorada a função em `src/middleware/metaSignature.js` para rejeitar ativamente requisições em produção (`NODE_ENV === 'production'`) caso a chave não esteja configurada, e adicionada verificação prévia do comprimento de buffers antes da comparação `crypto.timingSafeEqual`.
- **Como evitar no futuro:** Nunca criar fallbacks que retornam `true` em rotas públicas de webhook sem verificar o ambiente (`NODE_ENV`), mantendo política "deny-by-default" (bloquear por padrão).

---

## 2026-08-15 - Tratamento de Incompatibilidade de Tamanho em `crypto.timingSafeEqual`

- **Sintoma:** Ao receber assinaturas HMAC com tamanhos diferentes do padrão SHA256 (64 bytes hex), o Node.js lançava uma exceção `TypeError: Input buffers must have the same byte length`.
- **Causa:** O método `crypto.timingSafeEqual` exige que ambos os `Buffer` tenham a mesma extensão.
- **Solução aplicada:** Adicionada validação prévia `if (providedBuf.length !== computedBuf.length) return false;` antes de executar a comparação em tempo constante.
- **Como evitar no futuro:** Sempre validar os comprimentos dos buffers antes de chamar funções criptográficas estritas como `timingSafeEqual`.
