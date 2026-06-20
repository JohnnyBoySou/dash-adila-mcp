#!/usr/bin/env node
import { createClient } from "./client";
import { createDeployTool } from "./deploy";
import { createGetDeploymentTool, createListDeploymentsTool } from "./deployments";
import { createGetLogsTool } from "./logs";
import { createListProjectsTool, createListServicesTool } from "./projects";
import { runStdioServer } from "./server";
import { createGetUsageTool } from "./usage";

/**
 * Entrypoint do sidecar MCP da Adila.
 *
 * Lê a configuração do ambiente, monta o client HTTP autenticado pela chave de
 * API (`Authorization: Bearer ...`) e sobe o servidor stdio com os tools de
 * deploy + leitura (projetos, services, deploys, logs e uso).
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

runStdioServer({ name: "adila-mcp", version: "0.2.0" }, [
  createDeployTool(client),
  createListProjectsTool(client),
  createListServicesTool(client),
  createListDeploymentsTool(client),
  createGetDeploymentTool(client),
  createGetLogsTool(client),
  createGetUsageTool(client),
]);
