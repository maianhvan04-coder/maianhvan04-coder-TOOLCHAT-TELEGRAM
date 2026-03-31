import mongoose from "mongoose";

type SummaryParticipant = {
  name: string;
  count: number;
};

export type DailyMessageSummary = {
  dayKey: string;
  chatId: string;
  title?: string | undefined;
  overview: string;
  highlights: string[];
  decisions: string[];
  actionItems: string[];
  risks: string[];
  participants: SummaryParticipant[];
  rawMessageCount: number;
  generatedBy: "OLLAMA" | "FALLBACK";
};

type SummarizeDayInput = {
  chatId: string;
  dayKey: string;
  keyword?: string | undefined;
  senderId?: string | undefined;
  title?: string | undefined;
};

type TelegramMessageDoc = {
  messageId?: number | string;
  senderId?: string | null;
  senderName?: string | null;
  text?: string | null;
  caption?: string | null;
  date?: number | null;
  mediaType?: string | null;
  chatId?: string;
  dayKey?: string;
};

type OllamaChatResponse = {
  message?: {
    role?: string;
    content?: string;
  };
  error?: string;
};

const IMPORTANT_PATTERNS = [
  /deadline|hạn|gấp|urgent|asap/i,
  /fix|bug|lỗi|error|issue/i,
  /deploy|release|ship|publish/i,
  /meeting|họp|call/i,
  /done|xong|ok|đã xong|hoàn thành/i,
  /check|xem lại|review|kiểm tra/i,
  /todo|to do|việc cần làm|task/i,
  /payment|thanh toán|bill|invoice/i,
];

const DECISION_PATTERNS = [
  /chốt|quyết định|decision|thống nhất|agree/i,
  /sẽ làm|will do|triển khai|đổi sang|change to|switch to/i,
];

const ACTION_PATTERNS = [
  /cần|phải|nhớ|please|check|review|fix|làm giúp|follow up|theo dõi/i,
];

const RISK_PATTERNS = [
  /trễ|muộn|delay|rủi ro|risk|block|blocked|kẹt|pending/i,
];

function getTelegramMessageModel() {
  return mongoose.model("TelegramMessage");
}

function formatTime(unix?: number | null): string {
  if (!unix) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(unix * 1000));
}

function normalizeMessageText(item: TelegramMessageDoc): string {
  const text = item.text?.trim() || item.caption?.trim() || "";
  if (text) return text;
  if (item.mediaType) return `[${item.mediaType}]`;
  return "";
}

function uniqKeepOrder(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of items) {
    const cleaned = item.trim();
    if (!cleaned) continue;
    if (seen.has(cleaned)) continue;

    seen.add(cleaned);
    output.push(cleaned);

    if (output.length >= limit) break;
  }

  return output;
}

function buildTranscript(messages: TelegramMessageDoc[], maxChars = 22000): string {
  const lines: string[] = [];
  let total = 0;

  for (const item of messages) {
    const text = normalizeMessageText(item);
    if (!text) continue;

    const line = `[${formatTime(item.date)}] ${
      item.senderName?.trim() || item.senderId?.trim() || "Unknown"
    }: ${text}`;

    if (total + line.length > maxChars) break;

    lines.push(line);
    total += line.length;
  }

  return lines.join("\n");
}

function topParticipants(messages: TelegramMessageDoc[]): SummaryParticipant[] {
  const counter = new Map<string, number>();

  for (const item of messages) {
    const name = item.senderName?.trim() || item.senderId?.trim() || "Unknown";
    counter.set(name, (counter.get(name) || 0) + 1);
  }

  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
}

function pickByPatterns(
  messages: TelegramMessageDoc[],
  patterns: RegExp[],
  limit: number
): string[] {
  const picked: string[] = [];

  for (const item of messages) {
    const text = normalizeMessageText(item);
    if (!text) continue;

    const matched = patterns.some((pattern) => pattern.test(text));
    if (!matched) continue;

    picked.push(
      `${formatTime(item.date)} • ${
        item.senderName?.trim() || item.senderId?.trim() || "Unknown"
      }: ${text}`
    );
  }

  return uniqKeepOrder(picked, limit);
}

