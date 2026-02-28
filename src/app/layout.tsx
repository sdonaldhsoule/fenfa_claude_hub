import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "CCH Distributor",
  description: "Codex CLI GPT 模型 API Key 分发站",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
