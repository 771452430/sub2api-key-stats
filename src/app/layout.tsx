import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "API 使用统计",
  description: "通过查询秘钥查看 Sub2API 使用记录"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
