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
      "List products whose stock is at or below the minimum level. Use for 'low stock', 'below minimum' or 'needs reordering'.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional product category to limit the list.",
        },
      },
    },
  },
  {
    name: "get_receiving_schedule",
    description:
      "Deliveries expected on a day, with supplier and purchase order. Use for 'receiving schedule', 'what is arriving' or 'deliveries due'.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "'today', 'tomorrow' or a date as YYYY-MM-DD. Defaults to today.",
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
];

export const TOOL_NAMES = COPILOT_TOOLS.map((tool) => tool.name);
