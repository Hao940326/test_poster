import AuthCallbackPage from "@/app/auth/callback/page";

// ✅ Poster B 端專用回呼頁面
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function PosterAuthCallbackPage() {
  return <AuthCallbackPage />;
}
