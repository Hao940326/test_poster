import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function safeRedirectEdit(request: NextRequest) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("redirect");
  if (!raw) return "/edit";
  try {
    const u = new URL(raw, url.origin);
    if (u.origin !== url.origin) return "/edit";
    if (!u.pathname.startsWith("/edit")) return "/edit";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/edit";
  }
}

export async function GET(request: NextRequest) {
  // 為了讓 @supabase/ssr 能寫回 Set-Cookie，需要用一個可回傳的 response 來承接 cookies 操作
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options, expires: new Date(0) });
        },
      },
    }
  );

  // 1) 用查詢字串中的 code/exchange 掛回 session（關鍵）
  await supabase.auth.exchangeCodeForSession(request.url);

  // 2) 安全導回 /edit（或 /edit/...）
  const location = safeRedirectEdit(request);
  const redirect = NextResponse.redirect(new URL(location, request.url));

  // 3) 把剛才寫入的 cookies 帶到真正的 redirect response
  response.headers.forEach((v, k) => {
    if (k.toLowerCase() === "set-cookie") {
      redirect.headers.append(k, v);
    }
  });

  return redirect;
}
