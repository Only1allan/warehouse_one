import type { ToolDefinition } from "../ai/model-port";

export const COPILOT_TOOLS: ToolDefinition[] = [
  {
    name: "get_stock_level",
    description:
      "How many units of a product are in stock. Use for any question about quantity, availability or 'how many'.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Product name, common word for it, or SKU code, for example 'generators' or '001254'.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "find_location",
    description:
      "Where a product is stored (aisle, rack, shelf). Use for 'where is', 'where can I find' or 'which shelf'.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Product name, common word for it, or SKU code.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_below_minimum",
    description:
      "List products whose stock is at or below the minimum level. Use for 'low stock', 'below minimum' or 'needs reordering'. Omit the category unless the user names a real product category.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description:
            "Optional real product category, for example 'Safety' or 'Packaging'. Omit it for a general low-stock question. Never pass 'None', 'all' or 'running low'.",
        },
      },
    },
  },
  {
    name: "get_receiving_schedule",
    description:
      "Deliveries expected on a day, with supplier and purchase order, or open deliveries that are late. Use for 'receiving schedule', 'what is arriving', 'deliveries due', and for anything 'late', 'overdue' or 'behind schedule'.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description:
            "'today', 'tomorrow', a date as YYYY-MM-DD, or 'overdue' for late deliveries that are behind schedule. Defaults to today.",
        },
      },
    },
  },
  {
    name: "get_po",
    description:
      "Details and lines of one purchase order. Use when the user gives a PO number.",
    parameters: {
      type: "object",
      properties: {
        po_number: {
          type: "string",
          description: "The purchase order number, for example '4471'.",
        },
      },
      required: ["po_number"],
    },
  },
  {
    name: "search_sops",
    description:
      "Search the warehouse procedures and safety documents. Use for any question about how to do something, rules, forms, PPE, safety or policy.",
    parameters: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The procedure or safety question, in the user's words.",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "not_warehouse",
    description:
      "Use only when the question is not about warehouse operations, stock, locations, deliveries, purchase orders or procedures. Do not use it for warehouse questions.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

export const TOOL_NAMES = COPILOT_TOOLS.map((tool) => tool.name);
