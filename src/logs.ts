import { type AdilaClient, formatWhen, readPositiveInt, readString } from "./client";
import type { McpTool } from "./server";

interface LogEntry {
  timestamp: string;
  message: string;
  severity: string;
}

interface ServiceLogs {
  deploymentId: string;
  provider: string;
  entries: LogEntry[];
}

export function createGetLogsTool(client: AdilaClient): McpTool {
  return {
    name: "get_logs",
    description:
      "Lê os logs do deploy atual de um service. `type` escolhe o fluxo: " +
      '"deploy" (runtime, padrão) ou "build". Aceita filtro de texto e janela temporal.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "ID do service." },
        type: {
          type: "string",
          enum: ["deploy", "build"],
          description: 'Fluxo de logs: "deploy" (runtime) ou "build". Padrão: deploy.',
        },
        limit: { type: "number", description: "Máximo de linhas a retornar (1–1000)." },
        filter: { type: "string", description: "Substring a filtrar nas mensagens (opcional)." },
        since: {
          type: "string",
          description: "ISO 8601 — retorna apenas linhas a partir deste instante (opcional).",
        },
      },
      required: ["serviceId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const serviceId = readString(args.serviceId);
      if (!serviceId) return { text: "Informe o serviceId.", isError: true };

      const type = readString(args.type) === "build" ? "build" : undefined;
      const filter = readString(args.filter) || undefined;
      const since = readString(args.since) || undefined;
      const limit = readPositiveInt(args.limit);

      const logs = await client.request<ServiceLogs>("GET", `/api/services/${serviceId}/logs`, {
        query: { type, limit, filter, since },
      });

      if (logs.entries.length === 0) {
        return { text: "Nenhuma linha de log no período/filtro informado." };
      }

      const lines = logs.entries.map(
        (e) => `[${formatWhen(e.timestamp)}] ${e.severity.toUpperCase()} ${e.message}`,
      );
      const header = `Logs (${type ?? "deploy"}) do deploy ${logs.deploymentId} via ${logs.provider}:`;
      return { text: `${header}\n${lines.join("\n")}`, structured: { logs } };
    },
  };
}
