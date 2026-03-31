import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tools Chat Telegram",
  description: "Quản lý group theo dõi và crawl tin nhắn Telegram",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}