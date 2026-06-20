import { type AdilaClient, readString } from "./client";
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
    annotations: { readOnlyHint: true },
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

interface ProjectMetric {
  resourceId: string;
  kind: string;
  memoryBytes: number | null;
  diskBytes: number | null;
}

interface ProjectUsage {
  resources: ProjectMetric[];
  totals: { resourceCount: number; memoryBytes: number; diskBytes: number };
}

function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
}

export function createGetProjectUsageTool(client: AdilaClient): McpTool {
  return {
    name: "get_project_usage",
    description:
      "Snapshot de uso de um projeto: memória e disco somados dos recursos, mais a " +
      "amostra mais recente por recurso. Granularidade por projeto que o `get_usage` " +
      "(organização) não tem. Use o `projectId` de `list_projects`.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID do projeto." },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const projectId = readString(args.projectId);
      if (!projectId) return { text: "Informe o projectId.", isError: true };

      const usage = await client.request<ProjectUsage>("GET", `/api/projects/${projectId}/usage`);
      const { totals, resources } = usage;

      const header =
        `${totals.resourceCount} recurso(s) · RAM ${formatBytes(totals.memoryBytes)} · ` +
        `disco ${formatBytes(totals.diskBytes)}`;

      if (resources.length === 0) {
        return { text: `${header}\nSem métricas de recursos ainda.`, structured: { usage } };
      }

      const lines = resources.map(
        (r) =>
          `• ${r.kind} (${r.resourceId}) — RAM ${formatBytes(r.memoryBytes ?? 0)} · ` +
          `disco ${formatBytes(r.diskBytes ?? 0)}`,
      );
      return { text: `${header}\n\n${lines.join("\n")}`, structured: { usage } };
    },
  };
}
