import { createInterface } from "node:readline";

/**
 * Servidor MCP minimalista sobre stdio (JSON-RPC 2.0, uma mensagem por linha).
 *
 * Zero dependências: usa apenas `node:readline` e os globais do runtime (Bun).
 * O stdout é reservado ao protocolo — qualquer log vai para o stderr.
 */

/** Resultado de execução de um tool (mapeado para o envelope MCP `content`). */
export interface ToolResult {
  text: string;
  structured?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Dicas de comportamento do tool (MCP tool annotations). Apenas hints — o
 * cliente de IA pode usá-las para, por exemplo, pedir confirmação antes de uma
 * operação destrutiva. Não substituem a autorização real no control plane.
 */
export interface ToolAnnotations {
  /** Rótulo amigável exibido por alguns clientes. */
  title?: string;
  /** Só lê estado, não modifica nada. */
  readOnlyHint?: boolean;
  /** Pode apagar ou sobrescrever recursos de forma irreversível. */
  destructiveHint?: boolean;
  /** Chamar de novo com os mesmos argumentos não causa efeito adicional. */
  idempotentHint?: boolean;
}

/** Definição de um tool exposto via `tools/list` / `tools/call`. */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: ToolAnnotations;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ServerInfo {
  name: string;
  version: string;
}

/** Versão do protocolo MCP usada como fallback na negociação. */
const PROTOCOL_VERSION = "2024-11-05";

type JsonRpcId = string | number | null;

interface JsonRpcMessage {
  jsonrpc?: unknown;
  id?: JsonRpcId;
  method?: unknown;
  params?: unknown;
}

/** Erro de protocolo (vira um `error` JSON-RPC). Distinto de falha de tool. */
export class RpcError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

export function runStdioServer(info: ServerInfo, tools: McpTool[]): void {
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  const rl = createInterface({ input: process.stdin });

  // Encerra apenas quando o stdin fecha E não há requisições em andamento —
  // assim um `fetch` pendente nunca é cortado pelo EOF.
  let pending = 0;
  let stdinClosed = false;
  function maybeExit(): void {
    if (stdinClosed && pending === 0) process.exit(0);
  }

  rl.on("line", (line) => {
    void handleLine(line);
  });
  rl.on("close", () => {
    stdinClosed = true;
    maybeExit();
  });

  function send(message: unknown): void {
    process.stdout.write(`${JSON.stringify(message)}\n`);
  }

  function log(message: string): void {
    process.stderr.write(`[adila-mcp] ${message}\n`);
  }

  function replyResult(id: JsonRpcId, result: unknown): void {
    send({ jsonrpc: "2.0", id, result });
  }

  function replyError(id: JsonRpcId, code: number, message: string): void {
    send({ jsonrpc: "2.0", id, error: { code, message } });
  }

  async function handleLine(line: string): Promise<void> {
    const trimmed = line.trim();
    if (!trimmed) return;

    let msg: JsonRpcMessage;
    try {
      msg = JSON.parse(trimmed) as JsonRpcMessage;
    } catch {
      replyError(null, -32700, "Parse error");
      return;
    }

    if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
      if (msg.id !== undefined) replyError(msg.id ?? null, -32600, "Invalid Request");
      return;
    }

    // Sem `id` = notificação: processa, mas nunca responde.
    const isNotification = msg.id === undefined;
    pending += 1;
    try {
      const result = await dispatch(msg.method, msg.params);
      if (!isNotification) replyResult(msg.id ?? null, result);
    } catch (err) {
      const code = err instanceof RpcError ? err.code : -32603;
      const message = err instanceof RpcError ? err.message : "Internal error";
      if (!isNotification) replyError(msg.id ?? null, code, message);
      else log(`erro em notificação ${msg.method}: ${String(err)}`);
    } finally {
      pending -= 1;
      maybeExit();
    }
  }

  async function dispatch(method: string, params: unknown): Promise<unknown> {
    switch (method) {
      case "initialize":
        return {
          protocolVersion: requestedProtocol(params) ?? PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: info,
        };
      case "notifications/initialized":
        return undefined;
      case "ping":
        return {};
      case "tools/list":
        return {
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            ...(tool.annotations ? { annotations: tool.annotations } : {}),
          })),
        };
      case "tools/call":
        return callTool(params);
      default:
        throw new RpcError(-32601, `Method not found: ${method}`);
    }
  }

  async function callTool(params: unknown): Promise<unknown> {
    const p = (params ?? {}) as { name?: unknown; arguments?: unknown };
    if (typeof p.name !== "string") {
      throw new RpcError(-32602, "Parâmetro 'name' obrigatório.");
    }
    const tool = toolMap.get(p.name);
    if (!tool) {
      throw new RpcError(-32602, `Tool desconhecida: ${p.name}`);
    }
    const args =
      p.arguments && typeof p.arguments === "object"
        ? (p.arguments as Record<string, unknown>)
        : {};

    try {
      const result = await tool.handler(args);
      return {
        content: [{ type: "text", text: result.text }],
        ...(result.structured ? { structuredContent: result.structured } : {}),
        ...(result.isError ? { isError: true } : {}),
      };
    } catch (err) {
      // Falha de execução do tool é in-band (`isError`), não erro de protocolo.
      const message = err instanceof Error ? err.message : String(err);
      log(`falha no tool ${p.name}: ${message}`);
      return { content: [{ type: "text", text: message }], isError: true };
    }
  }

  log(`pronto (${info.name} v${info.version})`);
}

function requestedProtocol(params: unknown): string | null {
  if (params && typeof params === "object" && "protocolVersion" in params) {
    const value = (params as { protocolVersion?: unknown }).protocolVersion;
    return typeof value === "string" ? value : null;
  }
  return null;
}
