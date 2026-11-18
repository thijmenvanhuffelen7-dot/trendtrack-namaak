"use client";

import { ErrorBody } from "@/components/site/error-body";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBody reset={reset} digest={error.digest} />;
}
