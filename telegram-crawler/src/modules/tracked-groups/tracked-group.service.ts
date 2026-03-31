import { telegramClient } from "../../core/tdlib/telegram.client";
import {
  TrackedGroupModel,
  TrackedGroupType,
} from "./tracked-group.model";

export type CreateTrackedGroupInput =
  | {
    mode: "PUBLIC_USERNAME";
    username: string;
  }
  | {
    mode: "PRIVATE_INVITE";
    inviteLink: string;
  }
  | {
    mode: "EXISTING_CHAT";
    chatId: string;
  };

export type DiscoveredChatItem = {
  chatId: string;
  title: string;
  username: string | null;
  type: TrackedGroupType;
  isTracked: boolean;
  source: "KNOWN_CHAT" | "SERVER_SEARCH";
  rawChat: TdChat;
};

type TdChatType = {
  "@type"?: string;
  is_channel?: boolean;
};

type TdUsernames = {
  editable_username?: string;
  active_usernames?: string[];
};

type TdChat = {
  "@type"?: string;
  id?: number;
  title?: string;
  type?: TdChatType;
  username?: string;
  usernames?: TdUsernames;
  chat_id?: number;
  [key: string]: unknown;
};

type TdChats = {
  "@type"?: string;
  chat_ids?: number[];
};

type CurrentTelegramOwner = {
  ownerTelegramUserId: string;
  ownerTelegramUsername: string | null;
  ownerTelegramPhone: string | null;
};

function normalizeUsername(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^https?:\/\/telegram\.me\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .trim();
}

function normalizeInviteLink(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("inviteLink là bắt buộc");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("t.me/") || trimmed.startsWith("telegram.me/")) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function toNumericChatId(chatId: string) {
  const value = Number(chatId.trim());

  if (!Number.isFinite(value)) {
    throw new Error("chatId không hợp lệ");
  }

  return value;
}

function resolveUsername(chat?: TdChat | null) {
  if (!chat) return null;

  if (typeof chat.username === "string" && chat.username.trim()) {
    return chat.username.trim();
  }

  const activeUsernames = Array.isArray(chat.usernames?.active_usernames)
    ? chat.usernames.active_usernames
    : [];

  const firstActive = activeUsernames.find(
    (item) => typeof item === "string" && item.trim()
  );

  if (firstActive) {
    return firstActive.trim();
  }

  if (
    typeof chat.usernames?.editable_username === "string" &&
    chat.usernames.editable_username.trim()
  ) {
    return chat.usernames.editable_username.trim();
  }

  return null;
}

function resolveGroupType(
  chat?: TdChat | null,
  fallback: TrackedGroupType = "PRIVATE"
): TrackedGroupType {
  const username = resolveUsername(chat);

  if (username) {
    return "PUBLIC";
  }

  const tdType = chat?.type?.["@type"];

  if (tdType === "chatTypePrivate" || tdType === "chatTypeSecret") {
    return "PRIVATE";
  }

  return fallback;
}

async function getCurrentTelegramOwner(): Promise<CurrentTelegramOwner> {
  const me = await telegramClient.invoke<Record<string, unknown>>({
    "@type": "getMe",
  });

  const ownerTelegramUserId =
    typeof me.id === "number" || typeof me.id === "string"
      ? String(me.id)
      : null;

  if (!ownerTelegramUserId) {
    throw new Error("Không lấy được tài khoản Telegram hiện tại");
  }

  const usernames =
    me.usernames && typeof me.usernames === "object"
      ? (me.usernames as Record<string, unknown>)
      : null;

  const activeUsernames = Array.isArray(usernames?.active_usernames)
    ? (usernames.active_usernames as string[])
    : [];

  const ownerTelegramUsername =
    activeUsernames.find((item) => typeof item === "string" && item.trim()) ??
    (typeof usernames?.editable_username === "string" &&
      usernames.editable_username.trim()
      ? usernames.editable_username.trim()
      : null);

  const ownerTelegramPhone =
    typeof me.phone_number === "string" ? me.phone_number : null;

  return {
    ownerTelegramUserId,
    ownerTelegramUsername,
    ownerTelegramPhone,
  };
}

async function ensureGroupNotExists(
  ownerTelegramUserId: string,
  chatId: string
) {
  const existed = await TrackedGroupModel.findOne({
    ownerTelegramUserId,
    chatId,
  }).lean();

  if (existed) {
    throw new Error("Group đã tồn tại trong danh sách theo dõi");
  }
}

