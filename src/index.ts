#!/usr/bin/env node
import { createDeployTool } from "./deploy";
import { runStdioServer } from "./server";

/**
 * Entrypoint do sidecar MCP da Adila.
 *
 * Lê a configuração do ambiente e sobe o servidor stdio com o tool `deploy`,
 * que encaminha para `POST /api/deploy` do control plane autenticando com a
 * chave de API (`Authorization: Bearer ...`).
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

runStdioServer({ name: "adila-mcp", version: "0.1.0" }, [
  createDeployTool({ apiUrl, apiKey }),
]);
