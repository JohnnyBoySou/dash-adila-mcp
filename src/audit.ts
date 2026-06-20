import { type AdilaClient, formatWhen, readPositiveInt, readString } from "./client";
import type { McpTool } from "./server";

interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditLogPage {
  logs: AuditLogEntry[];
  total: number;
}

function summarizeEntry(e: AuditLogEntry): string {
  const actor = e.actorName ?? e.actorEmail ?? e.actorUserId ?? "sistema";
  const target = e.targetType ? ` · ${e.targetType}${e.targetId ? ` ${e.targetId}` : ""}` : "";
  return `• ${formatWhen(e.createdAt)} — ${actor}: ${e.action}${target}`;
}

export function createListAuditLogsTool(client: AdilaClient): McpTool {
  return {
    name: "list_audit_logs",
    description:
      "Lista a trilha de auditoria da organização (quem fez o quê e quando), com " +
      "filtros opcionais por ação, tipo de alvo, ator e intervalo de datas. " +
      "Use para investigar mudanças recentes — ex.: quem disparou um deploy.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Máximo de registros a retornar (1–100)." },
        offset: { type: "number", description: "Deslocamento para paginação (>= 0)." },
        action: { type: "string", description: "Filtra por ação (ex.: `service.deploy`)." },
        targetType: { type: "string", description: "Filtra por tipo de alvo (ex.: `service`)." },
        actorUserId: { type: "string", description: "Filtra pelo ID do usuário que executou a ação." },
        from: { type: "string", description: "Data inicial (ISO 8601) inclusiva." },
        to: { type: "string", description: "Data final (ISO 8601) inclusiva." },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const page = await client.request<AuditLogPage>("GET", "/api/audit-logs", {
        query: {
          limit: readPositiveInt(args.limit),
          offset: readPositiveInt(args.offset),
          action: readString(args.action) || undefined,
          targetType: readString(args.targetType) || undefined,
          actorUserId: readString(args.actorUserId) || undefined,
          from: readString(args.from) || undefined,
          to: readString(args.to) || undefined,
        },
      });

      if (page.logs.length === 0) {
        return { text: "Nenhum registro de auditoria para os filtros informados." };
      }

      const lines = page.logs.map(summarizeEntry);
      return {
        text: `${page.logs.length} de ${page.total} registro(s):\n${lines.join("\n")}`,
        structured: { logs: page.logs, total: page.total },
      };
    },
  };
}

export type { AuditLogEntry };