async function getTrackedChatIdSet(ownerTelegramUserId: string) {
  const groups = await TrackedGroupModel.find(
    { ownerTelegramUserId },
    { chatId: 1, _id: 0 }
  ).lean();

  return new Set(groups.map((item) => String(item.chatId)));
}

async function toDiscoveredItem(
  chat: TdChat,
  source: DiscoveredChatItem["source"],
  trackedChatIdSet?: Set<string>
): Promise<DiscoveredChatItem | null> {
  const numericChatId =
    typeof chat.id === "number"
      ? chat.id
      : typeof chat.chat_id === "number"
        ? chat.chat_id
        : undefined;

  if (!numericChatId) {
    return null;
  }

  const chatId = String(numericChatId);
  const trackedSet = trackedChatIdSet ?? new Set<string>();

  return {
    chatId,
    title:
      typeof chat.title === "string" && chat.title.trim()
        ? chat.title.trim()
        : `Chat ${chatId}`,
    username: resolveUsername(chat),
    type: resolveGroupType(chat),
    isTracked: trackedSet.has(chatId),
    source,
    rawChat: chat,
  };
}

async function loadMainChats(limit: number) {
  try {
    await telegramClient.invoke({
      "@type": "loadChats",
      chat_list: { "@type": "chatListMain" },
      limit,
    });
  } catch {
    // bỏ qua lỗi kiểu "Have no more chats to load"
  }

  const result = await telegramClient.invoke<TdChats>({
    "@type": "getChats",
    chat_list: { "@type": "chatListMain" },
    limit,
  });

  return Array.isArray(result.chat_ids) ? result.chat_ids : [];
}

async function warmupChatById(chatId: number) {
  await loadMainChats(200);

  try {
    await telegramClient.invoke({
      "@type": "openChat",
      chat_id: chatId,
    });
  } catch {
    // không bắt buộc thành công
  }

  try {
    await telegramClient.invoke({
      "@type": "closeChat",
      chat_id: chatId,
    });
  } catch {
    // không bắt buộc thành công
  }
}

async function getChatInfoByChatId(chatId: string) {
  const numericChatId = toNumericChatId(chatId);

  async function tryGetChat() {
    return telegramClient.invoke<TdChat>({
      "@type": "getChat",
      chat_id: numericChatId,
    });
  }

  let chat: TdChat | null = null;

  try {
    chat = await tryGetChat();
  } catch {
    await warmupChatById(numericChatId);

    try {
      chat = await tryGetChat();
    } catch {
      throw new Error(
        "Không tìm thấy chat theo chatId. Chat này có thể chưa được load trong session TDLib hiện tại. Hãy mở chat đó trong đúng tài khoản Telegram đang dùng cho tool, hoặc thêm bằng @username nếu là group public."
      );
    }
  }

  const resolvedChatId =
    typeof chat.id === "number" ? String(chat.id) : String(numericChatId);

  return {
    rawChat: chat,
    chatId: resolvedChatId,
    title:
      typeof chat.title === "string" && chat.title.trim()
        ? chat.title.trim()
        : `Chat ${resolvedChatId}`,
    username: resolveUsername(chat),
    type: resolveGroupType(chat),
  };
}

async function getChatInfoByUsername(usernameInput: string) {
  const username = normalizeUsername(usernameInput);

  if (!username) {
    throw new Error("username là bắt buộc");
  }

  const publicChat = await telegramClient.invoke<TdChat>({
    "@type": "searchPublicChat",
    username,
  });

  const numericChatId =
    typeof publicChat.id === "number" ? publicChat.id : undefined;

  if (!numericChatId) {
    throw new Error("Không tìm thấy public group");
  }

  try {
    await telegramClient.invoke({
      "@type": "joinChat",
      chat_id: numericChatId,
    });
  } catch {
    // bỏ qua lỗi đã tham gia
  }

  const fullChat = await telegramClient.invoke<TdChat>({
    "@type": "getChat",
    chat_id: numericChatId,
  });

  const resolvedChatId =
    typeof fullChat.id === "number" ? String(fullChat.id) : String(numericChatId);

  return {
    rawChat: fullChat,
    chatId: resolvedChatId,
    title:
      (typeof fullChat.title === "string" && fullChat.title.trim()
        ? fullChat.title.trim()
        : null) ||
      (typeof publicChat.title === "string" && publicChat.title.trim()
        ? publicChat.title.trim()
        : null) ||
      username,
    username: resolveUsername(fullChat) || username,
    type: "PUBLIC" as const,
  };
}

