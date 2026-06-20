import { type AdilaClient, formatWhen, readString } from "./client";
import type { McpTool } from "./server";

/** Tipos de service aceitos pelo control plane. */
const SERVICE_TYPES = ["frontend", "backend", "app", "postgres", "redis", "storage"] as const;

interface ServiceDetail {
  id: string;
  environmentId: string;
  name: string;
  slug: string;
  type: string;
  githubRepositoryId: string | null;
  rootDirectory: string | null;
  startCommand: string | null;
  serverless: boolean | null;
  idleTimeoutMinutes: number | null;
  imageRef: string | null;
  status?: string | null;
  archived?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

function describeService(s: ServiceDetail): string {
  const rows = [
    `Service ${s.name} [${s.type}]${s.archived ? " (arquivado)" : ""}`,
    `ID: ${s.id} · slug: ${s.slug}`,
    `Ambiente: ${s.environmentId}`,
    `Status: ${s.status ?? "—"}`,
    `Repositório: ${s.githubRepositoryId ?? "—"}${s.rootDirectory ? ` · raiz: ${s.rootDirectory}` : ""}`,
    `Comando de start: ${s.startCommand ?? "—"}`,
    `Imagem: ${s.imageRef ?? "—"}`,
    `Serverless: ${s.serverless ? `sim (idle ${s.idleTimeoutMinutes ?? "—"}min)` : "não"}`,
    `Criado: ${formatWhen(s.createdAt)} · atualizado: ${formatWhen(s.updatedAt)}`,
  ];
  return rows.join("\n");
}

export function createGetServiceTool(client: AdilaClient): McpTool {
  return {
    name: "get_service",
    description:
      "Detalha um service: tipo, status, repositório, comando de start, imagem e " +
      "configuração serverless. Use o `serviceId` de `list_services`.",
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

      const service = await client.request<ServiceDetail>("GET", `/api/services/${serviceId}`);
      return { text: describeService(service), structured: { service } };
    },
  };
}

export function createCreateServiceTool(client: AdilaClient): McpTool {
  return {
    name: "create_service",
    description:
      "Cria um service dentro de um ambiente. Informe o `environmentId` (de " +
      "`list_services`), um `name` e o `type`. Para apps Docker (type=app) passe " +
      "`imageRef` ou `appTemplateId`; para frontend/backend, vincule `githubRepositoryId`.",
    inputSchema: {
      type: "object",
      properties: {
        environmentId: { type: "string", description: "ID do ambiente onde criar o service." },
        name: { type: "string", description: "Nome do service (1–120 caracteres)." },
        type: {
          type: "string",
          enum: [...SERVICE_TYPES],
          description: "Tipo do service.",
        },
        githubRepositoryId: {
          type: "string",
          description: "ID do repositório GitHub vinculado (frontend/backend).",
        },
        rootDirectory: { type: "string", description: "Subdiretório do repositório a usar como raiz." },
        startCommand: { type: "string", description: "Comando de inicialização (sobrescreve o padrão)." },
        serverless: { type: "boolean", description: "Habilita escala a zero quando ocioso." },
        idleTimeoutMinutes: {
          type: "number",
          description: "Minutos de ociosidade antes de hibernar (1–1440, requer serverless).",
        },
        imageRef: { type: "string", description: "Imagem Docker direta (type=app)." },
        appTemplateId: { type: "string", description: "ID do template de app a instanciar (type=app)." },
      },
      required: ["environmentId", "name", "type"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const environmentId = readString(args.environmentId);
      const name = readString(args.name);
      const type = readString(args.type);
      if (!environmentId) return { text: "Informe o environmentId.", isError: true };
      if (!name) return { text: "Informe o name do service.", isError: true };
      if (!type) return { text: "Informe o type do service.", isError: true };

      const body: Record<string, unknown> = { name, type };
      for (const key of [
        "githubRepositoryId",
        "rootDirectory",
        "startCommand",
        "imageRef",
        "appTemplateId",
      ] as const) {
        const value = readString(args[key]);
        if (value) body[key] = value;
      }
      if (typeof args.serverless === "boolean") body.serverless = args.serverless;
      if (typeof args.idleTimeoutMinutes === "number") body.idleTimeoutMinutes = args.idleTimeoutMinutes;

      const service = await client.request<ServiceDetail>(
        "POST",
        `/api/environments/${environmentId}/services`,
        { body },
      );
      return {
        text: `Service criado:\n${describeService(service)}`,
        structured: { service },
      };
    },
  };
}

export function createUpdateServiceTool(client: AdilaClient): McpTool {
  return {
    name: "update_service",
    description:
      "Atualiza a configuração de um service (nome, comando de start, serverless, " +
      "arquivamento etc.). Só os campos informados são alterados.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "ID do service a atualizar." },
        name: { type: "string", description: "Novo nome (1–120 caracteres)." },
        githubRepositoryId: { type: "string", description: "Novo repositório GitHub vinculado." },
        rootDirectory: { type: "string", description: "Novo subdiretório raiz." },
        startCommand: { type: "string", description: "Novo comando de inicialização." },
        serverless: { type: "boolean", description: "Habilita/desabilita escala a zero." },
        idleTimeoutMinutes: { type: "number", description: "Minutos de ociosidade (1–1440)." },
        archived: { type: "boolean", description: "Arquiva (true) ou restaura (false) o service." },
      },
      required: ["serviceId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const serviceId = readString(args.serviceId);
      if (!serviceId) return { text: "Informe o serviceId.", isError: true };

      const body: Record<string, unknown> = {};
      for (const key of ["name", "githubRepositoryId", "rootDirectory", "startCommand"] as const) {
        const value = readString(args[key]);
        if (value) body[key] = value;
      }
      for (const key of ["serverless", "archived"] as const) {
        if (typeof args[key] === "boolean") body[key] = args[key];
      }
      if (typeof args.idleTimeoutMinutes === "number") body.idleTimeoutMinutes = args.idleTimeoutMinutes;

      if (Object.keys(body).length === 0) {
        return { text: "Informe ao menos um campo para atualizar.", isError: true };
      }

      const service = await client.request<ServiceDetail>("PATCH", `/api/services/${serviceId}`, {
        body,
      });
      return {
        text: `Service atualizado:\n${describeService(service)}`,
        structured: { service },
      };
    },
  };
}

export function createDeleteServiceTool(client: AdilaClient): McpTool {
  return {
    name: "delete_service",
    description:
      "Exclui um service permanentemente, junto com seus deploys e recursos. " +
      "Ação irreversível — confirme com o usuário antes de chamar.",
    annotations: { destructiveHint: true },
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "ID do service a excluir." },
      },
      required: ["serviceId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const serviceId = readString(args.serviceId);
      if (!serviceId) return { text: "Informe o serviceId.", isError: true };

      await client.request<{ id: string }>("DELETE", `/api/services/${serviceId}`);
      return { text: `Service ${serviceId} excluído.`, structured: { id: serviceId } };
    },
  };
}

export type { ServiceDetail };
