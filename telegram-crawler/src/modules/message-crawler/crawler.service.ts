import { env } from "../../config/env";
import { telegramClient } from "../../core/tdlib/telegram.client";
import { getDayRangeUnix, toDayKeyFromUnix } from "../../shared/utils/day";
import { TrackedGroupModel } from "../tracked-groups/tracked-group.model";
import { CrawlJobModel } from "./crawl-job.model";
import { TelegramMessageModel } from "./telegram-message.model";

type TdMessageSender =
  | { "@type": "messageSenderUser"; user_id: number | string }
  | { "@type": "messageSenderChat"; chat_id: number | string }
  | Record<string, unknown>;

type TdFormattedText = {
  text?: string;
};

type TdMessageContent = {
  "@type"?: string;
  text?: TdFormattedText;
  caption?: TdFormattedText;
};

type TdMessage = {
  id: number | string;
  date: number;
  sender_id?: TdMessageSender;
  content?: TdMessageContent;
};

type TdMessagesResult = {
  messages?: TdMessage[];
};

type TdUser = {
  first_name?: string;
  last_name?: string;
  usernames?: {
    active_usernames?: string[];
  };
};

type TdChat = {
  title?: string;
};

function parseSender(sender: TdMessageSender | undefined): {
  senderId: string | null;
  senderType: "USER" | "CHAT" | null;
} {
  if (!sender || typeof sender !== "object") {
    return {
      senderId: null,
      senderType: null
    };
  }

  if (sender["@type"] === "messageSenderUser") {
    return {
      senderId: String(sender.user_id),
      senderType: "USER"
    };
  }

  if (sender["@type"] === "messageSenderChat") {
    return {
      senderId: String(sender.chat_id),
      senderType: "CHAT"
    };
  }

  return {
    senderId: null,
    senderType: null
  };
}

function extractText(content?: TdMessageContent): string {
  if (!content) return "";

  if (content["@type"] === "messageText") {
    return content.text?.text ?? "";
  }

  return content.caption?.text ?? "";
}

function extractMediaType(content?: TdMessageContent): string | null {
  if (!content?.["@type"]) return null;
  if (content["@type"] === "messageText") return null;
  return content["@type"];
}

function toTdNumber(value: string | null): number | null {
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

async function resolveSenderName(
  senderId: string | null,
  senderType: "USER" | "CHAT" | null,
  cache: Map<string, string | null>
): Promise<string | null> {
  if (!senderId || !senderType) return null;

  const cacheKey = `${senderType}:${senderId}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }

  let name: string | null = null;

  try {
    if (senderType === "USER") {
      const userId = toTdNumber(senderId);

      if (userId !== null) {
        const user = await telegramClient.invoke<TdUser>({
          "@type": "getUser",
          user_id: userId
        });

        const fullName = [user.first_name, user.last_name]
          .filter((item): item is string => Boolean(item?.trim()))
          .join(" ")
          .trim();

        name =
          fullName ||
          user.usernames?.active_usernames?.[0] ||
          senderId;
      }
    } else if (senderType === "CHAT") {
      const chatId = toTdNumber(senderId);

      if (chatId !== null) {
        const chat = await telegramClient.invoke<TdChat>({
          "@type": "getChat",
          chat_id: chatId
        });

        name = chat.title?.trim() || senderId;
      }
    }
  } catch {
    name = null;
  }

  cache.set(cacheKey, name);
  return name;
}

export const crawlerService = {
  async runOne(chatId: string, dayKey: string) {
    const { startUnix, endUnix } = getDayRangeUnix(
      dayKey,
      env.dayTzOffsetMinutes
    );

    await CrawlJobModel.findOneAndUpdate(
      { chatId, dayKey },
      {
        status: "RUNNING",
        totalFetched: 0,
        errorMessage: null,
        startedAt: new Date(),
        finishedAt: null
      },
      { upsert: true, new: true }
    );

    let fromMessageId: number | string = 0;
    let previousLastMessageId: string | null = null;
    let done = false;
    let totalFetched = 0;

    const senderCache = new Map<string, string | null>();

    try {
      while (!done) {
        const result = await telegramClient.invoke<TdMessagesResult>({
          "@type": "getChatHistory",
          chat_id: chatId,
          from_message_id: fromMessageId,
          offset: 0,
          limit: 100,
          only_local: false
        });

        const messages: TdMessage[] = Array.isArray(result.messages)
          ? result.messages
          : [];

        if (messages.length === 0) {
          break;
        }

        for (const message of messages) {
          if (message.date < startUnix) {
            done = true;
            break;
          }

          if (message.date >= startUnix && message.date <= endUnix) {
            const sender = parseSender(message.sender_id);
            const mediaType = extractMediaType(message.content);
            const senderName = await resolveSenderName(
              sender.senderId,
              sender.senderType,
              senderCache
            );

            await TelegramMessageModel.updateOne(
              {
                chatId,
                messageId: String(message.id)
              },
              {
                $set: {
                  chatId,
                  messageId: String(message.id),
                  date: message.date,
                  dayKey: toDayKeyFromUnix(
                    message.date,
                    env.dayTzOffsetMinutes
                  ),
                  senderId: sender.senderId,
                  senderType: sender.senderType,
                  senderName,
                  text: extractText(message.content),
                  hasMedia: Boolean(mediaType),
                  mediaType,
                  raw: message
                }
              },
              { upsert: true }
            );

            totalFetched += 1;
          }
        }

        const lastMessage = messages[messages.length - 1];

        if (!lastMessage) {
          break;
        }

        const lastMessageId = String(lastMessage.id);

        if (previousLastMessageId === lastMessageId) {
          break;
        }

        previousLastMessageId = lastMessageId;
        fromMessageId = lastMessage.id;
      }

      await CrawlJobModel.updateOne(
        { chatId, dayKey },
        {
          $set: {
            status: "SUCCESS",
            totalFetched,
            finishedAt: new Date()
          }
        }
      );

      await TrackedGroupModel.updateOne(
        { chatId },
        {
          $set: {
            lastCrawledDay: dayKey
          }
        }
      );

      return {
        ok: true,
        chatId,
        dayKey,
        totalFetched
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown crawl error";

      await CrawlJobModel.updateOne(
        { chatId, dayKey },
        {
          $set: {
            status: "FAILED",
            errorMessage,
            finishedAt: new Date()
          }
        }
      );

      throw error;
    }
  },

  async runAllActive(dayKey: string) {
    const groups = await TrackedGroupModel.find({ isActive: true }).lean();

    const results: Array<{
      chatId: string;
      ok: boolean;
      totalFetched?: number;
      error?: string;
    }> = [];

    for (const group of groups) {
      try {
        const item = await this.runOne(group.chatId, dayKey);
        results.push({
          chatId: group.chatId,
          ok: true,
          totalFetched: item.totalFetched
        });
      } catch (error) {
        results.push({
          chatId: group.chatId,
          ok: false,
          error: error instanceof Error ? error.message : "crawl failed"
        });
      }
    }

    return results;
  },

  async listJobs(limit = 50) {
    return CrawlJobModel.find().sort({ createdAt: -1 }).limit(limit).lean();
  }
};