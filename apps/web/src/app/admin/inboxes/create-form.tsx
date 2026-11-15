"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createInbox, type ActionState } from "./actions";

export function CreateInboxForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createInbox, {
    message: "",
  });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        name="domain"
        placeholder="zilverzand.nl"
        className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        required
      />
      <Button type="submit" disabled={pending}>
        Seed-adres maken
      </Button>
      {state.message && (
        <span className={state.error ? "text-sm text-red-600" : "font-mono text-sm"}>
          {state.message}
        </span>
      )}
    </form>
  );
}
