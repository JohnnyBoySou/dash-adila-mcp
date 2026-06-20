import { type AdilaClient, formatWhen, readPositiveInt, readString } from "./client";
import type { McpTool } from "./server";

interface MetricSample {
  resourceId: string;
  kind: string;
  status: string;
  cpuPercent: number | null;
  memoryBytes: number | null;
  memoryLimitBytes: number | null;
  diskBytes: number | null;
  uptimeSeconds: number | null;
  collectedAt: string;
}

interface ResourceMetrics {
  resourceId: string;
  history: MetricSample[];
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
}

function summarizeResource(rm: ResourceMetrics): string {
  const latest = rm.history[0];
  if (!latest) return `• ${rm.resourceId}: sem amostras`;
  const cpu = latest.cpuPercent == null ? "—" : `${latest.cpuPercent.toFixed(1)}%`;
  const mem = `${formatBytes(latest.memoryBytes)} / ${formatBytes(latest.memoryLimitBytes)}`;
  const uptime = latest.uptimeSeconds == null ? "" : ` · uptime ${Math.floor(latest.uptimeSeconds / 60)}min`;
  return (
    `• ${latest.kind} (${rm.resourceId}) — ${latest.status} · CPU ${cpu} · MEM ${mem}${uptime}` +
    ` · coletado ${formatWhen(latest.collectedAt)} · ${rm.history.length} amostra(s)`
  );
}

export function createGetMetricsTool(client: AdilaClient): McpTool {
  return {
    name: "get_metrics",
    description:
      "Mostra as métricas de uso (CPU, memória, disco, uptime) dos recursos de um " +
      "service — a amostra mais recente de cada recurso, com histórico opcional.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "ID do service." },
        limit: {
          type: "number",
          description: "Amostras por recurso a retornar (1–500). Padrão do control plane.",
        },
      },
      required: ["serviceId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const serviceId = readString(args.serviceId);
      if (!serviceId) return { text: "Informe o serviceId.", isError: true };
      const limit = readPositiveInt(args.limit);

      const resources = await client.request<ResourceMetrics[]>(
        "GET",
        `/api/services/${serviceId}/metrics`,
        { query: { limit } },
      );

      if (resources.length === 0) {
        return { text: "Nenhuma métrica disponível para este service ainda." };
      }

      const lines = resources.map(summarizeResource);
      return {
        text: `Métricas de ${resources.length} recurso(s):\n${lines.join("\n")}`,
        structured: { resources },
      };
    },
  };
}
