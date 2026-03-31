import { http } from "@/lib/utils/http";

export type TrackedGroupType = "PUBLIC" | "PRIVATE";

export type TrackedGroupItem = {
  _id: string;
  chatId: string;
  title?: string | null;
  type: TrackedGroupType;
  username?: string | null;
  inviteLink?: string | null;
  isActive: boolean;
  lastCrawledDay?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type DiscoveredChatItem = {
  chatId: string;
  title: string;
  username: string | null;
  type: TrackedGroupType;
  isTracked: boolean;
  source: "KNOWN_CHAT" | "SERVER_SEARCH";
  rawChat?: Record<string, unknown>;
};

type ListTrackedGroupsResponse = {
  ok: boolean;
  items: TrackedGroupItem[];
  total: number;
};

type CreateTrackedGroupResponse = {
  ok: boolean;
  item: TrackedGroupItem;
  message?: string;
};

type ToggleTrackedGroupResponse = {
  ok: boolean;
  item: TrackedGroupItem;
};

type RefreshTrackedGroupResponse = {
  ok: boolean;
  item: TrackedGroupItem;
};

type DeleteTrackedGroupResponse = {
  ok: boolean;
  deleted: TrackedGroupItem;
};

export type CrawlRunResponse = {
  ok: boolean;
  code?: string;
  chatId: string;
  dayKey: string;
  totalFetched: number;
  message?: string;
};

type DiscoverChatsResponse = {
  ok: boolean;
  items: DiscoveredChatItem[];
  total: number;
};

export type CreateTrackedGroupPayload =
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
    }
  | {
      chatId: string;
      inviteLink?: never;
    }
  | {
      inviteLink: string;
      chatId?: never;
    };

export const trackedGroupApi = {
  async list() {
    const res = await http.get<ListTrackedGroupsResponse>("/api/groups");
    return res.data.items ?? [];
  },

  async discoverKnownChats(limit = 50) {
    const res = await http.get<DiscoverChatsResponse>(
      "/api/groups/discover/chats",
      {
        params: { limit },
      }
    );
    return res.data.items ?? [];
  },

  async searchPublicChats(q: string, limit = 20) {
    const res = await http.get<DiscoverChatsResponse>(
      "/api/groups/discover/public",
      {
        params: { q, limit },
      }
    );
    return res.data.items ?? [];
  },

  async create(payload: CreateTrackedGroupPayload) {
    const res = await http.post<CreateTrackedGroupResponse>(
      "/api/groups",
      payload
    );
    return res.data.item;
  },

  async createByExistingChat(chatId: string) {
    const res = await http.post<CreateTrackedGroupResponse>("/api/groups", {
      mode: "EXISTING_CHAT",
      chatId,
    });
    return res.data.item;
  },

  async createByUsername(username: string) {
    const res = await http.post<CreateTrackedGroupResponse>("/api/groups", {
      mode: "PUBLIC_USERNAME",
      username,
    });
    return res.data.item;
  },

  async createByInviteLink(inviteLink: string) {
    const res = await http.post<CreateTrackedGroupResponse>("/api/groups", {
      mode: "PRIVATE_INVITE",
      inviteLink,
    });
    return res.data.item;
  },

  async toggle(id: string, isActive: boolean) {
    const res = await http.patch<ToggleTrackedGroupResponse>(
      `/api/groups/${id}/toggle`,
      { isActive }
    );
    return res.data.item;
  },

  async refresh(id: string) {
    const res = await http.patch<RefreshTrackedGroupResponse>(
      `/api/groups/${id}/refresh`
    );
    return res.data.item;
  },

  async remove(id: string) {
    const res = await http.delete<DeleteTrackedGroupResponse>(
      `/api/groups/${id}`
    );
    return res.data;
  },

  async crawlNow(chatId: string, dayKey: string) {
    const res = await http.post<CrawlRunResponse>("/api/crawl/run", {
      chatId,
      dayKey,
    });
    return res.data;
  },
};