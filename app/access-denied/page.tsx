"use client";

import { useEffect, useState } from "react";

export default function AccessDeniedPage() {
  const [reason, setReason] = useState("");

  useEffect(() => {
    // 在瀏覽器端讀取 localStorage
    const r = window.localStorage.getItem("denied_reason") || "";
    setReason(r);
  }, []);

  return (
    <main style={{ padding: 40, textAlign: "center" }}>
      <h1 style={{ color: "red" }}>拒絕登入</h1>
      <p style={{ marginTop: 12 }}>
        你的帳號不在允許名單中，請聯絡系統管理員。
      </p>
      {reason && (
        <pre style={{ marginTop: 20, color: "#555", whiteSpace: "pre-wrap" }}>
          {reason}
        </pre>
      )}
      <a
        href="/"
        style={{ display: "inline-block", marginTop: 24, color: "#2563eb" }}
      >
        回首頁
      </a>
    </main>
  );
}
