"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { guardAllowed } from "@/lib/guardAllowed";

// 只允許站內相對路徑，避免 open-redirect
function safeRedirect(u: URL) {
  const r = u.searchParams.get("redirect") || "/"; // 建議用根路徑，交給 middleware 導到 /studio
  return r.startsWith("/") ? r : "/";
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
        const hasCode = !!url.searchParams.get("code");

        // 1) 若 URL 有 code，用 PKCE 換票；否則試 hash(#access_token)；再不行就看是否已經有 session
        if (hasCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(url.toString());({
            currentUrl: url.toString(),
          });
          if (error) throw error;
        } else {
          const h = new URLSearchParams(window.location.hash.slice(1));
          const at = h.get("access_token");
          const rt = h.get("refresh_token");

          if (at && rt) {
            await supabase.auth.setSession({ access_token: at, refresh_token: rt });
          } else {
            // 沒有 code/hash：如果本來就有 session，當作回跳；否則判為失敗
            const { data } = await supabase.auth.getSession();
            if (!data.session) throw new Error("No code/tokens and no existing session");
          }
        }

        // 2) 名單守門：一定要在導頁前檢查
        const { allowed, email } = await guardAllowed(supabase, "callback");
        if (!allowed) {
          await supabase.auth.signOut();
          localStorage.setItem(
            "denied_reason",
            email ? `不在允許名單：${email}` : "無法取得 email"
          );
          router.replace("/access-denied");
          return;
        }

        // 3) 清掉 URL 上的 code / hash，避免殘留在 history
        try {
          const clean = new URL(window.location.href);
          clean.searchParams.delete("code");
          clean.searchParams.delete("state");
          // 清 hash
          window.history.replaceState({}, "", clean.pathname + clean.search);
        } catch {}

        // 4) 安全導回（根路徑交給 middleware -> /studio）
        const to = safeRedirect(new URL(window.location.href));
        setMsg("登入成功，導向中…");
        router.replace(to);
      } catch (e: any) {
        console.error("[auth/callback]", e);
        setMsg("登入失敗：" + (e?.message ?? String(e)));
      }
    })();
  }, [router, supabase]);

  return <p style={{ padding: 16 }}>{msg}</p>;
}
