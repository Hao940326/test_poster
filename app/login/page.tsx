"use client";

import { useSearchParams } from "next/navigation";
import React from "react";

export const dynamic = "force-dynamic";  // ✅ 強制這頁在 runtime 渲染，不預先 build

export default function LoginPage() {
  const sp = useSearchParams();
  const err = sp.get("err");

  return (
    <main className="p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">登入頁面</h1>
      {err && <p className="text-red-500">錯誤：{err}</p>}
      {/* TODO: 這裡放你的登入按鈕 */}
    </main>
  );
}
