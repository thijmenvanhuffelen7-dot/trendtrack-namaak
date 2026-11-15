"use client";

import { useActionState } from "react";
import { requestOptout, type OptoutState } from "./actions";

export function OptoutForm() {
  const [state, action, pending] = useActionState<OptoutState, FormData>(requestOptout, {});
  if (state.ok)
    return (
      <p
        className="max-w-xl rounded-2xl border border-[var(--s-accent-hi)]/40 bg-[var(--s-accent)]/15 p-6 text-[var(--step-lead)] text-[#d7fff4]"
        role="status"
      >
        {state.message}
      </p>
    );
  return (
    <form action={action} className="s-frame max-w-xl">
      <div className="s-card space-y-5 p-6">
        <label className="block" htmlFor="oo-domain">
          <span className="mb-1 block text-[15px] text-[var(--s-muted)]">
            Domein van je webshop
          </span>
          <input
            id="oo-domain"
            name="domain"
            required
            className="s-input"
            placeholder="jouwshop.nl"
            autoComplete="url"
          />
        </label>
        <label className="block" htmlFor="oo-email">
          <span className="mb-1 block text-[15px] text-[var(--s-muted)]">
            Je e-mailadres, liefst op hetzelfde domein
          </span>
          <input
            id="oo-email"
            name="email"
            type="email"
            required
            className="s-input"
            autoComplete="email"
          />
        </label>
        <label className="block" htmlFor="oo-reason">
          <span className="mb-1 block text-[15px] text-[var(--s-muted)]">
            Toelichting (niet verplicht)
          </span>
          <textarea
            id="oo-reason"
            name="reason"
            rows={3}
            maxLength={2000}
            className="s-input !h-auto py-3"
          />
        </label>
        <label className="flex items-start gap-3" htmlFor="oo-owner">
          <input
            id="oo-owner"
            name="owner"
            type="checkbox"
            required
            className="mt-1 size-5 accent-[var(--s-accent)]"
          />
          <span>Ik ben eigenaar van deze webshop of mag namens de eigenaar handelen.</span>
        </label>
        {state.message && (
          <p className="text-[var(--s-yellow)]" role="alert">
            {state.message}
          </p>
        )}
        <button type="submit" className="s-btn" disabled={pending}>
          {pending ? "Versturen…" : "Verwijder mijn shop"}
        </button>
      </div>
    </form>
  );
}
