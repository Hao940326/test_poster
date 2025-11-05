// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 以環境變數決定：這次部署是 A 還是 B
const APP_SIDE = process.env.NEXT_PUBLIC_APP_SIDE; // "A" or "B"

// 建議用環境變數設定兩個正式網域（避免寫死）
const STUDIO_HOST = process.env.NEXT_PUBLIC_STUDIO_HOST || "studio.kingstalent.com.tw";
const POSTER_HOST = process.env.NEXT_PUBLIC_POSTER_HOST || "poster.kingstalent.com.tw";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get("host") || "";
  const path = url.pathname;

  // 👉 僅當前「專案身分」會做對應重寫，其它一律不動
  if (APP_SIDE === "A") {
    // 只處理 studio 網域；在該網域上，把根與非 /studio 的路徑導去 /studio 前綴
    if (host === STUDIO_HOST || host.startsWith("studio.")) {
      if (!path.startsWith("/studio")) {
        url.pathname = "/studio" + (path === "/" ? "" : path);
        return NextResponse.rewrite(url);
      }
    }
  }

  if (APP_SIDE === "B") {
    // 只處理 poster 網域
    if (host === POSTER_HOST || host.startsWith("poster.")) {
      if (!path.startsWith("/edit")) {
        url.pathname = "/edit" + (path === "/" ? "" : path);
        return NextResponse.rewrite(url);
      }
    }
  }

  // 其他情況（預覽域名、localhost 之類）不要改路徑，避免奇怪跳轉
  return NextResponse.next();
}

// 建議限制 matcher，避免靜態資源被攔截
export const config = {
  matcher: [
    "/((?!_next/|api/|favicon.ico|apple-touch-icon.png|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map)).*)",
  ],
};
