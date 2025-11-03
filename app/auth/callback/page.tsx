"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { guardAllowed } from "@/lib/guardAllowed";

// 只允許站內相對路徑，避免 open-redirect
function safeRedirectPath(raw: string | null | undefined) {
  const r = (raw || "/edit").trim();
  return r.startsWith("/") ? r : "/edit";
}

export default function AuthCallbackPage() {
  const supabase = getSupabase();
  const router = useRouter();
  const [msg, setMsg] = useState("處理登入中…");
  const ran = useRef(false); // 避免 React 嚴格模式雙跑

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const url = new URL(window.location.href);

        // ✅ 先把 redirect 存起來（清 URL 之前）
        const wantedPath = safeRedirectPath(url.searchParams.get("redirect"));

        const hasCode = !!url.searchParams.get("code");

        // 1) PKCE 或備援 hash；再不行看是否已有 session
        if (hasCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(url.toString());
          if (error) throw error;
        } else {
          const h = new URLSearchParams(window.location.hash.slice(1));
          const at = h.get("access_token");
          const rt = h.get("refresh_token");

          if (at && rt) {
            const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
            if (error) throw error;
          } else {
            const { data } = await supabase.auth.getSession();
            if (!data.session) throw new Error("No code/tokens and no existing session");
          }
        }

        // 2) 名單守門（導頁前檢查）
        const { allowed, email } = await guardAllowed(supabase, "callback");
        if (!allowed) {
          await supabase.auth.signOut();
          try {
            localStorage.setItem(
              "denied_reason",
              email ? `不在允許名單：${email}` : "無法取得 email"
            );
          } catch {}
          router.replace("/access-denied");
          return;
        }

        // 3) 清掉 code/state/hash（不留在 history）
        try {
          const clean = new URL(window.location.href);
          clean.searchParams.delete("code");
          clean.searchParams.delete("state");
          window.history.replaceState({}, "", clean.pathname + clean.search);
        } catch {}

        // 4) 用絕對網址硬導回「目前網域」的目標頁（避免任何中途重寫到 A 端）
        setMsg("登入成功，導向中…");
        const target = new URL(wantedPath, location.origin); // e.g. https://poster.../edit
        location.replace(target.toString());
      } catch (e: any) {
        console.error("[auth/callback]", e);
        setMsg("登入失敗：" + (e?.message ?? String(e)));
      }
    })();
  }, [router, supabase]);

  return <p style={{ padding: 16 }}>{msg}</p>;
}
