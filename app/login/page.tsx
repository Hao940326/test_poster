"use client";

import { useSearchParams } from "next/navigation";
import React from "react";

export default function LoginPage() {
  const params = useSearchParams();
  const err = params.get("err");

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">登入頁面</h1>
      {err && <p style={{ color: "red" }}>錯誤：{err}</p>}
      {/* 你的登入按鈕區塊 */}
    </div>
  );
}
