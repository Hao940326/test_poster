"use client";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { getOAuthCallback } from "@/lib/supabaseClient";

export default function PosterLoginClient() {
  const supabase = getSupabaseBrowser("poster");

  const handleLogin = async () => {
    // ✅ 若關閉登入，直接略過
    if (process.env.NEXT_PUBLIC_DISABLE_AUTH_POSTER === "true") {
      console.log("🚫 Poster auth disabled (skipped Google login)");
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getOAuthCallback("poster", location.origin) },
    });
  };

  // ✅ 若關閉登入，可以自動隱藏這個按鈕
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH_POSTER === "true") {
    return null; // 或顯示別的提示
  }

  return (
    <button
      onClick={handleLogin}
      className="px-4 py-2 rounded bg-black text-white"
    >
      使用 Google 登入（Poster）
    </button>
  );
}
