import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.NEXT_PUBLIC_BASE_PREFIX || "/studio"; // /edit 或 /studio

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const p = url.pathname;

  // 放行靜態/公開資源與 auth 回呼
  if (
    p.startsWith("/_next") || p.startsWith("/static") ||
    p.startsWith("/favicon") || p.startsWith("/icon") ||
    p.startsWith("/apple-touch-icon") || p.startsWith("/robots.txt") ||
    p.startsWith("/sitemap.xml") || p.startsWith("/images") ||
    p.startsWith("/fonts") || p.startsWith("/public") ||
    p.startsWith("/auth/") || p.includes(".")
  ) return NextResponse.next();

  // 不是正確前綴 → 導到 BASE
  if (p === "/") { url.pathname = BASE; return NextResponse.redirect(url); }
  if (!p.startsWith(BASE)) { url.pathname = BASE; return NextResponse.redirect(url); }

  // 下面做「強制登入」
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key) => req.cookies.get(key)?.value,
        set: (key, value, options) => { res.cookies.set(key, value, options); },
        remove: (key, options) => { res.cookies.delete(key); },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const loginUrl = new URL(`${BASE}/login`, req.url);
    loginUrl.searchParams.set("redirect", p + url.search + url.hash);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images/|fonts/|public|icon|apple-touch-icon).*)",
  ],
};
