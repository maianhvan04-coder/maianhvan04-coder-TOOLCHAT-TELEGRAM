import type { ReactNode } from "react";
import TelegramRouteGuard from "@/router/TelegramRouteGuard";

export default function MessagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <TelegramRouteGuard>{children}</TelegramRouteGuard>;
}