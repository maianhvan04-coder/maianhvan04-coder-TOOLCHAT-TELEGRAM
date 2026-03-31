"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, MessageSquare, Search } from "lucide-react";
import { Toaster, toast } from "sonner";
import {
  messageQueryApi,
  type TelegramMessageItem,
} from "@/app/api/message-query.api";

function formatUnix(unix?: number) {
  if (!unix) return "--";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(unix * 1000));
}

function getTodayDayKey() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const vn = new Date(utcMs + 7 * 60 * 60_000);
  return vn.toISOString().slice(0, 10);
}

function getMessageText(item: TelegramMessageItem) {
  return item.text?.trim() || "--";
}

export default function AdminMessagesPage() {
  const [chatId, setChatId] = useState("");
  const [dayKey, setDayKey] = useState(getTodayDayKey());
  const [keyword, setKeyword] = useState("");
  const [senderId, setSenderId] = useState("");

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<TelegramMessageItem[]>([]);
  const [total, setTotal] = useState(0);

  async function loadMessages(params?: {
    chatId?: string;
    dayKey?: string;
    keyword?: string;
    senderId?: string;
    showSuccess?: boolean;
  }) {
    const finalChatId = (params?.chatId ?? chatId).trim();
    const finalDayKey = (params?.dayKey ?? dayKey).trim();
    const finalKeyword = (params?.keyword ?? keyword).trim();
    const finalSenderId = (params?.senderId ?? senderId).trim();
    const showSuccess = params?.showSuccess ?? true;

    if (!finalChatId) {
      toast.error("Nhập chatId trước");
      return;
    }

    if (!finalDayKey) {
      toast.error("Nhập ngày trước");
      return;
    }

    try {
      setLoading(true);

      const res = await messageQueryApi.listByDay({
        chatId: finalChatId,
        dayKey: finalDayKey,
        keyword: finalKeyword || undefined,
        senderId: finalSenderId || undefined,
      });

      setItems(res.items ?? []);
      setTotal(res.total ?? 0);

      if (showSuccess) {
        toast.success(`Đã tải ${res.total ?? 0} tin nhắn`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không tải được tin nhắn";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await loadMessages();
  }

  const exportUrl = useMemo(() => {
    if (!chatId.trim() || !dayKey.trim()) return "";

    return messageQueryApi.getExportCsvUrl({
      chatId: chatId.trim(),
      dayKey: dayKey.trim(),
      keyword: keyword.trim() || undefined,
      senderId: senderId.trim() || undefined,
    });
  }, [chatId, dayKey, keyword, senderId]);

  return (
    <>
      <Toaster richColors position="top-right" />

      <div className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                  <MessageSquare className="h-4 w-4" />
                  Telegram Messages
                </div>

                <h1 className="mt-3 text-2xl font-bold text-slate-900 md:text-3xl">
                  Danh sách tin nhắn Telegram theo ngày
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Nhập chatId và ngày để xem tin nhắn đã crawl, lọc theo từ khóa
                  hoặc senderId, sau đó export CSV khi cần.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-semibold text-slate-900">Tổng kết quả</div>
                <div className="mt-1">
                  {loading ? "Đang tải..." : `${total} tin nhắn`}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <form
              onSubmit={handleSubmit}
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            >
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Chat ID
                </label>
                <input
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="-100xxxxxxxxxx"
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 outline-none transition focus:border-slate-300"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Ngày
                </label>
                <input
                  type="date"
                  value={dayKey}
                  onChange={(e) => setDayKey(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 outline-none transition focus:border-slate-300"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Từ khóa
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="lọc theo nội dung"
                    className="h-11 w-full rounded-2xl border border-slate-200 pl-11 pr-4 outline-none transition focus:border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Sender ID
                </label>
                <input
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  placeholder="lọc theo senderId"
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 outline-none transition focus:border-slate-300"
                />
              </div>

              <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang tải...
                    </>
                  ) : (
                    "Lấy danh sách tin nhắn"
                  )}
                </button>

                {exportUrl ? (
                  <a
                    href={exportUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Export CSV
                  </a>
                ) : null}
              </div>
            </form>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Kết quả</h2>
              <p className="mt-1 text-sm text-slate-500">
                Tổng: {total} tin nhắn
              </p>
            </div>

            {items.length === 0 ? (
              <div className="flex min-h-70 flex-col items-center justify-center px-6 py-10 text-center">
                <div className="rounded-3xl bg-slate-100 p-4 text-slate-500">
                  <MessageSquare className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  Chưa có dữ liệu
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Nhập chatId và ngày rồi bấm lấy danh sách để xem tin nhắn đã
                  crawl.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Thời gian
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Message ID
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Sender
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Nội dung
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Media
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item) => (
                      <tr key={item.messageId} className="align-top">
                        <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">
                          {formatUnix(item.date)}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">
                          {item.messageId}
                        </td>

                        <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">
                          <div>{item.senderName || "--"}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.senderId || "--"}
                          </div>
                        </td>

                        <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">
                          <div className="max-w-140 whitespace-pre-wrap wrap-break-word">
                            {getMessageText(item)}
                          </div>
                        </td>

                        <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">
                          {item.hasMedia ? item.mediaType || "Có media" : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}