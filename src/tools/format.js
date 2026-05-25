/**
 * Formatadores de Mensagem para o WhatsApp — ARIA
 */

/**
 * Formatar valor numérico para o padrão PYG (Guaranis).
 * Ex: 15000 -> Gs. 15.000
 * @param {number|string} val 
 * @returns {string}
 */
export function fmtPYG(val) {
  const n = parseInt(val) || 0;
  return `Gs. ${n.toLocaleString('es-PY')}`;
}

/**
 * Formatar valor numérico para o padrão BRL (Reais).
 * Ex: 8.5 -> R$ 8,50
 * @param {number|string} val 
 * @returns {string}
 */
export function fmtBRL(val) {
  const n = parseFloat(val) || 0;
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

/**
 * Formatar um produto individual para mensagem do WhatsApp.
 * @param {object} p — produto padronizado
 * @returns {string}
 */
export function formatProduct(p) {
  const lines = [
    `*${p.nombre}*`,
    p.presentacion ? `📦 ${p.presentacion}` : null,
    `💰 ${fmtPYG(p.precio_pyg)} | ${fmtBRL(p.precio_brl)}`,
    p.requiere_receta ? `📋 *Requiere receta médica*` : null,
    p.disponible ? `✅ Disponible` : `❌ Sin stock actualmente`,
    p.notas ? `ℹ️ ${p.notas}` : null
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * Formatar uma lista de produtos simplificada para WhatsApp.
 * @param {Array} products 
 * @param {number} [maxItems=5] 
 * @returns {string|null}
 */
export function formatProductList(products, maxItems = 5) {
  if (!products || products.length === 0) return null;
  
  const items = products.slice(0, maxItems).map((p, i) => {
    const detail = p.presentacion ? ` (${p.presentacion})` : '';
    return `${i + 1}. *${p.nombre}*${detail} — ${fmtPYG(p.precio_pyg)}`;
  });
  
  const footer = products.length > maxItems
    ? `\n_(+ ${products.length - maxItems} más disponibles)_`
    : '';
    
  return items.join('\n') + footer;
}

/**
 * Formatar resposta de FAQ.
 * @param {object} faq — objeto FAQ padronizado
 * @returns {string}
 */
export function formatFAQAnswer(faq) {
  return faq.respuesta || '';
}

/**
 * Formatar uma filial individual para WhatsApp.
 * @param {object} b — filial padronizada
 * @returns {string}
 */
export function formatBranch(b) {
  const lines = [
    `📍 *${b.nombre_ubicacion}*`,
    `🏢 Dirección: ${b.direccion}`,
    `🕒 Horario: ${b.horario}`,
    b.telefono ? `📞 Teléfono: ${b.telefono}` : null,
    b.acepta_whatsapp ? `💬 *Acepta WhatsApp para pedidos*` : null,
    b.notas ? `ℹ️ Notas: ${b.notas}` : null
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * Formatar uma lista de filiais para WhatsApp.
 * @param {Array} branches 
 * @returns {string}
 */
export function formatBranchList(branches) {
  if (!branches || branches.length === 0) return 'No se encontraron sucursales.';
  return branches.map(b => formatBranch(b)).join('\n\n');
}

/**
 * Formatar um serviço individual para WhatsApp.
 * @param {object} s — serviço padronizado
 * @returns {string}
 */
export function formatService(s) {
  const lines = [
    `🩺 *${s.servicio}*`,
    `📝 Descripción: ${s.descripcion}`,
    `💰 Precio: ${fmtPYG(s.precio_pyg)} | ${fmtBRL(s.precio_brl)}`,
    s.requisitos ? `📋 Requisitos: ${s.requisitos}` : null,
    s.duracion_modalidad ? `⏳ Duración / Modalidad: ${s.duracion_modalidad}` : null
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * Formatar uma lista de serviços para WhatsApp.
 * @param {Array} services 
 * @returns {string}
 */
export function formatServiceList(services) {
  if (!services || services.length === 0) return 'No se encontraron servicios.';
  return services.map(s => formatService(s)).join('\n\n');
}

