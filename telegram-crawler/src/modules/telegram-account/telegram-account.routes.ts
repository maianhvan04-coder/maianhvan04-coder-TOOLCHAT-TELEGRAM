import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { telegramAccountService } from "./telegram-account.service";

export const telegramAccountRouter = Router();

const phoneBodySchema = z.object({
  phoneNumber: z.string().trim().min(5, "phoneNumber không hợp lệ"),
});

const codeBodySchema = z.object({
  code: z.string().trim().min(1, "code là bắt buộc"),
});

const passwordBodySchema = z.object({
  password: z.string().min(1, "password là bắt buộc"),
});

telegramAccountRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const data = await telegramAccountService.getStatus();
    res.json(data);
  })
);

telegramAccountRouter.post(
  "/phone",
  asyncHandler(async (req, res) => {
    const body = phoneBodySchema.parse(req.body);

    const data = await telegramAccountService.sendPhoneNumber(body.phoneNumber);

    res.json({
      ok: true,
      step: "CODE",
      data,
      message: "Đã gửi số điện thoại",
    });
  })
);

telegramAccountRouter.post(
  "/code",
  asyncHandler(async (req, res) => {
    const body = codeBodySchema.parse(req.body);

    const data = await telegramAccountService.checkCode(body.code);

    res.json({
      ok: true,
      step: "READY",
      data,
      message: "Đăng nhập Telegram thành công",
    });
  })
);

telegramAccountRouter.post(
  "/password",
  asyncHandler(async (req, res) => {
    const body = passwordBodySchema.parse(req.body);

    const data = await telegramAccountService.checkPassword(body.password);

    res.json({
      ok: true,
      step: "READY",
      data,
      message: "Xác thực mật khẩu thành công",
    });
  })
);

telegramAccountRouter.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    const data = await telegramAccountService.logout();

    res.json({
      ok: true,
      step: "PHONE",
      data,
      message: "Đã đăng xuất tài khoản Telegram",
    });
  })
);

telegramAccountRouter.get(
  "/me",
  asyncHandler(async (_req, res) => {
    const data = await telegramAccountService.getMe();

    const rawUsernames =
      data?.usernames && typeof data.usernames === "object"
        ? (data.usernames as Record<string, unknown>)
        : null;

    const activeUsernames = Array.isArray(rawUsernames?.active_usernames)
      ? (rawUsernames.active_usernames as string[])
      : [];

    const firstName =
      typeof data?.first_name === "string" ? data.first_name : null;

    const lastName =
      typeof data?.last_name === "string" ? data.last_name : null;

    const phoneNumber =
      typeof data?.phone_number === "string" ? data.phone_number : null;

    const id =
      typeof data?.id === "number" || typeof data?.id === "string"
        ? data.id
        : null;

    res.json({
      ok: true,
      data,
      profile: {
        id,
        firstName,
        lastName,
        fullName: [firstName, lastName].filter(Boolean).join(" ") || null,
        username: activeUsernames[0] ?? null,
        phoneNumber,
      },
    });
  })
);