"use client";

import React from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function LoginBody() {
  const sp = useSearchParams();
  const router = useRouter();
  const err = sp.get("err");

  return (
    <main className="p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">登入頁面</h1>
      {err && <p className="text-red-500">錯誤：{err}</p>}
      {/* 你原本的登入 UI / 按鈕放這裡 */}
      {/* 例如：<button onClick={...}>Google 登入</button> */}
    </main>
  );
}
