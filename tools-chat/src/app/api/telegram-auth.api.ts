import { http } from "@/lib/utils/http";

export type TelegramAuthStep =
  | "PHONE"
  | "CODE"
  | "PASSWORD"
  | "READY"
  | "UNKNOWN";

export type TelegramAuthResponse = {
  ok: boolean;
  authorized: boolean;
  step: TelegramAuthStep;
  message?: string;
  data?: Record<string, unknown> | null;
};

export type TelegramProfile = {
  id: string | number | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  username: string | null;
  phoneNumber: string | null;
};

export type TelegramMeResponse = TelegramAuthResponse & {
  data: Record<string, unknown> | null;
  profile: TelegramProfile | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapTdTypeToStep(type?: string): TelegramAuthStep {
  switch (type) {
    case "authorizationStateWaitPhoneNumber":
      return "PHONE";
    case "authorizationStateWaitCode":
      return "CODE";
    case "authorizationStateWaitPassword":
      return "PASSWORD";
    case "authorizationStateReady":
      return "READY";
    default:
      return "UNKNOWN";
  }
}

function isKnownStep(value: unknown): value is TelegramAuthStep {
  return (
    value === "PHONE" ||
    value === "CODE" ||
    value === "PASSWORD" ||
    value === "READY" ||
    value === "UNKNOWN"
  );
}

function normalizeTelegramAuthResponse(payload: unknown): TelegramAuthResponse {
  const raw =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  const tdType =
    typeof raw["@type"] === "string" ? raw["@type"] : undefined;

  const rawStep = raw.step;
  const step = isKnownStep(rawStep) ? rawStep : mapTdTypeToStep(tdType);

  const authorized =
    typeof raw.authorized === "boolean"
      ? raw.authorized
      : step === "READY";

  const ok =
    typeof raw.ok === "boolean"
      ? raw.ok
      : tdType !== "error";

  const message =
    typeof raw.message === "string" ? raw.message : undefined;

  const nestedData =
    raw.data && typeof raw.data === "object"
      ? (raw.data as Record<string, unknown>)
      : null;

  const looksLikeWrappedResponse =
    "ok" in raw ||
    "authorized" in raw ||
    "step" in raw ||
    "message" in raw ||
    "data" in raw ||
    "profile" in raw;

  const directData =
    !looksLikeWrappedResponse && Object.keys(raw).length > 0 ? raw : null;

  return {
    ok,
    authorized,
    step,
    message,
    data: nestedData ?? directData,
  };
}

function normalizeTelegramProfile(payload: unknown): TelegramProfile | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const raw = payload as Record<string, unknown>;

  const id =
    typeof raw.id === "number" || typeof raw.id === "string"
      ? raw.id
      : null;

  const firstName =
    typeof raw.firstName === "string" ? raw.firstName : null;

  const lastName =
    typeof raw.lastName === "string" ? raw.lastName : null;

  const fullName =
    typeof raw.fullName === "string" ? raw.fullName : null;

  const username =
    typeof raw.username === "string" ? raw.username : null;

  const phoneNumber =
    typeof raw.phoneNumber === "string" ? raw.phoneNumber : null;

  if (
    id === null &&
    firstName === null &&
    lastName === null &&
    fullName === null &&
    username === null &&
    phoneNumber === null
  ) {
    return null;
  }

  return {
    id,
    firstName,
    lastName,
    fullName,
    username,
    phoneNumber,
  };
}

function normalizeTelegramMeResponse(payload: unknown): TelegramMeResponse {
  const raw =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  const base = normalizeTelegramAuthResponse(payload);

  const profile = normalizeTelegramProfile(raw.profile);

  const hasIdentity = Boolean(base.data || profile);

  return {
    ...base,
    ok: hasIdentity ? true : base.ok,
    authorized: hasIdentity ? true : base.authorized,
    step: hasIdentity && base.step === "UNKNOWN" ? "READY" : base.step,
    data: base.data ?? null,
    profile,
  };
}

export const telegramAuthApi = {
  async getStatus() {
    const res = await http.get("/api/telegram/status");
    return normalizeTelegramAuthResponse(res.data);
  },

  async sendPhone(phoneNumber: string) {
    const res = await http.post("/api/telegram/phone", { phoneNumber });
    return normalizeTelegramAuthResponse(res.data);
  },

  async sendCode(code: string) {
    const res = await http.post("/api/telegram/code", { code });
    return normalizeTelegramAuthResponse(res.data);
  },

  async sendPassword(password: string) {
    const res = await http.post("/api/telegram/password", { password });
    return normalizeTelegramAuthResponse(res.data);
  },

  async logout() {
    const res = await http.post("/api/telegram/logout");
    return normalizeTelegramAuthResponse(res.data);
  },

  async getMe() {
    const res = await http.get("/api/telegram/me");
    return normalizeTelegramMeResponse(res.data);
  },

  async waitForSteps(
    targetSteps: TelegramAuthStep[],
    options?: {
      maxAttempts?: number;
      intervalMs?: number;
    }
  ) {
    const maxAttempts = options?.maxAttempts ?? 8;
    const intervalMs = options?.intervalMs ?? 500;

    let last = await this.getStatus();

    if (
      targetSteps.includes(last.step) ||
      (targetSteps.includes("READY") && last.authorized)
    ) {
      return last;
    }

    for (let i = 1; i < maxAttempts; i += 1) {
      await sleep(intervalMs);
      last = await this.getStatus();

      if (
        targetSteps.includes(last.step) ||
        (targetSteps.includes("READY") && last.authorized)
      ) {
        return last;
      }
    }

    return last;
  },
};