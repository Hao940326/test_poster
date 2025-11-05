// app/studio/page.tsx
import type { Metadata } from "next";
import ClientStudio from "./ClientStudio"; // ✅ 重點：沒有大括號

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Studio | King's Talent Poster",
  description: "A 端模板工作室",
};

export default function Page() {
  return <ClientStudio />; // ✅ 渲染 default 匯出的 React 函式
}
