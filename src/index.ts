#!/usr/bin/env node
import { createListAuditLogsTool } from "./audit";
import { createListBuildsTool } from "./builds";
import { createClient } from "./client";
import { createDeployTool } from "./deploy";
import { createGetDeploymentTool, createListDeploymentsTool } from "./deployments";
import {
  createCreateEnvironmentTool,
  createDeleteEnvironmentTool,
  createUpdateEnvironmentTool,
} from "./environments";
import { createGetLogsTool } from "./logs";
import { createGetMetricsTool } from "./metrics";
import { createListProjectsTool, createListServicesTool } from "./projects";
import {
  createCreateResourceTool,
  createDeleteResourceTool,
  createGetResourceTool,
  createListResourcesTool,
} from "./resources";
import { runStdioServer } from "./server";
import {
  createCreateServiceTool,
  createDeleteServiceTool,
  createGetServiceTool,
  createUpdateServiceTool,
} from "./services";
import { createGetProjectUsageTool, createGetUsageTool } from "./usage";

/**
 * Entrypoint do sidecar MCP da Adila.
 *
 * Lê a configuração do ambiente, monta o client HTTP autenticado pela chave de
 * API (`Authorization: Bearer ...`) e sobe o servidor stdio com os tools de
 * deploy, leitura (projetos, services, deploys, builds, logs, métricas, uso e
 * auditoria) e mutação de infraestrutura (services, recursos e ambientes).
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    process.stderr.write(`[adila-mcp] variável de ambiente ${name} é obrigatória.\n`);
    process.exit(1);
  }
  return value;
}

const apiUrl = requireEnv("ADILA_API_URL");
const apiKey = requireEnv("ADILA_API_KEY");
const client = createClient({ apiUrl, apiKey });

runStdioServer({ name: "adila-mcp", version: "0.3.0" }, [
  // Deploy
  createDeployTool(client),
  // Descoberta e leitura
  createListProjectsTool(client),
  createListServicesTool(client),
  createGetServiceTool(client),
  createListDeploymentsTool(client),
  createGetDeploymentTool(client),
  createListBuildsTool(client),
  createGetLogsTool(client),
  createGetMetricsTool(client),
  createListResourcesTool(client),
  createGetResourceTool(client),
  createListAuditLogsTool(client),
  createGetUsageTool(client),
  createGetProjectUsageTool(client),
  // Mutações de infraestrutura
  createCreateServiceTool(client),
  createUpdateServiceTool(client),
  createDeleteServiceTool(client),
  createCreateResourceTool(client),
  createDeleteResourceTool(client),
  createCreateEnvironmentTool(client),
  createUpdateEnvironmentTool(client),
  createDeleteEnvironmentTool(client),
]);