async function getChatInfoByInviteLink(inviteLinkInput: string) {
  const inviteLink = normalizeInviteLink(inviteLinkInput);

  const inviteInfo = await telegramClient.invoke<Record<string, unknown>>({
    "@type": "checkChatInviteLink",
    invite_link: inviteLink,
  });

  let joinedChat: TdChat | null = null;

  try {
    joinedChat = await telegramClient.invoke<TdChat>({
      "@type": "joinChatByInviteLink",
      invite_link: inviteLink,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    if (!message.includes("USER_ALREADY_PARTICIPANT")) {
      throw error;
    }
  }

  const numericChatId =
    (joinedChat && typeof joinedChat.id === "number" ? joinedChat.id : undefined) ??
    (joinedChat && typeof joinedChat.chat_id === "number"
      ? joinedChat.chat_id
      : undefined) ??
    (typeof inviteInfo.chat_id === "number" ? inviteInfo.chat_id : undefined) ??
    (typeof inviteInfo.id === "number" ? inviteInfo.id : undefined);

  if (!numericChatId) {
    throw new Error(
      "Đã ở trong group nhưng không lấy được chatId từ invite link"
    );
  }

  const fullChat = await telegramClient.invoke<TdChat>({
    "@type": "getChat",
    chat_id: numericChatId,
  });

  const resolvedChatId =
    typeof fullChat.id === "number" ? String(fullChat.id) : String(numericChatId);

  return {
    rawChat: fullChat,
    inviteLink,
    chatId: resolvedChatId,
    title:
      (typeof fullChat.title === "string" && fullChat.title.trim()
        ? fullChat.title.trim()
        : null) ||
      (joinedChat &&
        typeof joinedChat.title === "string" &&
        joinedChat.title.trim()
        ? joinedChat.title.trim()
        : null) ||
      resolvedChatId,
    username: resolveUsername(fullChat),
    type: resolveGroupType(fullChat, "PRIVATE"),
  };
}

export const trackedGroupService = {
  async listGroups() {
    const owner = await getCurrentTelegramOwner();

    return TrackedGroupModel.find({
      ownerTelegramUserId: owner.ownerTelegramUserId,
    })
      .sort({ createdAt: -1 })
      .lean();
  },

  async discoverKnownChats(limit = 50) {
    const owner = await getCurrentTelegramOwner();
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const trackedSet = await getTrackedChatIdSet(owner.ownerTelegramUserId);
    const chatIds = await loadMainChats(safeLimit);

    const chats = await Promise.all(
      chatIds.map(async (chatId) => {
        try {
          return await telegramClient.invoke<TdChat>({
            "@type": "getChat",
            chat_id: chatId,
          });
        } catch {
          return null;
        }
      })
    );

    const mapped = await Promise.all(
      chats
        .filter((item): item is TdChat => Boolean(item))
        .map((chat) => toDiscoveredItem(chat, "KNOWN_CHAT", trackedSet))
    );

    return mapped.filter((item): item is DiscoveredChatItem => Boolean(item));
  },

  async searchPublicChat(query: string, limit = 20) {
    const owner = await getCurrentTelegramOwner();
    const q = query.trim();

    if (!q) {
      throw new Error("q là bắt buộc");
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const trackedSet = await getTrackedChatIdSet(owner.ownerTelegramUserId);

    const result = await telegramClient.invoke<TdChats>({
      "@type": "searchChatsOnServer",
      query: q,
      limit: safeLimit,
    });

    const chatIds = Array.isArray(result.chat_ids) ? result.chat_ids : [];

    const chats = await Promise.all(
      chatIds.map(async (chatId) => {
        try {
          return await telegramClient.invoke<TdChat>({
            "@type": "getChat",
            chat_id: chatId,
          });
        } catch {
          return null;
        }
      })
    );

    const mapped = await Promise.all(
      chats
        .filter((item): item is TdChat => Boolean(item))
        .map((chat) => toDiscoveredItem(chat, "SERVER_SEARCH", trackedSet))
    );

    return mapped
      .filter((item): item is DiscoveredChatItem => Boolean(item))
      .filter((item) => item.type === "PUBLIC");
  },

  async addGroup(input: CreateTrackedGroupInput) {
    const owner = await getCurrentTelegramOwner();

    if (input.mode === "EXISTING_CHAT") {
      const info = await getChatInfoByChatId(input.chatId);

      await ensureGroupNotExists(owner.ownerTelegramUserId, info.chatId);

      return TrackedGroupModel.create({
        ownerTelegramUserId: owner.ownerTelegramUserId,
        ownerTelegramUsername: owner.ownerTelegramUsername,
        ownerTelegramPhone: owner.ownerTelegramPhone,
        title: info.title,
        chatId: info.chatId,
        username: info.username,
        inviteLink: null,
        type: info.type,
        isActive: true,
        lastCrawledDay: null,
        meta: {
          source: "EXISTING_CHAT",
          rawChat: info.rawChat,
        },
      });
    }

    if (input.mode === "PUBLIC_USERNAME") {
      const info = await getChatInfoByUsername(input.username);

      await ensureGroupNotExists(owner.ownerTelegramUserId, info.chatId);

      return TrackedGroupModel.create({
        ownerTelegramUserId: owner.ownerTelegramUserId,
        ownerTelegramUsername: owner.ownerTelegramUsername,
        ownerTelegramPhone: owner.ownerTelegramPhone,
        title: info.title,
        chatId: info.chatId,
        username: info.username,
        inviteLink: null,
        type: "PUBLIC",
        isActive: true,
        lastCrawledDay: null,
        meta: {
          source: "PUBLIC_USERNAME",
          rawChat: info.rawChat,
        },
      });
    }

    const info = await getChatInfoByInviteLink(input.inviteLink);

    await ensureGroupNotExists(owner.ownerTelegramUserId, info.chatId);

    return TrackedGroupModel.create({
      ownerTelegramUserId: owner.ownerTelegramUserId,
      ownerTelegramUsername: owner.ownerTelegramUsername,
      ownerTelegramPhone: owner.ownerTelegramPhone,
      title: info.title,
      chatId: info.chatId,
      username: info.username,
      inviteLink: info.inviteLink,
      type: info.type,
      isActive: true,
      lastCrawledDay: null,
      meta: {
        source: "PRIVATE_INVITE",
        rawChat: info.rawChat,
      },
    });
  },

  async toggleGroup(id: string, isActive: boolean) {
    const owner = await getCurrentTelegramOwner();

    const item = await TrackedGroupModel.findOneAndUpdate(
      {
        _id: id,
        ownerTelegramUserId: owner.ownerTelegramUserId,
      },
      { isActive },
      { new: true }
    );

    if (!item) {
      throw new Error("Không tìm thấy group");
    }

    return item;
  },

  async refreshGroupInfo(id: string) {
    const owner = await getCurrentTelegramOwner();

    const existing = await TrackedGroupModel.findOne({
      _id: id,
      ownerTelegramUserId: owner.ownerTelegramUserId,
    });

    if (!existing) {
      throw new Error("Không tìm thấy group");
    }

    let info:
      | Awaited<ReturnType<typeof getChatInfoByChatId>>
      | Awaited<ReturnType<typeof getChatInfoByUsername>>;

    if (existing.username) {
      try {
        info = await getChatInfoByUsername(existing.username);
      } catch {
        info = await getChatInfoByChatId(existing.chatId);
      }
    } else {
      info = await getChatInfoByChatId(existing.chatId);
    }

    existing.title = info.title;
    existing.chatId = info.chatId;
    existing.username = info.username;
    existing.type = info.type;
    existing.ownerTelegramUsername = owner.ownerTelegramUsername;
    existing.ownerTelegramPhone = owner.ownerTelegramPhone;
    existing.meta = {
      ...(typeof existing.meta === "object" && existing.meta ? existing.meta : {}),
      refreshedAt: new Date().toISOString(),
      rawChat: info.rawChat,
    };

    await existing.save();

    return existing;
  },

  async removeGroup(id: string) {
    const owner = await getCurrentTelegramOwner();

    const deleted = await TrackedGroupModel.findOneAndDelete({
      _id: id,
      ownerTelegramUserId: owner.ownerTelegramUserId,
    });

    if (!deleted) {
      throw new Error("Không tìm thấy group");
    }

    return deleted;
  },
};