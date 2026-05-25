import { searchProducts, searchFAQ, listByCategory, searchBranches, searchServices } from './search.js';
import { formatProduct, formatProductList, formatBranch, formatBranchList, formatService, formatServiceList } from './format.js';
import logger from '../logger.js';
import { appendLead } from '../sheets.js';
import { getSession, addTopic } from '../session.js';

// Definições de tools compatíveis com o formato de mensagens
export const SAMANTHA_TOOLS = [
  {
    name: "buscar_produto",
    description: "Busca productos en el catálogo de la farmacia por nombre, SKU o categoría. Úsala SIEMPRE que el cliente pregunte por la disponibilidad, precio, presentación de un medicamento o producto, o si requiere receta. No inventes productos ni precios — usa siempre esta herramienta para consultar.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Nombre del producto, SKU o término de búsqueda. Ej: 'paracetamol', 'amoxicilina 500mg', 'vitamina C'"
        },
        categoria: {
          type: "string",
          description: "Categoría opcional para filtrar los resultados si fue mencionada por el cliente. Ej: 'analgésico', 'antibiótico'"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "listar_categoria",
    description: "Lista productos disponibles en una categoría específica. Úsala cuando el cliente pregunte '¿qué analgésicos tienen?', 'muéstrame opciones de vitaminas' o similares.",
    input_schema: {
      type: "object",
      properties: {
        categoria: {
          type: "string",
          description: "Categoría de productos a buscar. Ej: 'analgésico', 'antibiótico', 'vitaminas', 'cuidado personal'"
        }
      },
      required: ["categoria"]
    }
  },
  {
    name: "buscar_faq",
    description: "Busca respuestas a preguntas frecuentes sobre la farmacia (métodos de pago, delivery/envíos, horarios, ubicación/sucursales, facturación, etc.). Úsala para cualquier duda general del cliente que NO sea sobre un producto específico.",
    input_schema: {
      type: "object",
      properties: {
        pergunta: {
          type: "string",
          description: "La duda o pregunta del cliente de forma concisa. Ej: '¿aceptan tarjeta?', '¿cuál es el horario?', '¿hacen delivery?'"
        }
      },
      required: ["pergunta"]
    }
  },
  {
    name: "buscar_filial",
    description: "Busca información sobre las sucursales de la farmacia (dirección, horario, teléfono, disponibilidad de WhatsApp). Úsala cuando el cliente pregunte dónde quedan las tiendas, los horarios de atención, números de contacto o si una filial atiende por WhatsApp. Puedes dejar la consulta en blanco o vacía para listar todas las sucursales.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Nombre de la sucursal, ciudad, barrio o palabra clave. Ej: 'Central', 'domingo', 'bairro'. Opcional."
        }
      }
    }
  },
  {
    name: "buscar_servicio",
    description: "Busca información sobre los servicios médicos, de enfermería o estéticos que ofrece la farmacia (consultas, vacunas, análisis, etc.). Úsala cuando el cliente pregunte qué servicios se realizan, sus costos, horarios o requisitos. Puedes dejar la consulta en blanco o vacía para listar todos los servicios.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Nombre del servicio o palabra clave. Ej: 'consulta', 'vacuna', 'test'. Opcional."
        }
      }
    }
  },
  {
    name: "registrar_lead",
    description: "Registra un lead/cliente potencial interesado en comprar un producto o servicio cuando muestre intención de compra y haya proporcionado su nombre. Esta herramienta genera un número de protocolo único para el cliente. Úsala solo cuando ya tengas el nombre del cliente y el producto/servicio de interés.",
    input_schema: {
      type: "object",
      properties: {
        nombre: {
          type: "string",
          description: "Nombre del cliente."
        },
        producto_servico: {
          type: "string",
          description: "Nombre del producto o servicio de interés (ej: 'Tirzepatida 5mg', 'Vacuna Antigripal')."
        },
        notas: {
          type: "string",
          description: "Detalles adicionales opcionales (ej: 'Quiere entrega a domicilio', 'Preguntó por formas de pago')."
        }
      },
      required: ["nombre", "producto_servico"]
    }
  }
];

/**
 * Executa a ferramenta escolhida pelo Claude e retorna o resultado em formato JSON
 * amigável para o LLM interpretar e responder ao cliente.
 * 
 * @param {string} toolName — Nome da ferramenta
 * @param {object} toolInput — Argumentos da ferramenta
 * @returns {Promise<object>} — Resultado da execução
 */
