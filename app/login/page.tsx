'use client'
import { useSearchParams } from 'next/navigation'
export default function LoginPage() {
  const sp = useSearchParams()
  const err = sp.get('err')
  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-2">登入</h1>
      {err && <p className="text-red-600 mb-3">登入失敗：{decodeURIComponent(err)}</p>}
      <p className="text-slate-600 text-sm">請回上一頁再按一次「Google 登入」。</p>
    </main>
  )
}
