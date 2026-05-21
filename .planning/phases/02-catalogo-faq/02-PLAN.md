# Phase 2: Catálogo Inteligente & FAQ

**Goal:** ARIA consulta produtos, preços, disponibilidade e responde perguntas frequentes de forma natural e contextualizada, usando Claude Tool Use para roteamento de intenção + Fuse.js para busca fuzzy.

**Requirements:** PROD-01, PROD-02, PROD-03, FAQ-01, FAQ-02

**Depende de:** Phase 1 completa (sheets.js com cache, claude.js com histórico, router.js básico)

---

## Plan A — Instalar Dependências & Estrutura de Arquivos

**Objetivo:** Preparar ambiente da Phase 2 com Fuse.js instalado e estrutura de pastas criada.

### Tarefas

1. **Instalar Fuse.js**
   ```bash
   npm install fuse.js
   ```

2. **Criar estrutura de pastas**
   ```
   src/
   └── tools/
       ├── index.js    ← dispatcher de tools + definições Claude
       ├── search.js   ← Fuse.js indexes + funções de busca
       └── format.js   ← formatadores WhatsApp
   ```

3. **Verificar** que Phase 1 está completa: `src/sheets.js`, `src/claude.js`, `src/handlers/router.js` existem

### Critério de Aceitação
- `npm list fuse.js` retorna versão instalada
- Estrutura de pastas criada sem erros

---

## Plan B — Motor de Busca com Fuse.js (`src/tools/search.js`)

**Objetivo:** Módulo de busca fuzzy para produtos e FAQ, com índices em memória sincronizados ao cache do sheets.js.

### Tarefas

1. **Implementar `src/tools/search.js`**

   ```javascript
   import Fuse from 'fuse.js';
   
   // Índices em memória — recriados quando sheets.js atualiza cache
   let productFuse = null;
   let faqFuse = null;
   
   // Normalizar texto para busca (remove acentos, lowercase)
   function normalize(text) {
     return (text || '').toLowerCase()
       .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
   }
   
   // Indexar produtos do cache
   export function buildProductIndex(products) {
     const normalized = products.map(p => ({
       ...p,
       _nombre: normalize(p.nombre_producto),
       _sku: normalize(p.sku),
       _categoria: normalize(p.categoria)
     }));
     productFuse = new Fuse(normalized, {
       keys: [
         { name: '_nombre', weight: 0.5 },
         { name: '_sku', weight: 0.3 },
         { name: '_categoria', weight: 0.15 },
         { name: 'presentacion', weight: 0.05 }
       ],
       threshold: 0.35,
       includeScore: true,
       minMatchCharLength: 3
     });
   }
   
   // Indexar FAQs do cache
   export function buildFAQIndex(faqs) {
     const normalized = faqs.map(f => ({
       ...f,
       _pregunta: normalize(f.pregunta_frecuente),
       _tags: normalize(Array.isArray(f.tags_de_busqueta) 
         ? f.tags_de_busqueta.join(' ') 
         : (f.tags_de_busqueta || ''))
     }));
     faqFuse = new Fuse(normalized, {
       keys: [
         { name: '_pregunta', weight: 0.6 },
         { name: '_tags', weight: 0.4 }
       ],
       threshold: 0.45,
       includeScore: true
     });
   }
   
   // Buscar produto — retorna até 5 resultados relevantes
   export function searchProducts(query, category = null) {
     if (!productFuse) return [];
     const q = normalize(query);
     let results = productFuse.search(q, { limit: 5 });
     if (category) {
       const cat = normalize(category);
       results = results.filter(r => r.item._categoria?.includes(cat));
     }
     return results.filter(r => r.score < 0.4).map(r => r.item);
   }
   
   // Buscar FAQ — retorna melhor match ou null
   export function searchFAQ(query) {
     if (!faqFuse) return null;
     const results = faqFuse.search(normalize(query), { limit: 3 });
     const best = results.find(r => r.score < 0.5);
     return best ? best.item : null;
   }
   
   // Buscar produtos por categoria (listagem)
   export function listByCategory(category) {
     if (!productFuse) return [];
     return productFuse._docs
       .filter(p => normalize(p.categoria || '').includes(normalize(category)))
       .filter(p => p.disponible === 'TRUE' || p.disponible === true)
       .slice(0, 8);
   }
   ```

2. **Integrar com sheets.js** — chamar `buildProductIndex` e `buildFAQIndex` quando o cache for preenchido/renovado

