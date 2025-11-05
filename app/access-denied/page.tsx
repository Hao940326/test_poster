import React from "react";

export default function AccessDeniedPage() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
			<div className="max-w-lg text-center bg-white rounded-2xl shadow p-8">
				<h1 className="text-2xl font-bold mb-2">存取被拒</h1>
				<p className="text-slate-600 mb-4">您沒有權限存取此頁面。如果你認為這是錯誤，請聯絡管理員或嘗試以受允許的帳號登入。</p>
				<a href="/" className="inline-block mt-2 px-4 py-2 rounded bg-sky-600 text-white">回到首頁</a>
			</div>
		</div>
	);
}
