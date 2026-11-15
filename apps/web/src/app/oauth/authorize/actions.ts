"use server";

import { PLANS } from "@trendtrack/core";
import { createAuthorizationCode } from "@trendtrack/db";
import { redirect } from "next/navigation";
import { redirectWith, validateAuthorize } from "@/lib/oauth/authorize";
import { serviceDb } from "@/lib/server/db";
import { getPlan, getSession } from "@/lib/server/session";

/** Toestemming geven of weigeren. Alle parameters worden opnieuw gecontroleerd. */
export async function decideAction(form: FormData) {
  const sp = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const check = await validateAuthorize(serviceDb(), sp);
  if (!check.ok) throw new Error(check.message);
  const { req } = check;
  if (sp.decision !== "allow")
    redirect(redirectWith(req.redirectUri, { error: "access_denied", state: req.state }));

  const { user, workspace } = await getSession();
  if (!PLANS[(await getPlan()).plan].limits.api) redirect("/app/settings/billing");
  const code = await createAuthorizationCode(serviceDb(), {
    clientId: req.clientId,
    workspaceId: workspace.id,
    userId: user.id,
    redirectUri: req.redirectUri,
    codeChallenge: req.codeChallenge,
    resource: req.resource,
  });
  redirect(redirectWith(req.redirectUri, { code, state: req.state }));
}
