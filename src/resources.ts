import { type AdilaClient, formatWhen, readString } from "./client";
import type { McpTool } from "./server";

/**
 * Recurso gerenciado (addon) provisionado para um service — ex.: Postgres ou
 * Redis. O tipo (kind) é derivado do tipo do service pelo control plane; aqui
 * só listamos/criamos/excluímos.
 */
interface Resource {
  id: string;
  serviceId: string;
  provider: string;
  status: string;
  externalId: string | null;
  region: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

function summarizeResource(r: Resource): string {
  const region = r.region ? ` · ${r.region}` : "";
  const err = r.error ? ` · erro: ${r.error}` : "";
  return `• ${r.provider} (${r.id}) — ${r.status}${region}${err}`;
}

export function createListResourcesTool(client: AdilaClient): McpTool {
  return {
    name: "list_resources",
    description:
      "Lista os recursos gerenciados (Postgres, Redis, storage…) de um service, " +
      "com provedor, status e região. Use o `serviceId` de `list_services`.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "ID do service." },
      },
      required: ["serviceId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const serviceId = readString(args.serviceId);
      if (!serviceId) return { text: "Informe o serviceId.", isError: true };

      const resources = await client.request<Resource[]>(
        "GET",
        `/api/services/${serviceId}/resources`,
      );

      if (resources.length === 0) {
        return { text: "Nenhum recurso gerenciado para este service." };
      }

      const lines = resources.map(summarizeResource);
      return {
        text: `${resources.length} recurso(s):\n${lines.join("\n")}`,
        structured: { resources },
      };
    },
  };
}

export function createGetResourceTool(client: AdilaClient): McpTool {
  return {
    name: "get_resource",
    description:
      "Detalha um recurso gerenciado: provedor, status, região, ID externo e erro " +
      "(se houver). Use o `resourceId` de `list_resources`.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        resourceId: { type: "string", description: "ID do recurso." },
      },
      required: ["resourceId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const resourceId = readString(args.resourceId);
      if (!resourceId) return { text: "Informe o resourceId.", isError: true };

      const r = await client.request<Resource>("GET", `/api/resources/${resourceId}`);
      const rows = [
        `Recurso ${r.id}`,
        `Service: ${r.serviceId}`,
        `Provedor: ${r.provider}`,
        `Status: ${r.status}`,
        `Região: ${r.region ?? "—"}`,
        `ID externo: ${r.externalId ?? "—"}`,
        `Criado: ${formatWhen(r.createdAt)} · atualizado: ${formatWhen(r.updatedAt)}`,
      ];
      if (r.error) rows.push(`Erro: ${r.error}`);
      return { text: rows.join("\n"), structured: { resource: r } };
    },
  };
}

export function createCreateResourceTool(client: AdilaClient): McpTool {
  return {
    name: "create_resource",
    description:
      "Provisiona um recurso gerenciado para um service (o tipo é derivado do tipo " +
      "do service — ex.: um service postgres ganha um banco). O provisionamento roda " +
      "assíncrono; consulte o status com `get_resource`.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "ID do service que receberá o recurso." },
        region: { type: "string", description: "Região de provisionamento (opcional)." },
      },
      required: ["serviceId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const serviceId = readString(args.serviceId);
      if (!serviceId) return { text: "Informe o serviceId.", isError: true };

      const region = readString(args.region);
      const resource = await client.request<Resource>(
        "POST",
        `/api/services/${serviceId}/resources`,
        { body: region ? { region } : {} },
      );
      return {
        text: `Provisionamento iniciado:\n${summarizeResource(resource)}`,
        structured: { resource },
      };
    },
  };
}

export function createDeleteResourceTool(client: AdilaClient): McpTool {
  return {
    name: "delete_resource",
    description:
      "Desprovisiona um recurso gerenciado (apaga o banco/cache e seus dados). " +
      "Ação irreversível — confirme com o usuário antes de chamar. Roda assíncrono.",
    annotations: { destructiveHint: true },
    inputSchema: {
      type: "object",
      properties: {
        resourceId: { type: "string", description: "ID do recurso a desprovisionar." },
      },
      required: ["resourceId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const resourceId = readString(args.resourceId);
      if (!resourceId) return { text: "Informe o resourceId.", isError: true };

      await client.request<{ id: string }>("DELETE", `/api/resources/${resourceId}`);
      return {
        text: `Desprovisionamento de ${resourceId} iniciado.`,
        structured: { id: resourceId },
      };
    },
  };
}

export type { Resource };
