import { http } from "@/lib/utils/http";

export type TelegramMessageItem = {
  _id?: string;
  chatId: string;
  messageId: string;
  date: number;
  dayKey: string;
  senderId?: string | null;
  senderType?: string | null;
  senderName?: string | null;
  text?: string | null;
  hasMedia?: boolean;
  mediaType?: string | null;
  raw?: Record<string, unknown> | null;
};

type ListMessagesResponse = {
  items: TelegramMessageItem[];
  total: number;
};

export const messageQueryApi = {
  async listByDay(params: {
    chatId: string;
    dayKey: string;
    keyword?: string;
    senderId?: string;
  }) {
    const res = await http.get<ListMessagesResponse>("/api/messages", {
      params,
    });
    return res.data;
  },

  getExportCsvUrl(params: {
    chatId: string;
    dayKey: string;
    keyword?: string;
    senderId?: string;
  }) {
    const baseURL =
      process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8080";

    const search = new URLSearchParams();
    search.set("chatId", params.chatId);
    search.set("dayKey", params.dayKey);

    if (params.keyword) search.set("keyword", params.keyword);
    if (params.senderId) search.set("senderId", params.senderId);

    return `${baseURL}/api/messages/export.csv?${search.toString()}`;
  },
};