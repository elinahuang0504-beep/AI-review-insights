import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HMI Review AI - Smart Review 审查系统",
  description: "首款专为车载 HMI 打造的 AI 设计评估工具，从美学到人机工程，为您提供专家级的深度分析与多方案对标体验。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen w-full bg-[#0a0f18] text-slate-300 font-sans">
        {children}
      </body>
    </html>
  );
}
