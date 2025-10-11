"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { guardAllowed } from "@/lib/guardAllowed";

function safeRedirect(u: URL) {
  const r = u.searchParams.get("redirect") || "/studio";
  return r.startsWith("/") ? r : "/studio";
}

export default function AuthCallbackPage() {
  const supabase = getSupabase();
  const router = useRouter();
  const [msg, setMsg] = useState("處理登入中…");

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const hasCode = !!url.searchParams.get("code");

        // 1) 只有真的有 ?code=... 才換票；否則試 implicit (#access_token)
        if (hasCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(url.toString());
          if (error) throw error;
        } else {
          const h = new URLSearchParams(window.location.hash.slice(1));
          const at = h.get("access_token");
          const rt = h.get("refresh_token");
          if (at && rt) {
            await supabase.auth.setSession({ access_token: at, refresh_token: rt });
          } else {
            throw new Error("No code or tokens in callback URL");
          }
        }

        // 2) 名單守門（導頁前一定檢）
        const { allowed, email } = await guardAllowed(supabase, "callback");
        if (!allowed) {
          await supabase.auth.signOut();
          localStorage.setItem("denied_reason", email ? `不在允許名單：${email}` : "無法取得 email");
          console.warn("[callback] denied → /access-denied");
          router.replace("/access-denied");
          return; // 必須 return，避免繼續導回
        }

        // 3) 允許 → 安全導回
        const to = safeRedirect(url);
        console.log("[callback] allowed →", to);
        setMsg("登入成功，導向中…");
        router.replace(to);
      } catch (e: any) {
        console.error(e);
        setMsg("登入失敗：" + (e?.message ?? String(e)));
      }
    })();
  }, [router, supabase]);

  return <p style={{ padding: 16 }}>{msg}</p>;
}
