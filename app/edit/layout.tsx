import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Poster | King's Talent",
  description: "國王才藝海報設計平台 — B 端編輯頁",
};

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
  const h = await headers();
  const host = h.get("host") || "";

  // 在 studio 主機下誤入 /edit，強制送到 poster 主機
  if (isStudioLike(host)) {
    redirect(posterURLFrom(host, "/edit"));
  }

  return (
    <html lang="zh-TW">
      <head>
        {/* Google Fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;500;700;900&family=Noto+Serif+TC:wght@300;400;600;700;900&family=Roboto:wght@300;400;500;700;900&display=swap"
          rel="stylesheet"
        />
        {/* GenYoGothic 預載（TTC 建議 type="font/collection"） */}
        <link rel="preload" as="font" href="/fonts/genyo/GenYoGothic-N.ttc" type="font/collection" crossOrigin="anonymous" />
        <link rel="preload" as="font" href="/fonts/genyo/GenYoGothic-B.ttc" type="font/collection" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
