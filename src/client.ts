/**
 * Client HTTP fino do control plane da Adila.
 *
 * Centraliza a autenticação (chave de API no header `Authorization: Bearer`),
 * a montagem de querystring e o desempacotamento do envelope padrão
 * (`{ success, data, error, meta }`). Todos os tools reutilizam isto para não
 * repetir fetch + parsing. A chave só trafega no header — nunca é logada.
 */

export interface ClientConfig {
  apiUrl: string;
  apiKey: string;
}

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
}

/** Envelope padrão do control plane. */
interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: { message?: string } | null;
  meta?: { pagination?: { total?: number; hasMore?: boolean } } | null;
}

export interface AdilaClient {
  /** Executa uma requisição e devolve `data` já desempacotado. Lança em falha. */
  request<T = unknown>(method: string, path: string, opts?: RequestOptions): Promise<T>;
}

export function createClient(config: ClientConfig): AdilaClient {
  const base = config.apiUrl.replace(/\/+$/, "");

  return {
    async request<T>(method: string, path: string, opts?: RequestOptions): Promise<T> {
      const url = new URL(base + path);
      if (opts?.query) {
        for (const [key, value] of Object.entries(opts.query)) {
          if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
          }
        }
      }

      const hasBody = opts?.body !== undefined;
      let response: Response;
      try {
        response = await fetch(url, {
          method,
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            ...(hasBody ? { "content-type": "application/json" } : {}),
          },
          body: hasBody ? JSON.stringify(opts?.body) : undefined,
        });
      } catch {
        throw new Error(`Falha ao contatar o control plane em ${base}.`);
      }

      const text = await response.text();
      let envelope: ApiEnvelope<T> | null = null;
      if (text) {
        try {
          envelope = JSON.parse(text) as ApiEnvelope<T>;
        } catch {
          throw new Error(`Resposta inválida do control plane (HTTP ${response.status}).`);
        }
      }

      if (!response.ok || !envelope?.success) {
        const message =
          envelope?.error?.message ?? `Requisição recusada (HTTP ${response.status}).`;
        throw new Error(message);
      }

      return envelope.data as T;
    },
  };
}

/** Lê um argumento como string aparada; "" quando ausente/inválido. */
export function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Lê um argumento como inteiro positivo; `undefined` quando ausente/inválido. */
export function readPositiveInt(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(readString(value));
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** Formata um ISO/Date para algo legível e curto, ou "—" quando ausente. */
export function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace("T", " ").replace(/\.\d+Z?$/, "").replace(/Z$/, " UTC");
}
