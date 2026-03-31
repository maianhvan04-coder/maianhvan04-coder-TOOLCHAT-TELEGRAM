import { env } from "../../config/env.js";

export type TdRequest = Record<string, unknown>;
export type TdResponse = Record<string, unknown>;

export interface TelegramClient {
  invoke<T extends TdResponse = TdResponse>(payload: TdRequest): Promise<T>;
}

class HttpTdlibClient implements TelegramClient {
  constructor(private readonly baseUrl: string) {}

  async invoke<T extends TdResponse = TdResponse>(
    payload: TdRequest
  ): Promise<T> {
    const url = this.baseUrl.endsWith("/invoke")
      ? this.baseUrl
      : `${this.baseUrl}/invoke`;

    let res: Response;

    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown fetch error";

      throw new Error(`TDLib bridge fetch failed: ${message}`);
    }

    const rawText = await res.text();

    if (!res.ok) {
      throw new Error(`TDLib bridge HTTP ${res.status}: ${rawText}`);
    }

    let parsed: unknown;

    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error(`TDLib bridge trả về không phải JSON: ${rawText}`);
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      "@type" in parsed &&
      (parsed as Record<string, unknown>)["@type"] === "error"
    ) {
      const code =
        typeof (parsed as Record<string, unknown>).code === "number"
          ? (parsed as Record<string, unknown>).code
          : undefined;

      const message =
        typeof (parsed as Record<string, unknown>).message === "string"
          ? String((parsed as Record<string, unknown>).message)
          : "TDLib returned error";

      throw new Error(
        code ? `TDLib error ${code}: ${message}` : `TDLib error: ${message}`
      );
    }

    return parsed as T;
  }
}

class StubTdlibClient implements TelegramClient {
  async invoke<T extends TdResponse = TdResponse>(
    _payload: TdRequest
  ): Promise<T> {
    throw new Error(
      "TDLib client chưa được cấu hình. Hãy nối bridge vào TDLIB_BRIDGE_URL."
    );
  }
}

export const telegramClient: TelegramClient =
  env.tdlibBridgeMode === "http"
    ? new HttpTdlibClient(env.tdlibBridgeUrl)
    : new StubTdlibClient();