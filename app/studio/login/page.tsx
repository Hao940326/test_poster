import { Suspense } from "react";
import StudioLoginClient from "./StudioLoginClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center">載入中…</div>}>
      <StudioLoginClient />
    </Suspense>
  );
}

// 防止被自動靜態化（可選，但對 OAuth 頁面通常比較穩）
export const dynamic = "force-dynamic";
