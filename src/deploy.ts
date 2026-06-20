import type { McpTool, ToolResult } from "./server";

/** Configuração resolvida do ambiente (URL do control plane + chave de API). */
export interface DeployConfig {
  apiUrl: string;
  apiKey: string;
}

/** Envelope padrão das respostas do control plane (`ok(...)` / `fail(...)`). */
interface ApiEnvelope {
  success?: boolean;
  data?: unknown;
  error?: { message?: string } | null;
}

interface DeployData {
  build: { id: string; status: string; branch?: string | null };
  service: { id: string; name: string };
}

function errorResult(text: string): ToolResult {
  return { text, isError: true };
}

export function createDeployTool(config: DeployConfig): McpTool {
  return {
    name: "deploy",
    description:
      "Dispara um deploy (build do repositório + deploy automático) de um service da Adila. " +
      "Identifique o alvo por `serviceId` OU pelo repositório `repo` (formato owner/name). " +
      "Use exatamente um dos dois.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: {
          type: "string",
          description: "ID do service a deployar.",
        },
        repo: {
          type: "string",
          description:
            "Repositório no formato owner/name (alternativa ao serviceId).",
        },
        branch: {
          type: "string",
          description: "Branch a buildar. Padrão: branch default do repositório.",
        },
        commitSha: {
          type: "string",
          description: "Commit específico a buildar (opcional).",
        },
      },
      additionalProperties: false,
    },
    handler: (args) => runDeploy(config, args),
  };
}

async function runDeploy(
  config: DeployConfig,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const serviceId = readString(args.serviceId);
  const repo = readString(args.repo);
  const branch = readString(args.branch);
  const commitSha = readString(args.commitSha);

  if (serviceId && repo) {
    return errorResult("Informe serviceId OU repo, não ambos.");
  }
  if (!serviceId && !repo) {
    return errorResult("Informe serviceId ou repo.");
  }

  const body: Record<string, string> = {};
  if (serviceId) body.serviceId = serviceId;
  if (repo) body.repo = repo;
  if (branch) body.branch = branch;
  if (commitSha) body.commitSha = commitSha;

  const url = `${config.apiUrl.replace(/\/+$/, "")}/api/deploy`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // A chave só trafega aqui, no header — nunca é logada.
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return errorResult(`Falha ao contatar o control plane em ${url}.`);
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope | null;

  if (!response.ok || !payload?.success) {
    const message =
      payload?.error?.message ?? `Deploy recusado (HTTP ${response.status}).`;
    return errorResult(message);
  }

  const data = payload.data as DeployData;
  const branchSuffix = data.build.branch ? ` na branch ${data.build.branch}` : "";
  const summary =
    `Deploy disparado para o service "${data.service.name}" (${data.service.id}). ` +
    `Build ${data.build.id} em status ${data.build.status}${branchSuffix}.`;

  return {
    text: summary,
    structured: { build: data.build, service: data.service },
  };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
