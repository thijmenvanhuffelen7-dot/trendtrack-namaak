import { Check, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { toggleTrackAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";

export async function FollowButton({
  shopId,
  tracked,
  path,
}: {
  shopId: string;
  tracked: boolean;
  path: string;
}) {
  const t = await getTranslations("shop");
  return (
    <form action={toggleTrackAction}>
      <input type="hidden" name="shop_id" value={shopId} />
      <input type="hidden" name="follow" value={tracked ? "false" : "true"} />
      <input type="hidden" name="path" value={path} />
      <Button
        type="submit"
        variant={tracked ? "outline" : "default"}
        title={tracked ? t("unfollow") : undefined}
      >
        {tracked ? (
          <Check className="size-4" aria-hidden />
        ) : (
          <Plus className="size-4" aria-hidden />
        )}
        {tracked ? t("following") : t("follow")}
      </Button>
    </form>
  );
}
