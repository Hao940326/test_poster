import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STUDIO_HOST = "studio.kingstalent.com.tw";
const POSTER_HOST = "poster.kingstalent.com.tw";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get("host") || "";
  const path = url.pathname;

  // 放行 Next 靜態資源與 callback
  if (
    path.startsWith("/_next") ||
    path.startsWith("/auth/callback") ||
    path.startsWith("/api/auth") // 若未來有
  ) {
    return NextResponse.next();
  }

  // A 端（Studio）：固定掛在 /studio
  if (host === STUDIO_HOST || host.startsWith("studio.")) {
    if (!path.startsWith("/studio")) {
      url.pathname = "/studio" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // B 端（Poster）：固定掛在 /edit
  if (host === POSTER_HOST || host.startsWith("poster.")) {
    if (!path.startsWith("/edit")) {
      url.pathname = "/edit" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}
