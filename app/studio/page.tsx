// app/studio/page.tsx
import type { Metadata } from "next";
import ClientStudio from "./ClientStudio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Studio | King's Talent Poster",
  description: "A 端模板工作室",
};

import ErrorBoundary from "./ErrorBoundary";

export default function Page() {
  return (
    <ErrorBoundary>
      <ClientStudio />
    </ErrorBoundary>
  );
}
