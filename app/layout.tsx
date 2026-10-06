import type { Metadata } from "next";
// Only the design tokens and base styles are global. The star map and the
// learning library each import their own stylesheet, so neither page pays for
// the other's CSS.
import "./globals.css";
import "./theme-tokens.css";
import { SITE_URL } from "./site";

const title = "华夏星图 · 中国历史宇宙";
const description =
  "从文明起源到1912年，在可旋转的三维星图中探索中国历史、人物、事件与文明的联系。22个专题、918个有出处的历史入口。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: title, template: "%s · 华夏星图" },
  description,
  applicationName: "华夏星图",
  alternates: { canonical: "/" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "华夏星图",
    title,
    description,
    url: "/",
    images: [
      {
        url: "/history/image-ming-palace-hero.jpg",
        width: 1920,
        height: 1216,
        alt: "明清宫殿建筑，华夏星图封面图像",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/history/image-ming-palace-hero.jpg"],
  },
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
