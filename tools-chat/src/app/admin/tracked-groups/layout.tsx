import type { ReactNode } from "react";
import TelegramRouteGuard from "@/router/TelegramRouteGuard";

export default function TrackedGroupsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <TelegramRouteGuard>{children}</TelegramRouteGuard>;
}