### Critério de Aceitação
- `searchProducts("paracetamol")` retorna produtos com "paracetamol" no nome
- `searchProducts("paracetammol")` (typo) também retorna resultado correto
- `searchFAQ("aceitam cartão")` retorna FAQ sobre formas de pagamento
- `listByCategory("analgésico")` lista produtos disponíveis da categoria

---

## Plan C — Definições de Tools Claude (`src/tools/index.js`)

**Objetivo:** Definir as "ferramentas" que Claude pode chamar + dispatcher que executa a ferramenta certa.

### Tarefas

1. **Implementar `src/tools/index.js`**

   ```javascript
   import { searchProducts, searchFAQ, listByCategory } from './search.js';
   import { formatProduct, formatProductList, formatFAQAnswer } from './format.js';
   import logger from '../logger.js';
   
   // Definições de tools para a Claude API
   export const ARIA_TOOLS = [
     {
       name: "buscar_produto",
       description: "Busca produtos no catálogo por nome, SKU ou categoria. Use SEMPRE que o cliente perguntar sobre um produto específico, se tem disponível, qual o preço, apresentação, ou precisar de receita. Não invente produtos — use esta ferramenta.",
       input_schema: {
         type: "object",
         properties: {
           query: {
             type: "string",
             description: "Nome do produto, SKU ou termo de busca. Ex: 'paracetamol', 'amoxicilina 500mg', 'antibiótico'"
           },
           categoria: {
             type: "string",
             description: "Categoria opcional para filtrar. Ex: 'analgésico', 'antibiótico', 'vitamina'. Omitir se não mencionado."
           }
         },
         required: ["query"]
       }
     },
     {
       name: "listar_categoria",
       description: "Lista produtos disponíveis de uma categoria específica. Use quando cliente perguntar 'quais remédios para X?' ou 'o que têm de Y?'",
       input_schema: {
         type: "object",
         properties: {
           categoria: {
             type: "string",
             description: "Categoria de produtos. Ex: 'analgésico', 'antibiótico', 'vitamina'"
           }
         },
         required: ["categoria"]
       }
     },
     {
       name: "buscar_faq",
       description: "Busca resposta em perguntas frequentes. Use quando cliente perguntar sobre políticas da loja, formas de pagamento, horários, entrega, ou qualquer dúvida geral que NÃO seja sobre produto específico.",
       input_schema: {
         type: "object",
         properties: {
           pergunta: {
             type: "string",
             description: "Pergunta ou dúvida do cliente"
           }
         },
         required: ["pergunta"]
       }
     }
   ];
   
   // Executar a tool escolhida pelo Claude
   export async function executeTool(toolName, toolInput) {
     logger.info(`Tool chamada: ${toolName}`, { input: toolInput });
     
     switch (toolName) {
       case 'buscar_produto': {
         const results = searchProducts(toolInput.query, toolInput.categoria);
         if (results.length === 0) {
           return { encontrado: false, mensagem: "Produto não encontrado no catálogo." };
         }
         return {
           encontrado: true,
           total: results.length,
           produtos: results.map(p => ({
             nombre: p.nombre_producto,
             sku: p.sku,
             presentacion: p.presentacion,
             precio_pyg: p.precio_pyg,
             precio_brl: p.precio_brl,
             disponible: p.disponible === 'TRUE' || p.disponible === true,
             requiere_receta: p.requiere_receta === 'TRUE' || p.requiere_receta === true,
             categoria: p.categoria,
             notas: p.notas_restricciones || ''
           }))
         };
       }
       
       case 'listar_categoria': {
         const products = listByCategory(toolInput.categoria);
         if (products.length === 0) {
           return { encontrado: false, mensagem: `Sem produtos disponíveis em '${toolInput.categoria}'.` };
         }
         return { encontrado: true, categoria: toolInput.categoria, produtos: products.map(p => ({
           nombre: p.nombre_producto,
           precio_pyg: p.precio_pyg,
           disponible: true
         }))};
       }
       
       case 'buscar_faq': {
         const faq = searchFAQ(toolInput.pergunta);
         if (!faq) {
           return { encontrado: false, mensagem: "Sem resposta no FAQ para essa pergunta." };
         }
         return {
           encontrado: true,
           pregunta: faq.pregunta_frecuente,
           respuesta: faq.respuesta_completa
         };
       }
       
       default:
         logger.warn(`Tool desconhecida: ${toolName}`);
         return { erro: `Ferramenta '${toolName}' não reconhecida.` };
     }
   }
   ```

### Critério de Aceitação
- `executeTool("buscar_produto", { query: "paracetamol" })` retorna objeto com produtos
- `executeTool("buscar_faq", { pergunta: "aceitam cartão?" })` retorna objeto com resposta
- Tool desconhecida não quebra o sistema

