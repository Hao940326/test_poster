"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

// ⬇️ 固定使用 Poster 的絕對網域（可用環境變數覆寫）
const POSTER_ORIGIN =
  process.env.NEXT_PUBLIC_POSTER_ORIGIN ?? "https://poster.kingstalent.com.tw";

function safeRedirect(redirect: string | null) {
  if (!redirect) return "/edit";
  try {
    // 以「poster 固定網域」作為基準，避免誤用到 studio origin
    const u = new URL(redirect, POSTER_ORIGIN);
    if (u.origin !== POSTER_ORIGIN) return "/edit";
    if (!u.pathname.startsWith("/edit")) return "/edit";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/edit";
  }
}

export default function PosterLoginPage() {
  const supabase = useMemo(() => getSupabase(), []);
  const router = useRouter();
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);

  const redirect = safeRedirect(sp.get("redirect"));

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) router.replace(redirect);
    })();
  }, [redirect, router, supabase]);

  async function startLogin() {
    try {
      setBusy(true);

      // ⬇️ 重點：callback 永遠指向 poster 網域
      const cb = `${POSTER_ORIGIN}/edit/auth/callback?redirect=${encodeURIComponent(
        redirect
      )}`;

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
        <h1 className="text-xl font-bold mb-4 text-center">登入 Poster（B端）</h1>
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
