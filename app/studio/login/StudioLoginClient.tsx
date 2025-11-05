"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { ORIGIN, BASE } from "@/lib/env"; // ORIGIN=poster, BASE=/edit

function safeRedirect(raw: string | null) {
  if (!raw) return BASE;
  try {
    const u = new URL(raw, ORIGIN);
    if (u.origin !== ORIGIN) return BASE;
    if (!u.pathname.startsWith(BASE)) return BASE;
    return u.pathname + u.search + u.hash;
  } catch { return BASE; }
}

export default function PosterLoginPage() {
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
    setBusy(true);
    const cb = `${ORIGIN}${BASE}/auth/callback?redirect=${encodeURIComponent(redirect)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: cb, queryParams: { prompt: "select_account" } },
    });
    if (error) { alert(error.message); setBusy(false); }
  }

  return (
    <div className="min-h-screen grid place-items-center">
      <button onClick={startLogin} disabled={busy} className="px-4 py-3 bg-black text-white rounded">
        {busy ? "前往 Google…" : "使用 Google 登入"}
      </button>
    </div>
  );
}
