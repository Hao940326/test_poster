import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const STUDIO_ORIGIN = process.env.NEXT_PUBLIC_STUDIO_ORIGIN ?? "https://studio.kingstalent.com.tw";

function safeStudioPath(req: NextRequest) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("redirect");
  if (!raw) return "/studio";
  try {
    const u = new URL(raw, STUDIO_ORIGIN);   // ⬅️ 基準改成「A 端固定網域」
    if (u.origin !== STUDIO_ORIGIN) return "/studio";
    if (!u.pathname.startsWith("/studio")) return "/studio";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/studio";
  }
}

export async function GET(request: NextRequest) {
  const path = safeStudioPath(request);
  const location = `${STUDIO_ORIGIN}${path}`;

  const response = new NextResponse(null, { status: 302 });
  response.headers.set("Location", location);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, ...options }) => {
            response.cookies.set(name, value ?? "", options as any);
          });
        },
      },
    }
  );

  await supabase.auth.exchangeCodeForSession(request.url);

  return response; // 302 到 studio + 帶好 Set-Cookie
}
