import { type AdilaClient, formatWhen, readPositiveInt, readString } from "./client";
import type { McpTool } from "./server";

/**
 * Build = etapa de construção da imagem (clone + build no agent), distinta do
 * deploy (release de compute). Um deploy consome a imagem de um build.
 */
interface Build {
  id: string;
  serviceId: string;
  status: string;
  externalId: string | null;
  imageRef: string | null;
  commitSha: string | null;
  branch: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

function summarizeBuild(b: Build): string {
  const ref = b.commitSha ? ` ${b.commitSha.slice(0, 7)}` : "";
  const branch = b.branch ? `@${b.branch}` : "";
  const err = b.error ? ` · erro: ${b.error}` : "";
  return `• ${b.status} — ${b.id}${branch}${ref} · ${formatWhen(b.createdAt)}${err}`;
}

export function createListBuildsTool(client: AdilaClient): McpTool {
  return {
    name: "list_builds",
    description:
      "Lista o histórico de builds (construção da imagem) de um service, com status, " +
      "branch/commit e imagem gerada. Complementa `get_logs type=build`. Use o " +
      "`serviceId` de `list_services`.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "ID do service." },
        limit: { type: "number", description: "Máximo de builds a retornar (1–100)." },
      },
      required: ["serviceId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const serviceId = readString(args.serviceId);
      if (!serviceId) return { text: "Informe o serviceId.", isError: true };
      const limit = readPositiveInt(args.limit);

      const builds = await client.request<Build[]>("GET", `/api/services/${serviceId}/builds`, {
        query: { limit },
      });

      if (builds.length === 0) {
        return { text: "Nenhum build registrado para este service." };
      }

      const lines = builds.map(summarizeBuild);
      return {
        text: `${builds.length} build(s):\n${lines.join("\n")}`,
        structured: { builds },
      };
    },
  };
}

export type { Build };
