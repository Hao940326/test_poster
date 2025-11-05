import { headers } from "next/headers";
import { redirect } from "next/navigation";

const STUDIO_HOST = "studio.kingstalent.com.tw";
const POSTER_HOST = "poster.kingstalent.com.tw";

function isStudioLike(host: string) {
  const sub = (host.split(".")[0] || "").toLowerCase();
  return host === STUDIO_HOST || sub === "studio" || sub.startsWith("studio-");
}
function posterURLFrom(reqHost: string, path = "/edit") {
  const proto = "https";
  const sub = (reqHost.split(".")[0] || "").toLowerCase();
  const host =
    sub === "poster" || sub.startsWith("poster-") ? reqHost : POSTER_HOST;
  return `${proto}://${host}${path}`;
}

export default async function EditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();             // ✅ 新版需要 await
  const host = h.get("host") || "";

  if (isStudioLike(host)) {
    redirect(posterURLFrom(host, "/edit"));
  }

  return <>{children}</>;
}
