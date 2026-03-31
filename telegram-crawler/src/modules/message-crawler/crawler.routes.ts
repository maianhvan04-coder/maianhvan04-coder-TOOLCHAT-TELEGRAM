import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { getTodayDayKey } from "../../shared/utils/day.js";
import { crawlerService } from "./crawler.service.js";

export const crawlerRouter = Router();

crawlerRouter.post(
  "/run",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        chatId: z.string().min(1),
        dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      })
      .parse(req.body);

    const data = await crawlerService.runOne(body.chatId, body.dayKey);
    res.json(data);
  })
);

crawlerRouter.post(
  "/run-all",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
      })
      .parse(req.body);

    const dayKey = body.dayKey ?? getTodayDayKey(env.dayTzOffsetMinutes);
    const items = await crawlerService.runAllActive(dayKey);

    res.json({
      dayKey,
      items,
      total: items.length
    });
  })
);

crawlerRouter.get(
  "/jobs",
  asyncHandler(async (_req, res) => {
    const items = await crawlerService.listJobs();
    res.json({
      items,
      total: items.length
    });
  })
);