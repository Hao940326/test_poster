"use client";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { getOAuthCallback } from "@/lib/supabaseClient";

export default function StudioLoginClient() {
  const supabase = getSupabaseBrowser("studio");
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getOAuthCallback("studio", location.origin) },
    });
  };
  return (
    <button onClick={handleLogin} className="px-4 py-2 rounded bg-black text-white">
      使用 Google 登入（Studio）
    </button>
  );
}
