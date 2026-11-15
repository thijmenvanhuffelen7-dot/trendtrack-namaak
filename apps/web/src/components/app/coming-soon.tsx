import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export async function ComingSoon({
  navKey,
}: {
  navKey: "ads" | "advertisers" | "emails" | "brandtracker" | "folders" | "api" | "settings";
}) {
  const [t, tc] = await Promise.all([getTranslations("nav"), getTranslations("common")]);
  return (
    <>
      <PageHeader title={t(navKey)} />
      <EmptyState title={tc("comingSoon")}>{tc("comingSoonBody")}</EmptyState>
    </>
  );
}
