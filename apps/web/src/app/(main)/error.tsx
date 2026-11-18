"use client";

import { ErrorBody } from "@/components/site/error-body";

/** Foutgrens voor het dashboard; de fonts komen via de root-layout van (main). */
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="site min-h-screen py-2">
      <ErrorBody reset={reset} digest={error.digest} />
    </div>
  );
}
