"use client"; // ⚠️ 必須放在整個檔案第一行！

import { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import React from "react";

function LoginBar({
  supabase,
  onUser,
}: {
  supabase: SupabaseClient;
  onUser: (u: any | null) => void;
}) {
  const [user, setUser] = React.useState<any>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    // 先讀 session（比 getUser 穩）
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      onUser(u);
    });

    // 訂閱所有事件；刷新頁面讓 Server Components（若有）同步
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const u = session?.user ?? null;
      setUser(u);
      onUser(u);
      router.refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, onUser, router]);

  async function loginGoogle() {
    const redirect = "/studio";
    const redirectTo = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
      redirect
    )}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (error) setMsg(error.message);
  }

  async function logout() {
    await supabase.auth.signOut();
    setMsg(null);
  }

  return (
    <div className="flex items-center gap-3">
      {user ? (
        <>
          <span className="text-sm text-slate-600">
            已登入：<b>{user.email ?? user.id}</b>
          </span>
          <button className="px-3 py-1.5 rounded border" onClick={logout}>
            登出
          </button>
        </>
      ) : (
        <button className="px-3 py-1.5 rounded border" onClick={loginGoogle}>
          Google 登入
        </button>
      )}
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}

export default LoginBar;