---

## Plan D — Formatadores WhatsApp (`src/tools/format.js`)

**Objetivo:** Funções que transformam objetos de dados em texto formatado para WhatsApp.

### Tarefas

1. **Implementar `src/tools/format.js`**

   ```javascript
   // Formatar número como preço
   function fmtPYG(val) {
     const n = parseInt(val) || 0;
     return `Gs. ${n.toLocaleString('es-PY')}`;
   }
   
   function fmtBRL(val) {
     const n = parseFloat(val) || 0;
     return `R$ ${n.toFixed(2).replace('.', ',')}`;
   }
   
   // Produto único
   export function formatProduct(p) {
     const lines = [
       `*${p.nombre_producto || p.nombre}*`,
       p.presentacion ? `📦 ${p.presentacion}` : null,
       `💰 ${fmtPYG(p.precio_pyg)} | ${fmtBRL(p.precio_brl)}`,
       p.requiere_receta ? `📋 *Requiere receta médica*` : null,
       p.disponible === false || p.disponible === 'FALSE'
         ? `❌ Sin stock actualmente`
         : `✅ Disponible`,
       p.notas ? `ℹ️ ${p.notas}` : null
     ].filter(Boolean);
     return lines.join('\n');
   }
   
   // Lista de produtos (múltiplos)
   export function formatProductList(products, maxItems = 5) {
     if (!products.length) return null;
     const items = products.slice(0, maxItems).map((p, i) =>
       `${i + 1}. *${p.nombre_producto || p.nombre}* — ${fmtPYG(p.precio_pyg)}`
     );
     const footer = products.length > maxItems
       ? `\n_(+ ${products.length - maxItems} más disponibles)_`
       : '';
     return items.join('\n') + footer;
   }
   
   // Resposta FAQ
   export function formatFAQAnswer(faq) {
     return faq.respuesta_completa || faq.respuesta || '';
   }
   ```

2. **Regras de formatação** documentadas nos comentários:
   - Negrito: `*texto*`
   - Itálico: `_texto_`
   - Sem markdown de tabela
   - Sem HTML
   - Emojis moderados (máximo 1-2 por mensagem)

### Critério de Aceitação
- `formatProduct(produto)` retorna string multi-linha com preços, disponibilidade
- `formatProductList([...])` retorna lista numerada
- Produtos sem preço retornam `Gs. 0` sem quebrar

---

## Plan E — Atualizar Claude Client para Tool Use (`src/claude.js`)

**Objetivo:** Modificar `chat()` para suportar o ciclo de tool use do Claude (até 3 iterações).

### Tarefas

1. **Modificar `src/claude.js`** — adicionar suporte a tools

   ```javascript
   import { ARIA_TOOLS, executeTool } from './tools/index.js';
   
   // ARIA_TOOLS injetados apenas se features de catálogo estão carregadas
   const MAX_TOOL_ITERATIONS = 3;
   
   export async function chat(phone, userMessage, options = {}) {
     const { useTools = true } = options;
     const history = getHistory(phone);
     history.push({ role: 'user', content: userMessage });
     trimHistory(phone);
     
     let response;
     let iterations = 0;
     let messages = [...history];
     
     while (iterations < MAX_TOOL_ITERATIONS) {
       iterations++;
       response = await anthropic.messages.create({
         model: MODEL,
         system: ARIA_SYSTEM_PROMPT,
         messages,
         tools: useTools ? ARIA_TOOLS : undefined,
         max_tokens: 512
       });
       
       // Sem tool use — resposta final
       if (response.stop_reason !== 'tool_use') break;
       
       // Executar todas as tools pedidas (pode haver múltiplas)
       const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
       const toolResults = await Promise.all(
         toolUseBlocks.map(async (block) => ({
           type: 'tool_result',
           tool_use_id: block.id,
           content: JSON.stringify(await executeTool(block.name, block.input))
         }))
       );
       
       // Adicionar assistant response + tool results ao histórico local da iteração
       messages = [
         ...messages,
         { role: 'assistant', content: response.content },
         { role: 'user', content: toolResults }
       ];
     }
     
     // Extrair texto da resposta final
     const assistantText = response.content
       .filter(b => b.type === 'text')
       .map(b => b.text)
       .join('');
     
     // Salvar apenas o exchange final no histórico persistente
     history.push({ role: 'assistant', content: assistantText });
     
     return assistantText;
   }
   ```

2. **Atualizar system prompt** em `aria.js` — instruções sobre tools:
   ```
   Quando o cliente perguntar sobre produtos, preços ou disponibilidade, 
   SEMPRE use a ferramenta buscar_produto. Nunca invente produtos ou preços.
   Para perguntas gerais sobre a loja, use buscar_faq.
   ```

