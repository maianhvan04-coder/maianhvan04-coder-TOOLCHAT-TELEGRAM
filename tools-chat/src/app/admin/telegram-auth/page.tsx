"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Phone,
  Shield,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import {
  telegramAuthApi,
  type TelegramAuthStep,
} from "@/app/api/telegram-auth.api";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type AuthStage = "PHONE" | "CODE" | "PASSWORD" | "READY";
type TelegramAccount = Record<string, unknown>;

type LogItem = {
  id: number;
  type: "success" | "error" | "info";
  text: string;
  time: string;
};

function nowTime() {
  return new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function mapResponseStep(step?: TelegramAuthStep): AuthStage | null {
  if (step === "PHONE") return "PHONE";
  if (step === "CODE") return "CODE";
  if (step === "PASSWORD") return "PASSWORD";
  if (step === "READY") return "READY";
  return null;
}

function extractAccountLabel(data?: TelegramAccount | null) {
  if (!data) return "Tài khoản Telegram";

  const firstName =
    typeof data.first_name === "string" ? data.first_name.trim() : "";
  const lastName =
    typeof data.last_name === "string" ? data.last_name.trim() : "";
  const username =
    typeof data.username === "string" ? data.username.trim() : "";
  const phoneNumber =
    typeof data.phone_number === "string" ? data.phone_number.trim() : "";

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName) return fullName;
  if (username) return `@${username}`;
  if (phoneNumber) return phoneNumber;

  return "Tài khoản Telegram";
}