function buildFallbackSummary(input: {
  dayKey: string;
  chatId: string;
  title?: string | undefined;
  messages: TelegramMessageDoc[];
}): DailyMessageSummary {
  const participants = topParticipants(input.messages);
  const highlights = pickByPatterns(input.messages, IMPORTANT_PATTERNS, 6);
  const decisions = pickByPatterns(input.messages, DECISION_PATTERNS, 4);
  const actionItems = pickByPatterns(input.messages, ACTION_PATTERNS, 5);
  const risks = pickByPatterns(input.messages, RISK_PATTERNS, 4);

  const overviewParts: string[] = [];
  overviewParts.push(
    `Ngày ${input.dayKey} có ${input.messages.length} tin nhắn trong ${
      input.title || input.chatId
    }.`
  );

  if (participants.length > 0) {
    overviewParts.push(
      `Hoạt động nhiều nhất: ${participants
        .slice(0, 3)
        .map((item) => `${item.name} (${item.count})`)
        .join(", ")}.`
    );
  }

  if (highlights.length > 0) {
    overviewParts.push(
      "Nội dung chủ yếu xoay quanh cập nhật công việc, trao đổi tiến độ và các đầu việc cần kiểm tra."
    );
  } else {
    overviewParts.push(
      "Cuộc trò chuyện chủ yếu là trao đổi ngắn, chưa có nhiều điểm nhấn rõ ràng."
    );
  }

  return {
    dayKey: input.dayKey,
    chatId: input.chatId,
    title: input.title,
    overview: overviewParts.join(" "),
    highlights,
    decisions,
    actionItems,
    risks,
    participants,
    rawMessageCount: input.messages.length,
    generatedBy: "FALLBACK",
  };
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Ollama không trả JSON hợp lệ");
  }

  return trimmed.slice(start, end + 1);
}

async function callOllama(params: {
  transcript: string;
  dayKey: string;
  chatId: string;
  title?: string | undefined;
  rawMessageCount: number;
}): Promise<Omit<DailyMessageSummary, "generatedBy">> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.1";
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      overview: { type: "string" },
      highlights: { type: "array", items: { type: "string" } },
      decisions: { type: "array", items: { type: "string" } },
      actionItems: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
      participants: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            count: { type: "number" },
          },
          required: ["name", "count"],
        },
      },
    },
    required: [
      "overview",
      "highlights",
      "decisions",
      "actionItems",
      "risks",
      "participants",
    ],
  };

  const systemPrompt = `
Bạn là AI chuyên tóm tắt tin nhắn Telegram theo ngày.

Yêu cầu:
- Chỉ dùng thông tin có trong transcript.
- Viết tiếng Việt rõ ràng, ngắn gọn.
- Không bịa.
- Nếu không có dữ liệu cho mục nào, trả về [].
- overview tối đa 4 câu.
- participants là người hoạt động nổi bật nhất trong ngày.
- Không trả markdown, không giải thích, chỉ trả JSON hợp lệ theo schema.
`.trim();

  const userPrompt = `
Group: ${params.title || params.chatId}
Chat ID: ${params.chatId}
Day: ${params.dayKey}
Messages: ${params.rawMessageCount}

Transcript:
${params.transcript}
`.trim();

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: schema,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const data = (await response.json()) as OllamaChatResponse;

    if (!response.ok) {
      throw new Error(data.error || `Ollama HTTP ${response.status}`);
    }

    const content = data.message?.content?.trim();
    if (!content) {
      throw new Error("Ollama không trả về nội dung");
    }

    const parsed = JSON.parse(extractJsonObject(content)) as {
      overview?: string;
      highlights?: string[];
      decisions?: string[];
      actionItems?: string[];
      risks?: string[];
      participants?: SummaryParticipant[];
    };

    return {
      dayKey: params.dayKey,
      chatId: params.chatId,
      title: params.title,
      overview: parsed.overview?.trim() || "Không có tổng quan.",
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      participants: Array.isArray(parsed.participants) ? parsed.participants : [],
      rawMessageCount: params.rawMessageCount,
    };
  } finally {
    clearTimeout(timer);
  }
}

export const messageSummaryService = {
  async summarizeDay(input: SummarizeDayInput): Promise<DailyMessageSummary> {
    const TelegramMessageModel = getTelegramMessageModel();

    const query: Record<string, unknown> = {
      chatId: input.chatId,
      dayKey: input.dayKey,
    };

    if (input.senderId?.trim()) {
      query.senderId = input.senderId.trim();
    }

    if (input.keyword?.trim()) {
      const keyword = input.keyword.trim();
      query.$or = [
        { text: { $regex: keyword, $options: "i" } },
        { caption: { $regex: keyword, $options: "i" } },
      ];
    }

    const messages = (await TelegramMessageModel.find(query)
      .sort({ date: 1, _id: 1 })
      .lean()) as TelegramMessageDoc[];

    if (!messages.length) {
      return {
        dayKey: input.dayKey,
        chatId: input.chatId,
        title: input.title,
        overview: "Không có tin nhắn để tóm tắt trong ngày này.",
        highlights: [],
        decisions: [],
        actionItems: [],
        risks: [],
        participants: [],
        rawMessageCount: 0,
        generatedBy: "FALLBACK",
      };
    }

    const transcript = buildTranscript(messages);
    const fallback = buildFallbackSummary({
      dayKey: input.dayKey,
      chatId: input.chatId,
      title: input.title,
      messages,
    });

    try {
      const ollamaResult = await callOllama({
        transcript,
        dayKey: input.dayKey,
        chatId: input.chatId,
        title: input.title,
        rawMessageCount: messages.length,
      });

      return {
        ...ollamaResult,
        generatedBy: "OLLAMA",
      };
    } catch {
      return fallback;
    }
  },
};