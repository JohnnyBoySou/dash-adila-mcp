import { type AdilaClient, readPositiveInt, readString } from "./client";
import type { McpTool } from "./server";

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  createdAt: string;
}

interface Environment {
  id: string;
  name: string;
  slug: string;
  type: string;
}

interface Service {
  id: string;
  name: string;
  slug: string;
  type: string;
}

export function createListProjectsTool(client: AdilaClient): McpTool {
  return {
    name: "list_projects",
    description:
      "Lista os projetos da organização da chave de API. Use para descobrir IDs " +
      "de projeto antes de inspecionar ambientes, services ou uso.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Máximo de projetos a retornar (1–100). Padrão do control plane.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const limit = readPositiveInt(args.limit);
      const projects = await client.request<Project[]>("GET", "/api/projects", {
        query: { limit },
      });

      if (projects.length === 0) {
        return { text: "Nenhum projeto encontrado nesta organização." };
      }

      const lines = projects.map(
        (p) => `• ${p.name} (${p.id}) — ${p.status}${p.description ? ` · ${p.description}` : ""}`,
      );
      return {
        text: `${projects.length} projeto(s):\n${lines.join("\n")}`,
        structured: { projects },
      };
    },
  };
}

export function createListServicesTool(client: AdilaClient): McpTool {
  return {
    name: "list_services",
    description:
      "Lista os services de um projeto, agrupados por ambiente. Devolve os IDs " +
      "de service usados em `deploy`, `list_deployments` e `get_logs`.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID do projeto a inspecionar." },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const projectId = readString(args.projectId);
      if (!projectId) return { text: "Informe o projectId.", isError: true };

      const environments = await client.request<Environment[]>(
        "GET",
        `/api/projects/${projectId}/environments`,
      );

      if (environments.length === 0) {
        return { text: "Este projeto não tem ambientes." };
      }

      const blocks: string[] = [];
      const collected: Array<{ environment: Environment; services: Service[] }> = [];

      for (const env of environments) {
        const services = await client.request<Service[]>(
          "GET",
          `/api/environments/${env.id}/services`,
        );
        collected.push({ environment: env, services });

        const header = `${env.name} [${env.type}] (${env.id})`;
        if (services.length === 0) {
          blocks.push(`${header}\n    (sem services)`);
          continue;
        }
        const items = services.map((s) => `    • ${s.name} [${s.type}] — ${s.id}`);
        blocks.push(`${header}\n${items.join("\n")}`);
      }

      return { text: blocks.join("\n\n"), structured: { environments: collected } };
    },
  };
}

export type { Project, Environment, Service };
