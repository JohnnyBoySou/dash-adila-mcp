import { type AdilaClient, formatWhen, readPositiveInt, readString } from "./client";
import type { McpTool } from "./server";

interface Deployment {
  id: string;
  serviceId: string;
  provider: string | null;
  status: string;
  url: string | null;
  imageRef: string | null;
  replicas: number | null;
  commitSha: string | null;
  branch: string | null;
  isCurrent: boolean;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

function summarizeDeployment(d: Deployment): string {
  const current = d.isCurrent ? " ★ atual" : "";
  const ref = d.commitSha ? ` ${d.commitSha.slice(0, 7)}` : "";
  const branch = d.branch ? `@${d.branch}` : "";
  return `• ${d.status}${current} — ${d.id}${branch}${ref}${d.url ? ` · ${d.url}` : ""}`;
}

export function createListDeploymentsTool(client: AdilaClient): McpTool {
  return {
    name: "list_deployments",
    description:
      "Lista o histórico de deploys de um service (mais recentes primeiro), com " +
      "status, branch/commit, URL e qual está ativo. Use `serviceId` de `list_services`.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "ID do service." },
        limit: { type: "number", description: "Máximo de deploys a retornar (1–100)." },
      },
      required: ["serviceId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const serviceId = readString(args.serviceId);
      if (!serviceId) return { text: "Informe o serviceId.", isError: true };
      const limit = readPositiveInt(args.limit);

      const deployments = await client.request<Deployment[]>(
        "GET",
        `/api/services/${serviceId}/deployments`,
        { query: { limit } },
      );

      if (deployments.length === 0) {
        return { text: "Nenhum deploy registrado para este service." };
      }

      const lines = deployments.map(summarizeDeployment);
      return {
        text: `${deployments.length} deploy(s):\n${lines.join("\n")}`,
        structured: { deployments },
      };
    },
  };
}

export function createGetDeploymentTool(client: AdilaClient): McpTool {
  return {
    name: "get_deployment",
    description:
      "Detalha um deploy específico: status, imagem, réplicas, branch/commit, URL, " +
      "erro (se houver) e timestamps. Use o `deploymentId` de `list_deployments`.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        deploymentId: { type: "string", description: "ID do deploy." },
      },
      required: ["deploymentId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const deploymentId = readString(args.deploymentId);
      if (!deploymentId) return { text: "Informe o deploymentId.", isError: true };

      const d = await client.request<Deployment>("GET", `/api/deployments/${deploymentId}`);

      const rows = [
        `Deploy ${d.id}${d.isCurrent ? " (atual)" : ""}`,
        `Service: ${d.serviceId}`,
        `Status: ${d.status}`,
        `Provider: ${d.provider ?? "—"}`,
        `Branch/commit: ${d.branch ?? "—"}${d.commitSha ? ` · ${d.commitSha}` : ""}`,
        `Imagem: ${d.imageRef ?? "—"}`,
        `Réplicas: ${d.replicas ?? "—"}`,
        `URL: ${d.url ?? "—"}`,
        `Criado: ${formatWhen(d.createdAt)} · iniciado: ${formatWhen(d.startedAt)} · finalizado: ${formatWhen(d.finishedAt)}`,
      ];
      if (d.error) rows.push(`Erro: ${d.error}`);

      return { text: rows.join("\n"), structured: { deployment: d } };
    },
  };
}

export type { Deployment };
