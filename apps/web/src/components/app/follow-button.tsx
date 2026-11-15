"use client";

import { Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { toggleTrackAction, type TrackState } from "@/app/(main)/app/actions";
import { LimitInline } from "@/components/app/limit-inline";
import { Button } from "@/components/ui/button";

export function FollowButton({
  shopId,
  tracked,
  path,
  variant,
}: {
  shopId: string;
  tracked: boolean;
  path: string;
  variant?: "unfollow-ghost";
}) {
  const t = useTranslations("shop");
  const [state, action, pending] = useActionState<TrackState, FormData>(toggleTrackAction, {
    status: "idle",
  });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="shop_id" value={shopId} />
      <input type="hidden" name="follow" value={tracked ? "false" : "true"} />
      <input type="hidden" name="path" value={path} />
      {variant === "unfollow-ghost" ? (
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          {t("unfollow")}
        </Button>
      ) : (
        <Button
          type="submit"
          variant={tracked ? "outline" : "default"}
          title={tracked ? t("unfollow") : undefined}
          disabled={pending}
        >
          {tracked ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          {tracked ? t("following") : t("follow")}
        </Button>
      )}
      {state.status === "limit" && state.message && <LimitInline message={state.message} />}
    </form>
  );
}
