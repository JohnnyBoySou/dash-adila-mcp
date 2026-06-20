import { readString, type AdilaClient } from "./client";
import type { McpTool, ToolResult } from "./server";

interface DeployData {
  build: { id: string; status: string; branch?: string | null };
  service: { id: string; name: string };
}

export function createDeployTool(client: AdilaClient): McpTool {
  return {
    name: "deploy",
    description:
      "Dispara um deploy (build do repositório + deploy automático) de um service da Adila. " +
      "Identifique o alvo por `serviceId` OU pelo repositório `repo` (formato owner/name). " +
      "Use exatamente um dos dois.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "ID do service a deployar." },
        repo: {
          type: "string",
          description: "Repositório no formato owner/name (alternativa ao serviceId).",
        },
        branch: {
          type: "string",
          description: "Branch a buildar. Padrão: branch default do repositório.",
        },
        commitSha: { type: "string", description: "Commit específico a buildar (opcional)." },
      },
      additionalProperties: false,
    },
    handler: (args) => runDeploy(client, args),
  };
}

async function runDeploy(
  client: AdilaClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const serviceId = readString(args.serviceId);
  const repo = readString(args.repo);
  const branch = readString(args.branch);
  const commitSha = readString(args.commitSha);

  if (serviceId && repo) {
    return { text: "Informe serviceId OU repo, não ambos.", isError: true };
  }
  if (!serviceId && !repo) {
    return { text: "Informe serviceId ou repo.", isError: true };
  }

  const body: Record<string, string> = {};
  if (serviceId) body.serviceId = serviceId;
  if (repo) body.repo = repo;
  if (branch) body.branch = branch;
  if (commitSha) body.commitSha = commitSha;

  const data = await client.request<DeployData>("POST", "/api/deploy", { body });

  const branchSuffix = data.build.branch ? ` na branch ${data.build.branch}` : "";
  const summary =
    `Deploy disparado para o service "${data.service.name}" (${data.service.id}). ` +
    `Build ${data.build.id} em status ${data.build.status}${branchSuffix}.`;

  return { text: summary, structured: { build: data.build, service: data.service } };
}
