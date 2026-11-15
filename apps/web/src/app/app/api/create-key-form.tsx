"use client";

import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { CopyField } from "@/components/app/copy-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createKeyAction, type CreateKeyState } from "./actions";

export function CreateKeyForm() {
  const t = useTranslations("api");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<CreateKeyState, FormData>(createKeyAction, {
    status: "idle",
  });
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <label htmlFor="key-name" className="sr-only">
          {t("name")}
        </label>
        <Input
          id="key-name"
          name="name"
          required
          maxLength={60}
          placeholder={t("namePlaceholder")}
          className="w-64"
        />
        <Button type="submit" disabled={pending}>
          <KeyRound className="size-4" aria-hidden />
          {t("create")}
        </Button>
      </form>
      {state.status === "created" && state.key && (
        <div role="status" className="rounded-lg border border-positive/40 bg-positive/5 p-4">
          <p className="text-sm font-medium">{t("created")}</p>
          <p className="mb-2 text-xs text-muted-foreground">{t("createdHint")}</p>
          <CopyField value={state.key} label={t("created")} copyLabel={tc("copy")} />
        </div>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {t("error", { message: state.message ?? "" })}
        </p>
      )}
    </div>
  );
}
