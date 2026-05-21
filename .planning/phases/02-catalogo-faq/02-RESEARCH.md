# Phase 2: Catálogo Inteligente & FAQ — Research

## Decisão Arquitetural Principal

### ✅ Usar Claude Tool Use (Function Calling) para roteamento de intenção

Em vez de um roteador `if-else` frágil, a ARIA usa **Claude Tool Use**:
- Claude recebe a mensagem do usuário + definições de "ferramentas" (search_products, search_faq, etc.)
- Claude **decide sozinho** qual ferramenta chamar e com quais argumentos
- Node.js executa a ferramenta, retorna resultado, Claude formula resposta final
- Resultado: intenção detectada naturalmente, sem regex ou NLP separado

```
Usuário: "tem paracetamol 500mg?"
Claude → decide → tool_use: search_products({ query: "paracetamol 500mg" })
Node.js → busca no cache do Sheets
Claude → resposta natural: "Sim! Temos o Paracetamol 500mg por Gs. 15.000..."
```

### Por que não embeddings/semântica separada?

- O **Claude já faz busca semântica no entendimento da mensagem** — não precisamos de embedding model separado
- **Fuse.js** (fuzzy search) é suficiente para o catálogo: resolve typos, busca por nome/categoria
- **@xenova/transformers** (embeddings locais) seria overhead desnecessário no MVP
- Decisão: Claude interpreta → Fuse.js busca → Claude responde

---

## Stack Confirmada — Phase 2

| Componente | Biblioteca | Uso |
|-----------|-----------|-----|
| Intent routing | Claude Tool Use (nativo do SDK) | Detectar intenção sem código extra |
| Busca de produtos | Fuse.js | Fuzzy search por nome, SKU, categoria |
| Busca de FAQ | Fuse.js (threshold mais alto) | Busca por tags + texto |
| Cache de dados | In-memory Map (já em sheets.js) | Evitar Sheets API repetidas |
| Formatação | Função utilitária | Formatar preço PYG/R$, emojis WA |

```bash
npm install fuse.js
```

---

## Padrões de Tool Use (Claude API)

### Definição de Ferramentas

```javascript
const ARIA_TOOLS = [
  {
    name: "search_products",
    description: "Busca produtos no catálogo por nome, SKU ou categoria. Use quando o cliente perguntar sobre um produto específico, disponibilidade ou preço.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Nome do produto, SKU ou categoria" },
        category: { type: "string", description: "Categoria opcional para filtrar" }
      },
      required: ["query"]
    }
  },
  {
    name: "search_faq",
    description: "Busca resposta em perguntas frequentes. Use quando o cliente fizer pergunta sobre políticas, funcionamento, pagamento, etc.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Pergunta do cliente" }
      },
      required: ["query"]
    }
  }
  // Mais ferramentas adicionadas nas fases 3 e 4
];
```

### Loop de Tool Use

```javascript
// 1. Primeira chamada com tools
const response = await anthropic.messages.create({
  model: "claude-3-5-haiku-20241022",
  messages: history,
  tools: ARIA_TOOLS,
  system: ARIA_SYSTEM_PROMPT
});

// 2. Claude pediu tool use?
if (response.stop_reason === "tool_use") {
  const toolCall = response.content.find(b => b.type === "tool_use");
  const result = await executeTool(toolCall.name, toolCall.input);
  
  // 3. Enviar resultado de volta
  const finalResponse = await anthropic.messages.create({
    model: "claude-3-5-haiku-20241022",
    messages: [
      ...history,
      { role: "assistant", content: response.content },
      { role: "user", content: [{ type: "tool_result", tool_use_id: toolCall.id, content: JSON.stringify(result) }] }
    ],
    system: ARIA_SYSTEM_PROMPT
  });
  return finalResponse.content[0].text;
}
```

---

## Busca de Produtos com Fuse.js

