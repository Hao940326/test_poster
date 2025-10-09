// app/login/page.tsx
import { Suspense } from "react";
import LoginBody from "./LoginBody";

// 讓這頁不要做預先靜態匯出，避免 CSR bailout 檢查
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: 16 }}>Loading…</p>}>
      <LoginBody />
    </Suspense>
  );
}
