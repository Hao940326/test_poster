import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// 建議也放進環境變數
const POSTER_ORIGIN = process.env.NEXT_PUBLIC_POSTER_ORIGIN ?? "https://poster.kingstalent.com.tw";

function safeEditPath(req: NextRequest) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("redirect");
  if (!raw) return "/edit";
  try {
    const u = new URL(raw, POSTER_ORIGIN);   // ⬅️ 基準改成「B 端固定網域」
    if (u.origin !== POSTER_ORIGIN) return "/edit";
    if (!u.pathname.startsWith("/edit")) return "/edit";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/edit";
  }
}

export async function GET(request: NextRequest) {
  // 目標永遠落在 poster 網域
  const path = safeEditPath(request);
  const location = `${POSTER_ORIGIN}${path}`;

  // 同一支 302 回應；Set-Cookie 會直接寫在這支 response
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

  return response; // 302 到 poster + 帶好 Set-Cookie
}
