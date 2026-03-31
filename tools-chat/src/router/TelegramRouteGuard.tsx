"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import {
  telegramAuthApi,
  type TelegramAuthStep,
} from "@/app/api/telegram-auth.api";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function TelegramRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [step, setStep] = useState<TelegramAuthStep>("UNKNOWN");

  useEffect(() => {
    let mounted = true;

    async function checkStatus() {
      try {
        const res = await telegramAuthApi.waitForSteps(["READY"], {
          maxAttempts: 10,
          intervalMs: 500,
        });

        if (!mounted) return;

        const isReady = Boolean(res.authorized) || res.step === "READY";

        setAuthorized(isReady);
        setStep(res.step);

        if (!isReady) {
          router.replace(
            `/admin/telegram-auth?next=${encodeURIComponent(pathname)}`
          );
        }
      } catch {
        if (!mounted) return;

        setAuthorized(false);
        setStep("UNKNOWN");
        router.replace(
          `/admin/telegram-auth?next=${encodeURIComponent(pathname)}`
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void checkStatus();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 text-white">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>

          <h2 className="mt-5 text-xl font-bold text-slate-900">
            Đang kiểm tra đăng nhập Telegram
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Hệ thống đang xác minh trạng thái tài khoản trước khi cho truy cập.
          </p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg rounded-[28px] border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-700">
            <LockKeyhole className="h-7 w-7" />
          </div>

          <h2 className="mt-5 text-xl font-bold text-slate-900">
            Bạn chưa đăng nhập Telegram
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Muốn vào trang này thì cần xác thực Telegram trước.
          </p>

          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Trạng thái hiện tại: <b>{step}</b>
          </div>

          <button
            type="button"
            onClick={() =>
              router.replace(
                `/admin/telegram-auth?next=${encodeURIComponent(pathname)}`
              )
            }
            className={cn(
              "mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-2xl",
              "bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            Đi tới đăng nhập Telegram
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}