```javascript
import Fuse from 'fuse.js';

const fuseOptions = {
  keys: [
    { name: 'nombre_producto', weight: 0.5 },
    { name: 'sku', weight: 0.3 },
    { name: 'categoria', weight: 0.15 },
    { name: 'presentacion', weight: 0.05 }
  ],
  threshold: 0.35,      // Tolerância a typos (0 = exato, 1 = tudo)
  includeScore: true,
  minMatchCharLength: 3  // Evitar matches de 1-2 chars
};

// Fuse instance recriada quando cache atualiza
let productFuse = null;

export function buildProductIndex(products) {
  productFuse = new Fuse(products, fuseOptions);
}

export function searchProducts(query, category = null) {
  if (!productFuse) return [];
  let results = productFuse.search(query, { limit: 5 });
  
  // Filtrar por categoria se especificada
  if (category) {
    results = results.filter(r => 
      r.item.categoria?.toLowerCase().includes(category.toLowerCase())
    );
  }
  
  // Filtrar por score mínimo de qualidade
  return results
    .filter(r => r.score < 0.4)
    .map(r => r.item);
}
```

---

## Busca de FAQ com Fuse.js

```javascript
const faqFuseOptions = {
  keys: [
    { name: 'pregunta', weight: 0.6 },
    { name: 'tags', weight: 0.4 }  // tags é array ou string separada por vírgulas
  ],
  threshold: 0.45,       // Mais tolerante — FAQ usa linguagem natural
  includeScore: true
};

export function searchFAQ(query) {
  const results = faqFuse.search(query, { limit: 3 });
  const best = results.find(r => r.score < 0.5);
  return best ? best.item : null;  // null = nenhuma FAQ relevante encontrada
}
```

---

## Formatação para WhatsApp

Regras importantes:
- WhatsApp **não renderiza markdown** no mesmo formato que chat web
- **Negrito**: `*texto*` (asterisco simples)
- **Itálico**: `_texto_`
- **Sem tabelas** — usar lista com emojis
- **Sem links clicáveis em texto** — usar URL pura
- Preço: `Gs. 15.000` (paraguai) e `R$ 8,50` (brasil)

```javascript
export function formatProduct(product) {
  const available = product.disponible === 'TRUE' || product.disponible === true;
  return `
*${product.nombre_producto}*
📦 ${product.presentacion}
💰 Gs. ${formatNumber(product.precio_pyg)} | R$ ${product.precio_brl}
${product.requiere_receta === 'TRUE' ? '📋 *Requiere receta médica*' : ''}
${available ? '✅ Disponible' : '❌ Sin stock'}
${product.notas ? `ℹ️ ${product.notas}` : ''}
  `.trim();
}
```

---

## Pitfalls Específicos da Phase 2

1. **Tool use aumenta tokens** — cada chamada com tools adiciona ~200-400 tokens ao prompt; monitorar custo
2. **Claude pode não chamar tool** — quando acha que tem a resposta sem precisar; system prompt deve instruir quando usar tools
3. **Fuse.js com dados em espanhol** — acentos podem causar mismatch; normalizar texto antes de indexar (`trim().toLowerCase()`)
4. **Cache stale** — se farmacêutico atualizar Sheets, bot responde com dados velhos; TTL de 15min é aceitável para MVP
5. **Múltiplas tool calls** — Claude pode fazer 2 tool calls em sequência; implementar loop, não só uma verificação
6. **FAQ sem resultado** — ter fallback claro: "No encontré esa información. ¿Quieres hablar con un asesor? 😊"
7. **Produto com requiere_receta** — bot não pode vender diretamente; deve informar e sugerir visita presencial

---

## Estrutura de Arquivos da Phase 2

```
src/
├── tools/
│   ├── index.js         — Definições de tools + executeTool dispatcher
│   ├── search.js        — Fuse.js: buildIndex, searchProducts, searchFAQ
│   └── format.js        — Formatadores de resposta para WhatsApp
├── handlers/
│   ├── products.js      — Handler: recebe query, chama search, retorna resultado
│   └── faq.js           — Handler: recebe query, chama searchFAQ, retorna resultado
└── claude.js            — ATUALIZAR: adicionar suporte a tool use no loop de chat
```
