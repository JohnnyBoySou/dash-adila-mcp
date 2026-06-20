import { type AdilaClient, formatWhen, readString } from "./client";
import type { McpTool } from "./server";

/** Tipos de ambiente aceitos pelo control plane. */
const ENVIRONMENT_TYPES = ["production", "staging", "development", "preview"] as const;

interface EnvironmentDetail {
  id: string;
  projectId?: string;
  name: string;
  slug: string;
  type: string;
  isEphemeral?: boolean | null;
  gitBranch?: string | null;
  prNumber?: number | null;
  autoDeploy?: boolean | null;
  isProtected?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
}

function describeEnvironment(e: EnvironmentDetail): string {
  const flags = [
    e.isEphemeral ? "efêmero" : null,
    e.autoDeploy ? "auto-deploy" : null,
    e.isProtected ? "protegido" : null,
  ].filter(Boolean);
  const rows = [
    `Ambiente ${e.name} [${e.type}]`,
    `ID: ${e.id} · slug: ${e.slug}`,
    `Branch: ${e.gitBranch ?? "—"}${e.prNumber ? ` · PR #${e.prNumber}` : ""}`,
    `Flags: ${flags.length > 0 ? flags.join(", ") : "—"}`,
  ];
  if (e.createdAt) rows.push(`Criado: ${formatWhen(e.createdAt)}`);
  return rows.join("\n");
}

/** Coleta os campos opcionais comuns de create/update num corpo de requisição. */
function collectEnvironmentBody(args: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const gitBranch = readString(args.gitBranch);
  if (gitBranch) body.gitBranch = gitBranch;
  if (typeof args.prNumber === "number") body.prNumber = args.prNumber;
  for (const key of ["isEphemeral", "autoDeploy", "isProtected"] as const) {
    if (typeof args[key] === "boolean") body[key] = args[key];
  }
  return body;
}

const ENVIRONMENT_FLAG_PROPS = {
  isEphemeral: { type: "boolean", description: "Ambiente efêmero (descartável, ex.: preview de PR)." },
  gitBranch: { type: "string", description: "Branch git que alimenta o ambiente." },
  prNumber: { type: "number", description: "Número do PR associado (ambientes de preview)." },
  autoDeploy: { type: "boolean", description: "Dispara deploy automático a cada push." },
  isProtected: { type: "boolean", description: "Protege contra exclusão acidental." },
} as const;

export function createCreateEnvironmentTool(client: AdilaClient): McpTool {
  return {
    name: "create_environment",
    description:
      "Cria um ambiente dentro de um projeto (ex.: staging, preview). Informe o " +
      "`projectId` (de `list_projects`), um `name` e o `type`.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID do projeto onde criar o ambiente." },
        name: { type: "string", description: "Nome do ambiente (1–120 caracteres)." },
        type: {
          type: "string",
          enum: [...ENVIRONMENT_TYPES],
          description: "Tipo do ambiente.",
        },
        ...ENVIRONMENT_FLAG_PROPS,
      },
      required: ["projectId", "name", "type"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const projectId = readString(args.projectId);
      const name = readString(args.name);
      const type = readString(args.type);
      if (!projectId) return { text: "Informe o projectId.", isError: true };
      if (!name) return { text: "Informe o name do ambiente.", isError: true };
      if (!type) return { text: "Informe o type do ambiente.", isError: true };

      const body = { name, type, ...collectEnvironmentBody(args) };
      const environment = await client.request<EnvironmentDetail>(
        "POST",
        `/api/projects/${projectId}/environments`,
        { body },
      );
      return {
        text: `Ambiente criado:\n${describeEnvironment(environment)}`,
        structured: { environment },
      };
    },
  };
}

export function createUpdateEnvironmentTool(client: AdilaClient): McpTool {
  return {
    name: "update_environment",
    description:
      "Atualiza um ambiente (nome, tipo, branch, auto-deploy, proteção…). Só os " +
      "campos informados são alterados. Use o `environmentId` de `list_services`.",
    inputSchema: {
      type: "object",
      properties: {
        environmentId: { type: "string", description: "ID do ambiente a atualizar." },
        name: { type: "string", description: "Novo nome (1–120 caracteres)." },
        type: {
          type: "string",
          enum: [...ENVIRONMENT_TYPES],
          description: "Novo tipo do ambiente.",
        },
        ...ENVIRONMENT_FLAG_PROPS,
      },
      required: ["environmentId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const environmentId = readString(args.environmentId);
      if (!environmentId) return { text: "Informe o environmentId.", isError: true };

      const body = collectEnvironmentBody(args);
      const name = readString(args.name);
      if (name) body.name = name;
      const type = readString(args.type);
      if (type) body.type = type;

      if (Object.keys(body).length === 0) {
        return { text: "Informe ao menos um campo para atualizar.", isError: true };
      }

      const environment = await client.request<EnvironmentDetail>(
        "PATCH",
        `/api/environments/${environmentId}`,
        { body },
      );
      return {
        text: `Ambiente atualizado:\n${describeEnvironment(environment)}`,
        structured: { environment },
      };
    },
  };
}

export function createDeleteEnvironmentTool(client: AdilaClient): McpTool {
  return {
    name: "delete_environment",
    description:
      "Exclui um ambiente e tudo dentro dele (services, deploys, recursos). " +
      "Ação irreversível — confirme com o usuário antes de chamar.",
    annotations: { destructiveHint: true },
    inputSchema: {
      type: "object",
      properties: {
        environmentId: { type: "string", description: "ID do ambiente a excluir." },
      },
      required: ["environmentId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const environmentId = readString(args.environmentId);
      if (!environmentId) return { text: "Informe o environmentId.", isError: true };

      await client.request<{ id: string }>("DELETE", `/api/environments/${environmentId}`);
      return {
        text: `Ambiente ${environmentId} excluído.`,
        structured: { id: environmentId },
      };
    },
  };
}

export type { EnvironmentDetail };
