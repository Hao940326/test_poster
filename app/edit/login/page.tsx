"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

function sanitizeRedirect(raw: string | null): string {
  if (!raw) return "/edit";
  try {
    // 只允許相對路徑，且必須以 /edit 起頭
    const u = new URL(raw, window.location.origin);
    if (u.origin !== window.location.origin) return "/edit";
    if (!u.pathname.startsWith("/edit")) return "/edit";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/edit";
  }
}

export default function LoginPage() {
  const supabase = useMemo(() => getSupabase(), []);
  const router = useRouter();
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);

  const redirect = sanitizeRedirect(sp.get("redirect"));

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace(redirect);
    })();
  }, [redirect, router, supabase]);

  async function startLogin() {
    setBusy(true);
    const origin = window.location.origin; // ← 保證在 poster 網域
    const callback = `${origin}/edit/auth/callback?redirect=${encodeURIComponent(
      redirect
    )}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      alert("啟動登入失敗：" + error.message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-white">
      <div className="w-full max-w-sm rounded-2xl border p-6 shadow-sm">
        <h1 className="text-xl font-bold mb-4 text-center">登入 Poster</h1>
        <p className="text-sm text-slate-600 mb-6 text-center">
          使用 Google 帳號登入以建立與下載海報
        </p>
        <button
          onClick={startLogin}
          disabled={busy}
          className="w-full px-4 py-3 rounded-lg bg-slate-900 text-white font-semibold active:scale-95 transition"
        >
          {busy ? "前往 Google…" : "使用 Google 登入"}
        </button>
      </div>
    </div>
  );
}
