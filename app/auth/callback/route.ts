import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ORIGIN, BASE, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

function safePath(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("redirect");
  if (!raw) return BASE;
  try {
    const u = new URL(raw, ORIGIN);
    if (u.origin !== ORIGIN) return BASE;
    if (!u.pathname.startsWith(BASE)) return BASE;
    return u.pathname + u.search + u.hash;
  } catch { return BASE; }
}

export async function GET(request: NextRequest) {
  const path = safePath(request);
  const res = new NextResponse(null, { status: 302 });
  res.headers.set("Location", `${ORIGIN}${path}`);

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) =>
        cookies.forEach(({ name, value, ...opts }) =>
          res.cookies.set(name, value ?? "", opts as any)
        ),
    },
  });

  await supabase.auth.exchangeCodeForSession(request.url);
  return res;
}
