import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/* -------- 字體 -------- */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* -------- 網站基本資料 -------- */
export const metadata: Metadata = {
  title: "King's Talent Post Studio",
  description: "國王才藝海報設計平台",
  icons: {
    icon: "/apple-touch-icon.png",          // 預設 favicon
    shortcut: "/apple-touch-icon.png",      // 快捷圖示 (Windows)
    apple: "/apple-touch-icon.png" // iOS 主畫面圖示
  },
};

/* -------- 根 Layout -------- */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        {/* 若有自訂標籤，可加在這裡 */}
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
