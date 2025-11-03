import { Suspense } from "react";
import LoginClient from "./LoginClient";

// 讓這頁不要被預產生成靜態（更保險）
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">載入中…</div>}>
      <LoginClient />
    </Suspense>
  );
}
