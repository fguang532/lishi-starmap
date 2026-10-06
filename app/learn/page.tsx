import type { Metadata } from "next";
import LearningLibrary from "@/components/history/LearningLibrary";

const description = "沿君主世系、战役经过与诗人作品，系统阅读中国历史。";

export const metadata: Metadata = {
  title: "历史学堂",
  description,
  alternates: { canonical: "/learn" },
  openGraph: { title: "历史学堂 · 华夏星图", description, url: "/learn" },
};

export default function LearnPage() {
  return <LearningLibrary />;
}
