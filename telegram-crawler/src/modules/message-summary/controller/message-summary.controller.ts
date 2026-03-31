import { Request, Response } from "express";
import { z } from "zod";
import { messageSummaryService } from "../service/message-summary.service";

const summarizeDaySchema = z.object({
  chatId: z.string().min(1, "chatId là bắt buộc"),
  dayKey: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dayKey phải có dạng YYYY-MM-DD"),
  keyword: z.string().optional(),
  senderId: z.string().optional(),
  title: z.string().optional(),
});

export const messageSummaryController = {
  async summarizeDay(req: Request, res: Response) {
    try {
      const input = summarizeDaySchema.parse(req.body);
      const data = await messageSummaryService.summarizeDay(input);

      return res.json({
        ok: true,
        data,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          ok: false,
          message: "Dữ liệu gửi lên không hợp lệ",
          errors: error.flatten(),
        });
      }

      const message =
        error instanceof Error ? error.message : "Không tóm tắt được tin nhắn";

      return res.status(500).json({
        ok: false,
        message,
      });
    }
  },
};