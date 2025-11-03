import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function safeRedirectStudio(request: NextRequest) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("redirect");
  if (!raw) return "/studio";
  try {
    const u = new URL(raw, url.origin);
    if (u.origin !== url.origin) return "/studio";
    if (!u.pathname.startsWith("/studio")) return "/studio";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/studio";
  }
}

export async function GET(request: NextRequest) {
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

  await supabase.auth.exchangeCodeForSession(request.url);

  const location = safeRedirectStudio(request);
  const redirect = NextResponse.redirect(new URL(location, request.url));

  response.headers.forEach((v, k) => {
    if (k.toLowerCase() === "set-cookie") {
      redirect.headers.append(k, v);
    }
  });

  return redirect;
}
