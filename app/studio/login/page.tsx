"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

function safeRedirect(redirect: string | null) {
  if (!redirect) return "/studio";
  try {
    const u = new URL(redirect, window.location.origin);
    if (u.origin !== window.location.origin) return "/studio";
    if (!u.pathname.startsWith("/studio")) return "/studio";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/studio";
  }
}

export default function StudioLoginPage() {
  const supabase = useMemo(() => getSupabase(), []);
  const router = useRouter();
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);

  const redirect = safeRedirect(sp.get("redirect"));

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace(redirect);
    })();
  }, [redirect, router, supabase]);

  async function startLogin() {
    try {
      setBusy(true);
      const cb = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: cb,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        alert("啟動 Google 登入失敗：" + error.message);
        setBusy(false);
      }
    } catch (e: any) {
      alert("發生錯誤：" + e.message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-white">
      <div className="w-full max-w-sm rounded-2xl border p-6 shadow-sm">
        <h1 className="text-xl font-bold mb-4 text-center">登入 Studio（A端）</h1>
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
