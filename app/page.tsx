"use client";
import React from "react";
import Link from "next/link";

export default function Home() {
  return (
    <main style={{padding:24}}>
      <h1 style={{fontWeight:800, fontSize:24}}>Poster Maker</h1>
      <p>前往 A 端 Studio 製作模板，產生可分享的連結給 B 端編輯。</p>
      <Link href="/studio">
        <button style={{marginTop:12, padding:"8px 12px", background:"#2563eb", color:"#fff", borderRadius:6}}>
          進入 /studio
        </button>
      </Link>
    </main>
  );
}
