"use client";
import { ErrorState } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main id="main" className="page-shell"><ErrorState onRetry={reset} /></main>; }
