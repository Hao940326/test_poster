import { Suspense } from "react";
import AuthCallbackClient from "./AuthCallbackClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center">處理登入中…</div>}>
      <AuthCallbackClient />
    </Suspense>
  );
}
