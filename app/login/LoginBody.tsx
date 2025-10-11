"use client";

import React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

export default function LoginBody() {
  const sp = useSearchParams();
  const router = useRouter();
  const err = sp.get("err") ?? sp.get("error"); // 兼容不同錯誤參數
  const supabase = getSupabase();

  async function loginGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) alert(error.message);
  }

  return (
    <main className="min-h-[60vh] p-6 flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold mb-4">登入頁面</h1>

      {err && (
        <p className="text-red-600 bg-red-100 px-3 py-1 rounded mb-4">
          錯誤：{err}
        </p>
      )}

      <button
        onClick={loginGoogle}
        className="px-4 py-2 rounded-lg bg-black text-white shadow active:scale-95"
      >
        使用 Google 登入
      </button>

      <button
        onClick={() => router.push("/")}
        className="mt-3 text-sm text-slate-600 hover:underline"
      >
        回首頁
      </button>
    </main>
  );
}