export async function executeTool(toolName, toolInput, phone = null) {
  logger.info(`Executando tool: ${toolName}`, { input: toolInput, phone });

  if (phone) {
    if (toolName === 'buscar_produto' || toolName === 'listar_categoria') {
      addTopic(phone, 'productos');
    } else if (toolName === 'buscar_faq') {
      addTopic(phone, 'faq');
    } else if (toolName === 'buscar_filial') {
      addTopic(phone, 'sucursales');
    } else if (toolName === 'buscar_servicio') {
      addTopic(phone, 'servicios');
    } else if (toolName === 'registrar_lead') {
      addTopic(phone, 'lead');
    }
  }
  
  try {
    switch (toolName) {
      case 'buscar_produto': {
        const results = searchProducts(toolInput.query, toolInput.categoria);
        if (results.length === 0) {
          return { 
            encontrado: false, 
            mensaje: "Producto no encontrado en el catálogo. Ofrece disculpas cordialmente y pregunta si desea que consultes con un asesor humano." 
          };
        }
        
        return {
          encontrado: true,
          total: results.length,
          produtos: results.map(p => ({
            sku: p.sku,
            nombre: p.nombre,
            presentacion: p.presentacion,
            precio_pyg: p.precio_pyg,
            precio_brl: p.precio_brl,
            disponible: p.disponible,
            requiere_receta: p.requiere_receta,
            categoria: p.categoria,
            notas: p.notas
          }))
        };
      }
      
      case 'listar_categoria': {
        const products = listByCategory(toolInput.categoria);
        if (products.length === 0) {
          return { 
            encontrado: false, 
            mensaje: `No se encontraron productos disponibles en la categoría '${toolInput.categoria}'.` 
          };
        }
        
        return {
          encontrado: true,
          categoria: toolInput.categoria,
          produtos: products.map(p => ({
            nombre: p.nombre,
            presentacion: p.presentacion,
            precio_pyg: p.precio_pyg,
            precio_brl: p.precio_brl,
            disponible: p.disponible,
            requiere_receta: p.requiere_receta
          }))
        };
      }
      case 'buscar_faq': {
        const faq = searchFAQ(toolInput.pergunta);
        if (!faq) {
          return { 
            encontrado: false, 
            mensaje: "No encontré una respuesta exacta para esta pregunta en la base de datos de preguntas frecuentes. Recomienda hablar con un asesor humano de forma amable." 
          };
        }
        
        return {
          encontrado: true,
          pregunta: faq.pregunta,
          respuesta: faq.respuesta
        };
      }

      case 'buscar_filial': {
        const results = searchBranches(toolInput.query);
        if (results.length === 0) {
          return {
            encontrado: false,
            mensaje: "No se encontraron sucursales. Ofrece disculpas y sugiere hablar con un asesor humano."
          };
        }
        return {
          encontrado: true,
          total: results.length,
          sucursales: results.map(b => ({
            id: b.id,
            nombre_ubicacion: b.nombre_ubicacion,
            direccion: b.direccion,
            horario: b.horario,
            telefono: b.telefono,
            acepta_whatsapp: b.acepta_whatsapp,
            notas: b.notas
          }))
        };
      }

      case 'buscar_servicio': {
        const results = searchServices(toolInput.query);
        if (results.length === 0) {
          return {
            encontrado: false,
            mensaje: "No se encontraron servicios en el catálogo. Ofrece disculpas cordialmente."
          };
        }
        return {
          encontrado: true,
          total: results.length,
          servicios: results.map(s => ({
            id: s.id,
            servicio: s.servicio,
            descripcion: s.descripcion,
            precio_pyg: s.precio_pyg,
            precio_brl: s.precio_brl,
            requisitos: s.requisitos,
            duracion_modalidad: s.duracion_modalidad
          }))
        };
      }
      
      case 'registrar_lead': {
        const protocol = Math.floor(100000 + Math.random() * 900000).toString();
        let sessionLang = 'es';
        if (phone) {
          const session = getSession(phone);
          if (session && session.language) {
            sessionLang = session.language;
          }
        }
        
        const fullNotes = `[Protocolo: ${protocol}] ${toolInput.notas || ''}`.trim();
        
        await appendLead({
          phone: phone || 'unknown',
          name: toolInput.nombre,
          interest: toolInput.producto_servico,
          language: sessionLang,
          notes: fullNotes
        });

        return {
          registrado: true,
          protocolo: protocol,
          mensaje: "Lead registrado exitosamente con protocolo de seguimiento."
        };
      }
      
      default:
        logger.warn(`Tool desconhecida: ${toolName}`);
        return { error: `Ferramenta '${toolName}' não reconhecida.` };
    }
  } catch (err) {
    logger.error(`Erro ao executar ferramenta ${toolName}`, { error: err.message, stack: err.stack });
    return { error: `Ocurrió un error al consultar la información: ${err.message}` };
  }
}