function StepCard({
  active,
  done,
  title,
  desc,
  icon,
}: {
  active: boolean;
  done: boolean;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border p-4 transition",
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-lg"
          : done
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-slate-200 bg-white text-slate-700"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl",
            active
              ? "bg-white/15 text-white"
              : done
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-600"
          )}
        >
          {done ? <CheckCircle2 className="h-5 w-5" /> : icon}
        </div>

        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p
            className={cn(
              "mt-1 text-xs leading-5",
              active
                ? "text-slate-200"
                : done
                  ? "text-emerald-700"
                  : "text-slate-500"
            )}
          >
            {desc}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TelegramAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextUrl = searchParams.get("next") || "/admin/tracked-groups";

  const [stage, setStage] = useState<AuthStage>("PHONE");

  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const [phoneLoading, setPhoneLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [meLoading, setMeLoading] = useState(false);

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [accountInfo, setAccountInfo] = useState<TelegramAccount | null>(null);

  function pushLog(type: LogItem["type"], text: string) {
    setLogs((prev) => [
      {
        id: Date.now() + Math.floor(Math.random() * 1000),
        type,
        text,
        time: nowTime(),
      },
      ...prev,
    ]);
  }

  async function loadMe() {
    try {
      setMeLoading(true);

      const res = await telegramAuthApi.getMe();

      if (!res.ok || !res.data) {
        setAccountInfo(null);
        return null;
      }

      setAccountInfo(res.data);
      return res.data;
    } catch {
      setAccountInfo(null);
      return null;
    } finally {
      setMeLoading(false);
    }
  }

  async function syncStageFromStatus() {
    const status = await telegramAuthApi.getStatus();
    const nextStage = mapResponseStep(status.step) || "PHONE";
    setStage(nextStage);
    return nextStage;
  }

  async function finishReadyFlow(successMessage: string) {
    const status = await telegramAuthApi.waitForSteps(["READY"], {
      maxAttempts: 10,
      intervalMs: 500,
    });

    const nextStage =
      mapResponseStep(status.step) || (status.authorized ? "READY" : "PASSWORD");

    setStage(nextStage);

    if (nextStage !== "READY" && !status.authorized) {
      throw new Error(
        status.message || "Telegram chưa chuyển sang trạng thái READY."
      );
    }

    const me = await loadMe();

    toast.success(successMessage);
    pushLog(
      "success",
      `${successMessage}${me ? `: ${extractAccountLabel(me)}` : ""}`
    );

    router.replace(nextUrl);
  }

  useEffect(() => {
    let mounted = true;

    async function initStatus() {
      try {
        const res = await telegramAuthApi.getStatus();

        if (!mounted) return;

        const mapped = mapResponseStep(res.step) || "PHONE";
        setStage(mapped);

        if (mapped === "READY" || res.authorized) {
          const me = await loadMe();

          if (mounted) {
            pushLog(
              "info",
              `Đã phát hiện phiên Telegram đang sẵn sàng${me ? `: ${extractAccountLabel(me)}` : ""
              }`
            );
          }
        }
      } catch {
        if (mounted) {
          setStage("PHONE");
          setAccountInfo(null);
        }
      } finally {
        if (mounted) {
          setCheckingStatus(false);
        }
      }
    }

    void initStatus();

    return () => {
      mounted = false;
    };
  }, []);

  const progress = useMemo(() => {
    if (stage === "PHONE") return 25;
    if (stage === "CODE") return 60;
    if (stage === "PASSWORD") return 85;
    return 100;
  }, [stage]);

  async function handleSubmitPhone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const value = phoneNumber.trim();
    if (!value) {
      toast.error("Nhập số điện thoại trước");
      return;
    }

    try {
      setPhoneLoading(true);

      const res = await telegramAuthApi.sendPhone(value);
      const status = await telegramAuthApi.waitForSteps(
        ["CODE", "PASSWORD", "READY"],
        {
          maxAttempts: 6,
          intervalMs: 400,
        }
      );

      const nextStage = mapResponseStep(status.step) || "CODE";
      setStage(nextStage);

      toast.success(res.message || "Đã gửi số điện thoại");
      pushLog("success", `Gửi số điện thoại thành công: ${value}`);

      if (nextStage === "READY") {
        await finishReadyFlow("Đăng nhập Telegram thành công");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không gửi được số điện thoại";
      toast.error(message);
      pushLog("error", message);
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleSubmitCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const value = code.trim();
    if (!value) {
      toast.error("Nhập code trước");
      return;
    }

    try {
      setCodeLoading(true);

      const res = await telegramAuthApi.sendCode(value);
      const status = await telegramAuthApi.waitForSteps(
        ["PASSWORD", "READY"],
        {
          maxAttempts: 8,
          intervalMs: 450,
        }
      );

      const nextStage = mapResponseStep(status.step) || "CODE";
      setStage(nextStage);

      if (nextStage === "READY" || status.authorized) {
        await finishReadyFlow(res.message || "Đăng nhập Telegram thành công");
        return;
      }

      if (nextStage === "PASSWORD") {
        toast.success("Code đúng, tiếp tục nhập mật khẩu 2FA");
        pushLog("info", "Code hợp lệ, đang chờ nhập mật khẩu 2FA");
        return;
      }

      toast.success(res.message || "Xác nhận code thành công");
      pushLog("success", "Xác nhận code thành công");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không xác nhận được code";
      toast.error(message);
      pushLog("error", message);
    } finally {
      setCodeLoading(false);
    }
  }

  async function handleSubmitPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const value = password.trim();
    if (!value) {
      toast.error("Nhập mật khẩu 2FA trước");
      return;
    }

    try {
      setPasswordLoading(true);

      await telegramAuthApi.sendPassword(value);
      await finishReadyFlow("Đăng nhập Telegram thành công");
    } catch (error) {
      try {
        await syncStageFromStatus();
      } catch {
        setStage("PASSWORD");
      }

      const message =
        error instanceof Error ? error.message : "Không xác thực được mật khẩu";

      toast.error(message);
      pushLog("error", message);
    }
  }

  async function handleLogout() {
    const ok = window.confirm("Bạn có chắc muốn đăng xuất tài khoản Telegram?");
    if (!ok) return;

    try {
      setLogoutLoading(true);

      const res = await telegramAuthApi.logout();

      setStage("PHONE");
      setAccountInfo(null);
      setCode("");
      setPassword("");

      toast.success(res.message || "Đã đăng xuất Telegram");
      pushLog("success", "Đã đăng xuất tài khoản Telegram");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không đăng xuất được Telegram";
      toast.error(message);
      pushLog("error", message);
    } finally {
      setLogoutLoading(false);
    }
  }

  function handleContinue() {
    router.replace(nextUrl);
  }

  if (checkingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 text-white">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-900">
            Đang kiểm tra trạng thái Telegram
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Hệ thống đang đồng bộ trạng thái đăng nhập...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster richColors position="top-right" />

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              <ShieldCheck className="h-3.5 w-3.5" />
              Telegram Account Auth
            </div>

            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              Đăng nhập Telegram qua API
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Đăng nhập tài khoản Telegram trước khi truy cập trang tracked-groups
              và messages.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">
              Trạng thái hiện tại
            </p>
            <p className="mt-1 text-base font-bold text-slate-900">
              {stage === "PHONE" && "Chờ nhập số điện thoại"}
              {stage === "CODE" && "Chờ nhập mã code"}
              {stage === "PASSWORD" && "Chờ nhập mật khẩu 2FA"}
              {stage === "READY" && "Đã đăng nhập"}
            </p>
          </div>
        </div>

        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-2 w-full bg-slate-100">
            <div
              className="h-full rounded-r-full bg-slate-900 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-4 md:p-5">
            <StepCard
              active={stage === "PHONE"}
              done={stage !== "PHONE"}
              title="Bước 1"
              desc="Nhập số điện thoại Telegram"
              icon={<Phone className="h-5 w-5" />}
            />
            <StepCard
              active={stage === "CODE"}
              done={stage === "PASSWORD" || stage === "READY"}
              title="Bước 2"
              desc="Nhập code Telegram gửi về"
              icon={<KeyRound className="h-5 w-5" />}
            />
            <StepCard
              active={stage === "PASSWORD"}
              done={stage === "READY"}
              title="Bước 3"
              desc="Nhập mật khẩu 2FA nếu có"
              icon={<Lock className="h-5 w-5" />}
            />
            <StepCard
              active={stage === "READY"}
              done={stage === "READY"}
              title="Hoàn tất"
              desc="Tài khoản đã sẵn sàng"
              icon={<Shield className="h-5 w-5" />}
            />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            {stage === "READY" ? (
              <section className="rounded-[28px] border border-emerald-200 bg-white p-5 shadow-sm md:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Telegram đã sẵn sàng
                    </h2>
                    <p className="text-sm text-slate-500">
                      Bạn có thể đi tiếp vào hệ thống hoặc đăng xuất tài khoản hiện tại.
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        Tài khoản hiện tại
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {meLoading
                          ? "Đang tải thông tin..."
                          : extractAccountLabel(accountInfo)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleContinue}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Vào hệ thống
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={logoutLoading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {logoutLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang đăng xuất...
                      </>
                    ) : (
                      <>
                        <LogOut className="h-4 w-4" />
                        Đăng xuất Telegram
                      </>
                    )}
                  </button>
                </div>
              </section>
            ) : (
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Xác thực từng bước
                    </h2>
                    <p className="text-sm text-slate-500">
                      Hoàn thành từng bước để mở quyền vào tracked-groups và
                      messages.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <form
                    onSubmit={handleSubmitPhone}
                    className={cn(
                      "rounded-3xl border p-4",
                      stage === "PHONE"
                        ? "border-slate-900 bg-slate-900/5"
                        : "border-slate-200 bg-slate-50"
                    )}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-600" />
                      <p className="text-sm font-semibold text-slate-900">
                        Bước 1: Gửi số điện thoại
                      </p>
                    </div>

                    <input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+84999999999"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300"
                    />

                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={phoneLoading}
                        className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {phoneLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Đang gửi...
                          </>
                        ) : (
                          "Gửi số điện thoại"
                        )}
                      </button>
                    </div>
                  </form>

                  <form
                    onSubmit={handleSubmitCode}
                    className={cn(
                      "rounded-3xl border p-4",
                      stage === "CODE"
                        ? "border-slate-900 bg-slate-900/5"
                        : "border-slate-200 bg-slate-50"
                    )}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-slate-600" />
                      <p className="text-sm font-semibold text-slate-900">
                        Bước 2: Nhập mã xác nhận
                      </p>
                    </div>

                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="12345"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300"
                    />

                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={codeLoading}
                        className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {codeLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Đang xác nhận...
                          </>
                        ) : (
                          "Xác nhận code"
                        )}
                      </button>
                    </div>
                  </form>

                  <form
                    onSubmit={handleSubmitPassword}
                    className={cn(
                      "rounded-3xl border p-4",
                      stage === "PASSWORD"
                        ? "border-slate-900 bg-slate-900/5"
                        : "border-slate-200 bg-slate-50"
                    )}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Lock className="h-4 w-4 text-slate-600" />
                      <p className="text-sm font-semibold text-slate-900">
                        Bước 3: Nhập mật khẩu 2FA
                      </p>
                    </div>

                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="your_2fa_password"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300"
                    />

                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {passwordLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Đang xác thực...
                          </>
                        ) : (
                          "Xác nhận mật khẩu"
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            )}
          </div>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <h3 className="text-lg font-bold text-slate-900">
                Trạng thái nhanh
              </h3>

              <div className="mt-4 space-y-3">
                <div className="rounded-[22px] bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">
                    Tiến trình
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {progress}%
                  </p>
                </div>

                <div className="rounded-[22px] bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">
                    Bước hiện tại
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {stage}
                  </p>
                </div>

                <div
                  className={cn(
                    "rounded-[22px] p-4",
                    stage === "READY"
                      ? "bg-emerald-50 text-emerald-900"
                      : "bg-amber-50 text-amber-900"
                  )}
                >
                  <p className="text-xs font-medium opacity-80">Kết nối</p>
                  <p className="mt-1 text-base font-bold">
                    {stage === "READY"
                      ? "Telegram đã sẵn sàng"
                      : "Chưa hoàn tất"}
                  </p>
                </div>

                <div className="rounded-[22px] bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">
                    Điểm đến sau đăng nhập
                  </p>
                  <p className="mt-1 break-all text-sm font-semibold text-slate-900">
                    {nextUrl}
                  </p>
                </div>

                {stage === "READY" ? (
                  <div className="rounded-[22px] bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">
                      Tài khoản hiện tại
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {meLoading
                        ? "Đang tải thông tin..."
                        : extractAccountLabel(accountInfo)}
                    </p>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-900">
                  Nhật ký thao tác
                </h3>
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Xóa log
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {logs.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-900">
                      Chưa có log nào
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Log sẽ hiện sau mỗi lần gọi API.
                    </p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={cn(
                        "rounded-[20px] border px-4 py-3",
                        log.type === "success" &&
                        "border-emerald-200 bg-emerald-50 text-emerald-900",
                        log.type === "error" &&
                        "border-rose-200 bg-rose-50 text-rose-900",
                        log.type === "info" &&
                        "border-slate-200 bg-slate-50 text-slate-800"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{log.text}</p>
                        <span className="text-xs opacity-70">{log.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}