import { Suspense } from "react";
import PosterLoginPage from "./PosterLoginClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center">載入中…</div>}>
      <PosterLoginPage />
    </Suspense>
  );
}
