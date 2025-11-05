import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Studio | King's Talent Poster",
  description: "國王才藝海報設計平台 — A 端模板工作室",
};

const STUDIO_HOST = "studio.kingstalent.com.tw";
const POSTER_HOST = "poster.kingstalent.com.tw";

function isPosterLike(host: string) {
  const sub = (host.split(".")[0] || "").toLowerCase();
  return host === POSTER_HOST || sub === "poster" || sub.startsWith("poster-");
}
function studioURLFrom(reqHost: string, path = "/studio") {
  const proto = "https";
  const sub = (reqHost.split(".")[0] || "").toLowerCase();
  const host = sub === "studio" || sub.startsWith("studio-") ? reqHost : STUDIO_HOST;
  return `${proto}://${host}${path}`;
}

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const host = h.get("host") || "";
  if (isPosterLike(host)) redirect(studioURLFrom(host, "/studio"));

  return (
    <html lang="zh-TW">
      <head>
        {/* Google Fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;500;700;900&family=Noto+Serif+TC:wght@300;400;600;700;900&family=Roboto:wght@300;400;500;700;900&display=swap"
          rel="stylesheet"
        />
        {/* GenYoGothic preload（TTC 有些瀏覽器更偏好 type="font/collection"） */}
        <link rel="preload" as="font" href="/fonts/genyo/GenYoGothic-N.ttc" type="font/collection" crossOrigin="anonymous" />
        <link rel="preload" as="font" href="/fonts/genyo/GenYoGothic-B.ttc" type="font/collection" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
