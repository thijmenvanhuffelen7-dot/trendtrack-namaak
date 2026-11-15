import { getTranslations } from "next-intl/server";
import { Card, PageHeader } from "@/components/ui/misc";
import { getSession } from "@/lib/server/session";
import { PasswordForm } from "./form";

export default async function PasswordPage() {
  const { user } = await getSession();
  const t = await getTranslations("password");
  return (
    <>
      <PageHeader title={t("title")} description={t("description", { email: user.email })} />
      <Card className="max-w-md p-5">
        <PasswordForm />
      </Card>
    </>
  );
}
