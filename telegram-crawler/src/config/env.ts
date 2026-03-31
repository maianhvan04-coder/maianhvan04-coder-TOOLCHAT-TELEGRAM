import dotenv from "dotenv";

dotenv.config();

function toNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  port: toNumber(process.env.PORT, 8080),
  mongoUri:
    process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/telegram-crawler",
  dayTzOffsetMinutes: toNumber(process.env.DAY_TZ_OFFSET_MINUTES, 420),
  cronTimezone: process.env.CRON_TIMEZONE ?? "Asia/Ho_Chi_Minh",
  tdlibBridgeMode: process.env.TDLIB_BRIDGE_MODE ?? "http",
  tdlibBridgeUrl: process.env.TDLIB_BRIDGE_URL ?? "http://127.0.0.1:8088",

  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.1",
  ollamaTimeoutMs: toNumber(process.env.OLLAMA_TIMEOUT_MS, 120000),
};