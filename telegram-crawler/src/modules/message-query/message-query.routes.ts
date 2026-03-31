import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { messageQueryService } from "./message-query.service";

export const messageQueryRouter = Router();

const messageQuerySchema = z.object({
  chatId: z.string().min(1),
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  keyword: z.string().optional(),
  senderId: z.string().optional()
});

function buildMessageQuery(input: z.infer<typeof messageQuerySchema>) {
  return {
    chatId: input.chatId,
    dayKey: input.dayKey,
    ...(input.keyword !== undefined ? { keyword: input.keyword } : {}),
    ...(input.senderId !== undefined ? { senderId: input.senderId } : {})
  };
}

messageQueryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = messageQuerySchema.parse(req.query);
    const query = buildMessageQuery(parsed);

    const items = await messageQueryService.listByGroupAndDay(query);

    res.json({
      items,
      total: items.length
    });
  })
);

messageQueryRouter.get(
  "/export.csv",
  asyncHandler(async (req, res) => {
    const parsed = messageQuerySchema.parse(req.query);
    const query = buildMessageQuery(parsed);

    const csv = await messageQueryService.exportCsv(query);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="messages-${query.chatId}-${query.dayKey}.csv"`
    );

    res.send(csv);
  })
);