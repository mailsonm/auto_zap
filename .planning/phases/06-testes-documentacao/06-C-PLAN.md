# Plan 06-C — Documentação Operacional & Contrato ERP

**Phase:** 6 — Testes, Otimização & Documentação Final
**Plan:** 06-C
**Wave:** 3
**Status:** ⏳ Pending

---

## Objective

Elaborar a documentação final de handoff para a equipe técnica e de atendimento da farmácia/loja, estabelecendo as regras de uso do bot no dia a dia, e criar as especificações de arquitetura futuras (Contrato de Interfaces) para a migração para os ERPs Century / Odoo 19.

---

## Proposed Changes

### Documentation Files
#### [NEW] [docs/OPERATIONS.md](file:///c:/Projectos/auto_zap/docs/OPERATIONS.md)
- Guia para os atendentes humanos:
  - Como assumir uma conversa (basta responder direto no WhatsApp Web/Celular).
  - Como reativar o bot antes dos 30 minutos de pausa (mudando a coluna correspondente no Google Sheets para `"Ativo"`).
  - Como silenciar o bot indefinidamente (definindo como `"Inativo"` na planilha).
  - Melhores práticas para evitar conflito de atendimento (bot vs humano).

#### [NEW] [docs/ERP-INTEGRATION.md](file:///c:/Projectos/auto_zap/docs/ERP-INTEGRATION.md)
- Mapeamento de entidades:
  - Produtos (SKU, preço PYG/BRL, categoria, estoque) do Sheets → ERP Century/Odoo.
  - Clientes/Leads (telefone, nome, interesse) do Sheets → Odoo CRM (Parceiros/Oportunidades).
  - Histórico de Conversas → Atividades/Notas do Odoo.
- Desenho de Arquitetura de Abstração:
  - Estrutura proposta para isolar a infraestrutura de banco de dados (`SheetsRepository` vs `ErpRepository` compartilhando a mesma interface), garantindo baixo acoplamento e migração simplificada.

#### [MODIFY] [README.md](file:///c:/Projectos/auto_zap/README.md)
- Atualizar com instruções sobre como rodar a suite de testes Jest (`npm test`).
- Documentar os novos recursos de rate limit, health check, logs, takeover e scripts de controle introduzidos nas fases 5 e 6.

---

## Verification & Acceptance Criteria

- **Legibilidade:** Todos os arquivos markdown devem conter estruturas limpas, sem links quebrados, e com caminhos absolutos corretos quando aplicável.
- **Conformidade de Conteúdo:** O guia ERP-INTEGRATION deve focar estritamente na abstração de dados (interfaces) e no mapeamento de tipos, sem introduzir novos códigos que estendam o escopo do MVP de forma desnecessária.
