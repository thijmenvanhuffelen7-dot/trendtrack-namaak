"use client";

import { ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import {
  passwordAuth,
  sendMagicLink,
  sendPasswordReset,
  signInWithGoogle,
  type LoginState,
} from "./actions";

type View = "password" | "link" | "reset";
const IDLE: LoginState = { status: "idle" };

/**
 * Inloggen met wachtwoord (standaard, werkt zonder mailserver), account maken, inloglink per mail
 * en wachtwoord vergeten. Alles via server actions; zonder JavaScript werken de formulieren ook.
 */
export function LoginForm({
  next,
  googleEnabled,
  initialMode = "signin",
}: {
  next: string;
  googleEnabled: boolean;
  initialMode?: "signin" | "signup";
}) {
  const t = useTranslations("login");
  const [view, setView] = useState<View>("password");
  const mode = initialMode;
  const [showPw, setShowPw] = useState(false);
  const [pwState, pwAction, pwPending] = useActionState(passwordAuth, IDLE);
  const [linkState, linkAction, linkPending] = useActionState(sendMagicLink, IDLE);
  const [resetState, resetAction, resetPending] = useActionState(sendPasswordReset, IDLE);

  const errorText = (s: LoginState) =>
    s.status === "error" ? t(`errors.${s.error ?? "generic"}`) : null;

  if (linkState.status === "sent" && view === "link")
    return <Done title={t("sentTitle")} body={t("sentBody", { email: linkState.email ?? "" })} />;
  if (resetState.status === "sent" && view === "reset")
    return (
      <Done
        title={t("resetSentTitle")}
        body={t("resetSentBody", { email: resetState.email ?? "" })}
      />
    );
  if (pwState.status === "confirm")
    return (
      <Done title={t("confirmTitle")} body={t("confirmBody", { email: pwState.email ?? "" })} />
    );

  return (
    <div className="space-y-5">
      {view !== "reset" && (
        <div
          role="tablist"
          aria-label={t("method")}
          className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--s-line)] bg-[var(--s-bg-2)] p-1"
        >
          {(["password", "link"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-xl px-3 py-2 text-[14px] transition-colors ${
                view === v
                  ? "bg-[var(--s-tint-2)] text-[var(--s-ink)]"
                  : "text-[var(--s-muted)] hover:text-[var(--s-ink)]"
              }`}
            >
              {v === "password" ? t("tabPassword") : t("tabLink")}
            </button>
          ))}
        </div>
      )}

      {view === "password" && (
        <form action={pwAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="mode" value={mode} />
          <Field id="email" label={t("email")}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="jij@bedrijf.nl"
              defaultValue={pwState.email}
              className="s-input"
            />
          </Field>
          <Field
            id="password"
            label={t("password")}
            aside={
              mode === "signin" ? (
                <button
                  type="button"
                  onClick={() => setView("reset")}
                  className="text-[13px] text-[var(--s-muted)] hover:text-[var(--s-ink)]"
                >
                  {t("forgot")}
                </button>
              ) : null
            }
          >
            <span className="relative block">
              <input
                id="password"
                name="password"
                type={showPw ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                className="s-input !pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? t("hidePassword") : t("showPassword")}
                className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[var(--s-muted)] hover:text-[var(--s-ink)]"
              >
                {showPw ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </span>
            {mode === "signup" && (
              <span className="mt-1 block text-[13px] text-[var(--s-faint)]">
                {t("passwordHint")}
              </span>
            )}
          </Field>
          {errorText(pwState) && (
            <p role="alert" className="text-[14px] text-[var(--s-danger)]">
              {errorText(pwState)}
            </p>
          )}
          <button type="submit" className="s-btn w-full" disabled={pwPending}>
            {pwPending ? t("sending") : mode === "signin" ? t("signIn") : t("signUp")}
            <ArrowRight className="s-arrow size-4" aria-hidden />
          </button>
          <p className="text-center text-[14px] text-[var(--s-muted)]">
            {mode === "signin" ? t("noAccount") : t("haveAccount")}{" "}
            {/* Echte link: de kop van de pagina wisselt mee (Inloggen / Account maken). */}
            <Link
              href={`/login?${new URLSearchParams({ ...(mode === "signin" ? { mode: "signup" } : {}), next }).toString()}`}
              className="s-link text-[var(--s-ink)]"
            >
              {mode === "signin" ? t("toSignUp") : t("toSignIn")}
            </Link>
          </p>
        </form>
      )}

      {view === "link" && (
        <form action={linkAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <p className="text-[14px] text-[var(--s-muted)]">{t("linkIntro")}</p>
          <Field id="link-email" label={t("email")}>
            <input
              id="link-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="jij@bedrijf.nl"
              defaultValue={linkState.email}
              className="s-input"
            />
          </Field>
          {errorText(linkState) && (
            <p role="alert" className="text-[14px] text-[var(--s-danger)]">
              {errorText(linkState)}
            </p>
          )}
          <button type="submit" className="s-btn w-full" disabled={linkPending}>
            {linkPending ? t("sending") : t("submit")}
          </button>
        </form>
      )}

      {view === "reset" && (
        <form action={resetAction} className="space-y-4">
          <p className="text-[14px] text-[var(--s-muted)]">{t("resetIntro")}</p>
          <Field id="reset-email" label={t("email")}>
            <input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={pwState.email}
              className="s-input"
            />
          </Field>
          {errorText(resetState) && (
            <p role="alert" className="text-[14px] text-[var(--s-danger)]">
              {errorText(resetState)}
            </p>
          )}
          <button type="submit" className="s-btn w-full" disabled={resetPending}>
            {resetPending ? t("sending") : t("resetSubmit")}
          </button>
          <button
            type="button"
            onClick={() => setView("password")}
            className="w-full text-center text-[14px] text-[var(--s-muted)] hover:text-[var(--s-ink)]"
          >
            {t("back")}
          </button>
        </form>
      )}

      {googleEnabled && view !== "reset" && (
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <button type="submit" className="s-btn-ghost w-full">
            {t("google")}
          </button>
        </form>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  aside,
  children,
}: {
  id: string;
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-[14px] font-medium">
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}

function Done({ title, body }: { title: string; body: string }) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-[var(--s-accent-hi)]/40 bg-[var(--s-accent)]/15 p-5"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-[15px] text-[var(--s-body)]">{body}</p>
    </div>
  );
}
