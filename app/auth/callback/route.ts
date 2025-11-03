import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function safeRedirectStudio(req: NextRequest) {
  const url = new URL(req.url);
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
  const location = new URL(safeRedirectStudio(request), request.url).toString();
  const response = new NextResponse(null, { status: 302 });
  response.headers.set("Location", location);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, ...options }) => {
            response.cookies.set(name, value ?? "", options as any);
          });
        },
      },
    }
  );

  await supabase.auth.exchangeCodeForSession(request.url);

  return response;
}
