"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePassword, type PasswordState } from "./actions";

export function PasswordForm() {
  const t = useTranslations("password");
  const [state, action, pending] = useActionState<PasswordState, FormData>(updatePassword, {
    status: "idle",
  });
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="pw-new" className="block text-sm font-medium">
          {t("new")}
        </label>
        <Input
          id="pw-new"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>
      <div className="space-y-1">
        <label htmlFor="pw-confirm" className="block text-sm font-medium">
          {t("confirm")}
        </label>
        <Input
          id="pw-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {t(`errors.${state.error ?? "generic"}`)}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="text-sm font-medium text-emerald-600">
          {t("saved")}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
