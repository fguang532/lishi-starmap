import type { Metadata } from "next";
import "./globals.css";
import "./exploration.css";
export const metadata: Metadata = {
  title: "华夏星图 · 中国历史宇宙",
  description:
    "从文明起源到1912年，在可旋转的三维星图中探索中国历史、人物、事件与文明的联系。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
