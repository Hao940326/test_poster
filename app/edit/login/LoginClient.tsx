"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

export default function LoginClient() {
  const supabase = useMemo(() => getSupabase(), []);
  const router = useRouter();
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);

  const redirect = sp.get("redirect") || "/edit";

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace(redirect);
    })();
  }, [redirect, router, supabase]);

  async function startLogin() {
    try {
      setBusy(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // 先硬指定 poster 網域，確保不飄到 A 端
          redirectTo: `https://poster.kingstalent.com.tw/auth/callback?redirect=${encodeURIComponent(redirect)}`,
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
