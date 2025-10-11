import { Suspense } from "react";
import LoginBody from "./LoginBody";

export const metadata = { title: "登入" };

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="p-6 text-center">載入中…</main>}>
      <LoginBody />
    </Suspense>
  );
}
