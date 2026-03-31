import { TelegramMessageModel } from "../message-crawler/telegram-message.model";

export const messageQueryService = {
  async listByGroupAndDay(params: {
    chatId: string;
    dayKey: string;
    keyword?: string;
    senderId?: string;
  }) {
    const query: Record<string, unknown> = {
      chatId: params.chatId,
      dayKey: params.dayKey
    };

    if (params.keyword?.trim()) {
      query.text = {
        $regex: params.keyword.trim(),
        $options: "i"
      };
    }

    if (params.senderId?.trim()) {
      query.senderId = params.senderId.trim();
    }

    return TelegramMessageModel.find(query).sort({ date: 1 }).lean();
  },

  async exportCsv(params: {
    chatId: string;
    dayKey: string;
    keyword?: string;
    senderId?: string;
  }): Promise<string> {
    const rows = await this.listByGroupAndDay(params);

    const header = [
      "chatId",
      "messageId",
      "dayKey",
      "date",
      "senderId",
      "senderType",
      "text"
    ];

    const escapeCsv = (value: unknown) => {
      const text = String(value ?? "").replace(/"/g, '""');
      return `"${text}"`;
    };

    const dataLines = rows.map((row) =>
      [
        row.chatId,
        row.messageId,
        row.dayKey,
        row.date,
        row.senderId,
        row.senderType,
        row.text
      ]
        .map(escapeCsv)
        .join(",")
    );

    return `\uFEFF${[header.join(","), ...dataLines].join("\n")}`;
  }
};