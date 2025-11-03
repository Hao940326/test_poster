import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function safeRedirectEdit(req: NextRequest) {
  const url = new URL(req.url);
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
  // 建立一個將被回傳的 response：同一個 response 會被寫入 Set-Cookie，再做 302
  const redirectTo = safeRedirectEdit(request);
  const response = new NextResponse(null, { status: 302 });
  response.headers.set("Location", new URL(redirectTo, request.url).toString());

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) =>
          response.cookies.set({ name, value, ...options }),
        remove: (name: string, options: CookieOptions) =>
          response.cookies.set({ name, value: "", ...options, expires: new Date(0) }),
      },
    }
  );

  // 交換 code → session，Set-Cookie 直接寫到上面的 response
  await supabase.auth.exchangeCodeForSession(request.url);

  return response; // 302 + Set-Cookie 同一支回應送出
}
