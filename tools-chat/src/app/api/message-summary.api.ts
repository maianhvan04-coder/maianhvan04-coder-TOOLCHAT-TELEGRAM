import { http } from "@/lib/utils/http";

export type MessageSummaryRequest = {
  chatId: string;
  dayKey: string;
  title?: string;
  keyword?: string;
  senderId?: string;
};

export type SummaryParticipant = {
  name: string;
  count: number;
};

export type MessageSummaryData = {
  dayKey: string;
  chatId: string;
  title?: string;
  overview: string;
  highlights: string[];
  decisions: string[];
  actionItems: string[];
  risks: string[];
  participants: SummaryParticipant[];
  rawMessageCount: number;
  generatedBy?: "OLLAMA" | "FALLBACK" | string;
};

export type MessageSummaryResponse = {
  ok: boolean;
  data: MessageSummaryData;
  message?: string;
};

export const messageSummaryApi = {
  async summarizeDay(payload: MessageSummaryRequest) {
    const res = await http.post<MessageSummaryResponse>(
      "/api/messages/summary",
      payload
    );
    return res.data;
  },
};