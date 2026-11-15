"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMagicLink, signInWithGoogle, type LoginState } from "./actions";

export function LoginForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-lg border border-border bg-muted p-4 text-sm">
        <p className="font-medium">{t("sentTitle")}</p>
        <p className="mt-1 text-muted-foreground">{t("sentBody", { email: state.email ?? "" })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-medium" htmlFor="email">
          {t("email")}
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="jij@bedrijf.nl"
          defaultValue={state.email}
        />
        {state.status === "error" && (
          <p role="alert" className="text-sm text-danger">
            {t("error")}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("sending") : t("submit")}
        </Button>
      </form>
      {googleEnabled && (
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="outline" className="w-full">
            {t("google")}
          </Button>
        </form>
      )}
    </div>
  );
}