### Critério de Aceitação
- Mensagem sobre produto dispara `stop_reason === "tool_use"`
- Tool result é enviado de volta e Claude formula resposta final em linguagem natural
- Loops de tool use não ultrapassam 3 iterações
- Histórico do chat mantém coerência após tool calls

---

## Plan F — Integrar Índices ao Startup (`src/index.js`)

**Objetivo:** Garantir que os índices Fuse.js sejam construídos na inicialização e renovados quando o cache do Sheets atualiza.

### Tarefas

1. **Modificar `src/index.js`** — inicializar índices após carregar dados do Sheets:
   ```javascript
   import { buildProductIndex, buildFAQIndex } from './tools/search.js';
   
   async function initializeData() {
     const [products, faqs] = await Promise.all([
       sheets.getProducts(),
       sheets.getFAQs()
     ]);
     buildProductIndex(products);
     buildFAQIndex(faqs);
     logger.info(`Índices criados: ${products.length} produtos, ${faqs.length} FAQs`);
   }
   
   // Chamar no startup + agendar renovação a cada 15 min
   await initializeData();
   setInterval(initializeData, 15 * 60 * 1000);
   ```

2. **Modificar `src/sheets.js`** — callback opcional ao renovar cache:
   - `onCacheRefresh` callback para notificar quando dados foram atualizados

### Critério de Aceitação
- Log "Índices criados: X produtos, Y FAQs" aparece no startup
- Após 15min, índices são reconstruídos automaticamente com dados frescos
- Bot não responde com dados de produto antes dos índices estarem prontos

---

## Plan G — Testes de Integração da Phase 2

**Objetivo:** Validar os fluxos principais manualmente (e opcionalmente com scripts de teste).

### Cenários de Teste

```
1. Consulta de produto específico
   Input: "tiene paracetamol?"
   Esperado: Nome, preço PYG/R$, disponibilidade, se requer receita

2. Consulta com typo
   Input: "tiene paramcetaol 500mg?"
   Esperado: Mesmo resultado que paracetamol (fuzzy match)

3. Consulta por categoria
   Input: "¿qué antiinflamatorios tienen?"
   Esperado: Lista de produtos da categoria

4. Produto com receita
   Input: "tienen amoxicilina?"
   Esperado: Info + aviso de "requiere receta médica"

5. Produto sem estoque
   Input: "tienen [produto indisponível]?"
   Esperado: Info do produto + "❌ Sin stock actualmente"

6. FAQ — forma de pagamento
   Input: "aceptan tarjeta?"
   Esperado: Resposta da FAQ sobre formas de pagamento

7. FAQ — sem resultado
   Input: "cual es la temperatura de Marte?"
   Esperado: Fallback gracioso + oferecer humano

8. Produto não existe
   Input: "tienen plutônio?"
   Esperado: "No encontré ese producto. ¿Puedo ayudarte con algo más?"
```

### Script de teste rápido (opcional)
- Criar `tests/phase2-smoke.js` com queries simuladas contra `searchProducts` e `searchFAQ`
- Verificar scores de similaridade para os 8 cenários acima

### Critério de Aceitação
- Todos os 8 cenários passam manualmente no WhatsApp
- Nenhum cenário retorna dados inventados pelo Claude
- Tempo de resposta < 5s para todos os cenários

---

## Sequência de Execução

```
Plan A (deps + estrutura)
     ↓
Plan B (search.js) ←→ Plan D (format.js)   [paralelos]
     ↓
Plan C (tools/index.js — depende de B e D)
     ↓
Plan E (atualizar claude.js — depende de C)
     ↓
Plan F (integrar ao startup — depende de E)
     ↓
Plan G (testes — depende de F)
```

## Definition of Done — Phase 2

- [ ] `npm install fuse.js` OK
- [ ] `src/tools/search.js` — busca fuzzy funcionando para produtos e FAQ
- [ ] `src/tools/index.js` — ARIA_TOOLS definidas + executeTool dispatcher
- [ ] `src/tools/format.js` — formatadores WhatsApp corretos (negrito, preço)
- [ ] `src/claude.js` — loop de tool use implementado (até 3 iterações)
- [ ] `src/index.js` — índices Fuse.js construídos no startup e renovados a cada 15min
- [ ] Todos os 8 cenários de teste passam manualmente no WhatsApp
- [ ] Claude nunca inventa produtos que não existem no catálogo
- [ ] Tempo de resposta médio < 5s
