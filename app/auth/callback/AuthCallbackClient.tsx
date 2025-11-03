"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

function safeRedirect(redirect: string | null): string {
  if (!redirect) return "/";
  try {
    const u = new URL(redirect, window.location.origin);
    if (u.origin !== window.location.origin) return "/";
    if (!u.pathname.startsWith("/studio") && !u.pathname.startsWith("/edit")) return "/";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/";
  }
}

export default function AuthCallbackClient() {
  const supabase = useMemo(() => getSupabase(), []);
  const router = useRouter();
  const sp = useSearchParams();
  const [msg, setMsg] = useState("處理登入中…");

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const redirect = safeRedirect(sp.get("redirect"));

        const code = url.searchParams.get("code");
        const hasHashToken = url.hash.includes("access_token");

        if (code) {
          // ✅ 只傳字串 code
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (hasHashToken) {
          const hash = new URLSearchParams(url.hash.slice(1));
          const { data, error } = await supabase.auth.setSession({
            access_token: String(hash.get("access_token")),
            refresh_token: String(hash.get("refresh_token")),
          });
          if (error || !data.session) throw error || new Error("No session");
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("缺少授權資訊");
        }

        setMsg("登入成功，導向中…");
        router.replace(redirect || "/");
      } catch (e: any) {
        console.error(e);
        setMsg("登入失敗：" + (e?.message || "unknown"));
      }
    })();
  }, [router, sp, supabase]);

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-slate-700">{msg}</div>
    </div>
  );
}
