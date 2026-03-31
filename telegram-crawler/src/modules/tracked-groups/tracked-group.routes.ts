import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import {
  CreateTrackedGroupInput,
  trackedGroupService,
} from "./tracked-group.service";

export const trackedGroupRouter = Router();

const trackedGroupIdParamsSchema = z.object({
  id: z.string().min(1, "id là bắt buộc"),
});

const createTrackedGroupBodySchema = z.union([
  z.object({
    mode: z.literal("PUBLIC_USERNAME"),
    username: z.string().trim().min(1, "username là bắt buộc"),
  }),
  z.object({
    mode: z.literal("PRIVATE_INVITE"),
    inviteLink: z.string().trim().min(1, "inviteLink là bắt buộc"),
  }),
  z.object({
    mode: z.literal("EXISTING_CHAT"),
    chatId: z.string().trim().min(1, "chatId là bắt buộc"),
  }),

  z.object({
    chatId: z.string().trim().min(1, "chatId là bắt buộc"),
  }),
  z.object({
    inviteLink: z.string().trim().min(1, "inviteLink là bắt buộc"),
  }),
]);

const toggleTrackedGroupBodySchema = z.object({
  isActive: z.boolean(),
});

const discoverChatsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

const searchPublicQuerySchema = z.object({
  q: z.string().trim().min(1, "q là bắt buộc"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

type CreateTrackedGroupBody = z.infer<typeof createTrackedGroupBodySchema>;

function normalizeCreateInput(
  body: CreateTrackedGroupBody
): CreateTrackedGroupInput {
  if ("mode" in body) {
    if (body.mode === "PUBLIC_USERNAME") {
      return {
        mode: "PUBLIC_USERNAME",
        username: body.username.trim().replace(/^@/, ""),
      };
    }

    if (body.mode === "PRIVATE_INVITE") {
      return {
        mode: "PRIVATE_INVITE",
        inviteLink: body.inviteLink.trim(),
      };
    }

    return {
      mode: "EXISTING_CHAT",
      chatId: body.chatId.trim(),
    };
  }

  if ("inviteLink" in body) {
    return {
      mode: "PRIVATE_INVITE",
      inviteLink: body.inviteLink.trim(),
    };
  }

  const rawChatId = body.chatId.trim();

  if (/^-?\d+$/.test(rawChatId)) {
    return {
      mode: "EXISTING_CHAT",
      chatId: rawChatId,
    };
  }

  return {
    mode: "PUBLIC_USERNAME",
    username: rawChatId.replace(/^@/, ""),
  };
}

trackedGroupRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await trackedGroupService.listGroups();

    res.json({
      ok: true,
      items,
      total: items.length,
    });
  })
);

trackedGroupRouter.get(
  "/discover/chats",
  asyncHandler(async (req, res) => {
    const query = discoverChatsQuerySchema.parse(req.query);
    const items = await trackedGroupService.discoverKnownChats(query.limit);

    res.json({
      ok: true,
      items,
      total: items.length,
    });
  })
);

trackedGroupRouter.get(
  "/discover/public",
  asyncHandler(async (req, res) => {
    const query = searchPublicQuerySchema.parse(req.query);
    const items = await trackedGroupService.searchPublicChat(
      query.q,
      query.limit
    );

    res.json({
      ok: true,
      items,
      total: items.length,
    });
  })
);

trackedGroupRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createTrackedGroupBodySchema.parse(req.body);
    const input = normalizeCreateInput(body);

    try {
      const item = await trackedGroupService.addGroup(input);

      return res.status(201).json({
        ok: true,
        item,
      });
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Không thể thêm group";
      const message = rawMessage.trim();
      const lower = message.toLowerCase();

      if (lower.includes("chat not found")) {
        return res.status(400).json({
          ok: false,
          message:
            "Không tìm thấy chat theo chatId. Hãy thử @username nếu là group public, hoặc invite link nếu là group private.",
        });
      }

      if (
        lower.includes("invite") ||
        lower.includes("expired") ||
        lower.includes("invalid")
      ) {
        return res.status(400).json({
          ok: false,
          message: "Invite link không hợp lệ hoặc đã hết hạn.",
        });
      }

      if (
        lower.includes("đã tồn tại") ||
        lower.includes("already exists") ||
        lower.includes("duplicate")
      ) {
        return res.status(400).json({
          ok: false,
          message: "Group đã tồn tại trong danh sách theo dõi.",
        });
      }

      return res.status(400).json({
        ok: false,
        message,
      });
    }
  })
);

trackedGroupRouter.patch(
  "/:id/toggle",
  asyncHandler(async (req, res) => {
    const params = trackedGroupIdParamsSchema.parse(req.params);
    const body = toggleTrackedGroupBodySchema.parse(req.body);

    const item = await trackedGroupService.toggleGroup(
      params.id,
      body.isActive
    );

    res.json({
      ok: true,
      item,
    });
  })
);

trackedGroupRouter.patch(
  "/:id/refresh",
  asyncHandler(async (req, res) => {
    const params = trackedGroupIdParamsSchema.parse(req.params);

    const item = await trackedGroupService.refreshGroupInfo(params.id);

    res.json({
      ok: true,
      item,
    });
  })
);

trackedGroupRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const params = trackedGroupIdParamsSchema.parse(req.params);

    const deleted = await trackedGroupService.removeGroup(params.id);

    res.json({
      ok: true,
      deleted,
    });
  })
);