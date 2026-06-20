import type { AdilaClient } from "./client";
import type { McpTool } from "./server";

interface UsageDimension {
  dimension: string;
  label: string;
  unit: string;
  used: number;
  included: number;
  cap: number;
  overageUnits: number;
  overageAmount: number;
}

interface BillingOverview {
  plan: { name: string } | null;
  subscription: { status: string } | null;
  usage: UsageDimension[];
}

function summarizeDimension(d: UsageDimension): string {
  const quota = d.included > 0 ? `${d.used}/${d.included} ${d.unit}` : `${d.used} ${d.unit}`;
  const overage =
    d.overageUnits > 0
      ? ` · excedente ${d.overageUnits} ${d.unit} (R$ ${(d.overageAmount / 100).toFixed(2)})`
      : "";
  return `• ${d.label}: ${quota}${overage}`;
}

export function createGetUsageTool(client: AdilaClient): McpTool {
  return {
    name: "get_usage",
    description:
      "Mostra o consumo da organização frente à cota do plano (por dimensão), " +
      "junto do plano e status da assinatura. Use para checar limites e excedentes.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const overview = await client.request<BillingOverview>("GET", "/api/billing/overview");

      const planLine = overview.plan
        ? `Plano: ${overview.plan.name}${overview.subscription ? ` (${overview.subscription.status})` : ""}`
        : "Sem plano ativo.";

      if (overview.usage.length === 0) {
        return { text: `${planLine}\nSem dados de uso por dimensão.`, structured: { overview } };
      }

      const lines = overview.usage.map(summarizeDimension);
      return { text: `${planLine}\n\nUso:\n${lines.join("\n")}`, structured: { overview } };
    },
  };
}
