"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

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

        // 1) 只有有 code 才換票；否則試 implicit
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

        // 2) 讀使用者
        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email?.toLowerCase() ?? "";

        // 3) 查表：不在名單 → 立刻登出 + 導到拒絕頁
        const { data, error } = await supabase
          .from("allowed_users")
          .select("email")
          .eq("email", email)
          .maybeSingle();
        console.log("[allowed_users result]", { email, data, error });
        if (error) {
          console.warn("[allowed_users] query error:", error);
        }
        if (!email || !data) {
          await supabase.auth.signOut();
          localStorage.setItem("denied_reason", email ? `不在允許名單：${email}` : "無法取得 email");
          router.replace("/access-denied");
          return;
        }

        // 4) OK → 導回原頁
        router.replace(safeRedirect(url));
      } catch (e: any) {
        console.error(e);
        setMsg("登入失敗：" + (e?.message ?? String(e)));
      }
    })();
  }, [router, supabase]);

  return <p style={{ padding: 16 }}>{msg}</p>;
}