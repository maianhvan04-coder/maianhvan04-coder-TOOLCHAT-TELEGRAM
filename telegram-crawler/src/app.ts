import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { crawlerRouter } from "./modules/message-crawler/crawler.routes.js";
import { messageQueryRouter } from "./modules/message-query/message-query.routes.js";
import { messageSummaryRouter } from "./modules/message-summary/routes/message-summary.route.js";
import { telegramAccountRouter } from "./modules/telegram-account/telegram-account.routes.js";
import { trackedGroupRouter } from "./modules/tracked-groups/tracked-group.routes.js";

export const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "telegram-group-crawler",
  });
});

app.use("/api/telegram", telegramAccountRouter);
app.use("/api/groups", trackedGroupRouter);
app.use("/api/crawl", crawlerRouter);
app.use("/api/messages", messageQueryRouter);
app.use("/api/messages", messageSummaryRouter);

app.use(
  (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    res.status(400).json({
      ok: false,
      message,
    });
  }
);